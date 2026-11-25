"""Integration-test bot (no Sarvam/Groq needed).

Exercises the real path: WebRTC signalling through the Next.js proxy -> SmallWebRTC ->
RTVI data channel -> browser executor -> result back to Python. It plays the role of the
LLM by issuing a fixed script of tool calls, and writes results to SV_LOOPBACK_LOG.
"""

from __future__ import annotations

import asyncio
import json
import os

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from actions import ActionBridge, tool_to_action

SCRIPT = [
    ("go_to_page", {"page": "records"}),
    ("open_record", {"which": "latest"}),
    ("explain_record", {"language": "te"}),
    ("propose_form_change", {"field": "city", "value": "Guntur"}),
    ("reply_to_app_prompt", {"answer": "yes"}),
    ("propose_form_change", {"field": "aadhaar", "value": "1234"}),  # must be rejected before reaching the browser
]


async def run_bot(connection, request_data):
    transport = SmallWebRTCTransport(webrtc_connection=connection, params=TransportParams(audio_in_enabled=True, audio_out_enabled=True))
    worker = PipelineWorker(Pipeline([transport.input(), transport.output()]), params=PipelineParams())
    bridge = ActionBridge(send=worker.rtvi.send_server_message, timeout=15)
    log_path = os.getenv("SV_LOOPBACK_LOG", "/tmp/sv-loopback.json")
    results = {"request_data": request_data, "steps": []}

    @worker.rtvi.event_handler("on_client_message")
    async def on_msg(_r, msg):
        if msg.type == "sv-action-result":
            bridge.resolve(msg.data)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_ready(_r):
        async def go():
            for name, args in SCRIPT:
                try:
                    action = tool_to_action(name, args)
                except Exception as e:  # validation error stays server-side
                    results["steps"].append({"tool": name, "rejected": str(e)})
                    continue
                res = await bridge.request(action)
                results["steps"].append({"tool": name, "result": res})
                await asyncio.sleep(0.3)
            with open(log_path, "w") as f:
                json.dump(results, f, ensure_ascii=False, indent=1)

        asyncio.create_task(go())

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_disconnected")
    async def on_dc(_t, _c):
        await runner.cancel()

    await runner.run()
