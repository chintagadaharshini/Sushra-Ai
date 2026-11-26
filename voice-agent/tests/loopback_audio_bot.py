"""Integration-test bot for Studio voice audio playback (no Sarvam/Groq needed).

After the client is ready it streams 4 seconds of a 440 Hz tone through the same
transport.output() path that Sarvam TTS audio uses, so the browser test can check the
bot's voice is actually played (not just received)."""

from __future__ import annotations

import asyncio
import math
import struct

from pipecat.frames.frames import OutputAudioRawFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.workers.runner import WorkerRunner

RATE = 24000


def tone(seconds: float, hz: float = 440.0) -> bytes:
    n = int(RATE * seconds)
    return b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * hz * i / RATE))) for i in range(n))


async def run_bot(transport, request_data):
    worker = PipelineWorker(Pipeline([transport.input(), transport.output()]), params=PipelineParams(audio_in_sample_rate=16000, audio_out_sample_rate=RATE))

    @worker.rtvi.event_handler("on_client_ready")
    async def on_ready(_r):
        async def go():
            await asyncio.sleep(0.5)
            chunk = RATE // 50 * 2  # 20 ms of 16-bit mono
            data = tone(4.0)
            for i in range(0, len(data), chunk):
                await worker.queue_frames([OutputAudioRawFrame(audio=data[i : i + chunk], sample_rate=RATE, num_channels=1)])

        asyncio.create_task(go())

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_disconnected")
    async def on_dc(_t, _c):
        await runner.cancel()

    await runner.run()
