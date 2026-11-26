"""Transport factories shared by the real bot and the integration-test bots."""

from __future__ import annotations

from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

# Browser mic arrives at 16 kHz; the browser player expects 24 kHz (Sarvam Bulbul's native rate).
IN_RATE, OUT_RATE = 16000, 24000


def websocket_transport(websocket) -> BaseTransport:
    """Audio + RTVI messages as protobuf frames over one WebSocket (works through HTTP proxies)."""
    return FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=ProtobufFrameSerializer(),
            session_timeout=15 * 60,
        ),
    )


def webrtc_transport(connection: SmallWebRTCConnection) -> BaseTransport:
    return SmallWebRTCTransport(webrtc_connection=connection, params=TransportParams(audio_in_enabled=True, audio_out_enabled=True))
