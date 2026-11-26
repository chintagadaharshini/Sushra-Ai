"""Sushra AI real-time voice agent (Pipecat).

Pipeline: mic -> Sarvam Saaras STT -> Groq LLM (tool calling) -> Sarvam Bulbul TTS -> speaker.
The transport is either a WebSocket (default; works behind HTTP-only hosts like Render) or
SmallWebRTC (local/self-hosted). Tools run in the user's signed-in browser via RTVI messages
(see actions.py).
"""

from __future__ import annotations

import os
from typing import Any

from loguru import logger

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair, LLMUserAggregatorParams
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import BaseTransport
from pipecat.turns.user_mute.always_user_mute_strategy import AlwaysUserMuteStrategy
from pipecat.turns.user_mute.function_call_user_mute_strategy import FunctionCallUserMuteStrategy
from pipecat.turns.user_mute.mute_until_first_bot_complete_user_mute_strategy import MuteUntilFirstBotCompleteUserMuteStrategy
from pipecat.workers.runner import WorkerRunner

from actions import TOOL_SPECS, ActionBridge, ActionError, tool_to_action
from prompts import GREETING, system_prompt
from transports import IN_RATE, OUT_RATE

LANGUAGE = {"en": Language.EN_IN, "hi": Language.HI_IN, "te": Language.TE_IN}

# Recognition hints (Saaras v4): app vocabulary in Telugu, Hindi and English, so short
# commands spoken by elderly users are not mis-heard as unrelated words.
KEYTERMS = [
    "హెల్త్ రికార్డ్స్", "రిపోర్ట్", "బ్లడ్ టెస్ట్", "వివరించు", "చూపించు", "తెరువు", "ఆసుపత్రి", "అపాయింట్‌మెంట్", "ప్రొఫైల్", "నగరం",
    "విశాఖపట్నం", "హైదరాబాద్", "విజయవాడ", "షుగర్", "కొలెస్ట్రాల్", "థైరాయిడ్", "అవును", "వద్దు",
    "हेल्थ रिकॉर्ड", "रिपोर्ट", "ब्लड टेस्ट", "समझाओ", "दिखाओ", "अस्पताल", "अपॉइंटमेंट", "शहर", "हाँ", "नहीं",
    "health records", "blood test", "report", "explain", "hospital", "appointment", "profile", "Visakhapatnam", "Hyderabad",
    "cholesterol", "thyroid", "prescription", "patients", "ASHA", "Sushra", "సుశ్రా", "सुश्रा",
]


def mute_strategies():
    """Echo protection. Laptop/phone speakers leak the bot's voice into the mic, which the
    STT then transcribes as nonsense and treats as an interruption. By default the user is
    muted while the bot speaks; set STUDIO_BARGE_IN=1 (with headphones) to allow barge-in."""
    if os.getenv("STUDIO_BARGE_IN") == "1":
        return [MuteUntilFirstBotCompleteUserMuteStrategy(), FunctionCallUserMuteStrategy()]
    return [AlwaysUserMuteStrategy(), FunctionCallUserMuteStrategy()]


def build_tools() -> ToolsSchema:
    return ToolsSchema(
        standard_tools=[
            FunctionSchema(name=s["name"], description=s["description"], properties=s["properties"], required=s["required"])
            for s in TOOL_SPECS
        ]
    )


async def run_bot(transport: BaseTransport, request_data: dict[str, Any] | None) -> None:
    data = request_data or {}
    lang = data.get("lang") if data.get("lang") in LANGUAGE else "en"
    first_name = str(data.get("firstName") or "")[:40]
    role = data.get("role") if data.get("role") in ("PATIENT", "DOCTOR", "ASHA") else "PATIENT"
    logger.info(f"Starting voice session (lang={lang}, transport={type(transport).__name__})")  # never log transcripts or health data

    stt_model = os.getenv("STT_MODEL", "saaras:v4")
    stt = SarvamSTTService(
        api_key=os.environ["SARVAM_API_KEY"],
        settings=SarvamSTTService.Settings(model=stt_model, language=LANGUAGE[lang]),
        keyterms=KEYTERMS if stt_model == "saaras:v4" else None,
    )
    tts = SarvamTTSService(
        api_key=os.environ["SARVAM_API_KEY"],
        settings=SarvamTTSService.Settings(model=os.getenv("TTS_MODEL", "bulbul:v3"), language=LANGUAGE[lang], voice=os.getenv("TTS_VOICE", "priya"), pace=0.95),
    )
    llm = GroqLLMService(
        api_key=os.environ["GROQ_API_KEY"],
        settings=GroqLLMService.Settings(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            system_instruction=system_prompt(lang, first_name, role),
        ),
    )

    context = LLMContext(tools=build_tools())
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context, user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer(), user_mute_strategies=mute_strategies())
    )

    pipeline = Pipeline([transport.input(), stt, user_aggregator, llm, tts, transport.output(), assistant_aggregator])
    worker = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=False, audio_in_sample_rate=IN_RATE, audio_out_sample_rate=OUT_RATE))
    rtvi = worker.rtvi

    bridge = ActionBridge(send=rtvi.send_server_message)

    async def handle_tool(params: FunctionCallParams) -> None:
        try:
            action = tool_to_action(params.function_name, dict(params.arguments or {}))
        except ActionError as e:
            await params.result_callback({"ok": False, "error": f"Invalid request: {e}"})
            return
        result = await bridge.request(action)
        await params.result_callback(result)

    for spec in TOOL_SPECS:
        llm.register_function(spec["name"], handle_tool)

    @rtvi.event_handler("on_client_message")
    async def on_client_message(_rtvi, msg):
        if msg.type == "sv-action-result":
            bridge.resolve(msg.data)

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(_rtvi):
        await tts.queue_frame(TTSSpeakFrame(GREETING[lang].format(name=first_name or "")))

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(_transport, _client):
        logger.info("Voice session ended")
        await runner.cancel()

    await runner.run()
