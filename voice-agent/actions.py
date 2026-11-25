"""Tool definitions and the browser action bridge.

The LLM never touches data or the DOM. Each tool call is validated here, turned into a
small, typed "action", and relayed to the signed-in browser over the WebRTC data channel.
The browser runs it through the same guarded executor used by typed and spoken commands
(confirmation before changes, whitelisted fields, access checks, outcome verification)
and replies with the real result, which is what the LLM then speaks.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, Field, ValidationError

PAGES = ["dashboard", "records", "profile", "appointments", "facilities", "help", "back", "patients", "register_patient"]
CATEGORIES = ["blood_test", "diabetes", "lipid", "thyroid", "consultation", "prescription", "chest_xray", "bp_log"]
WHICH = ["latest", "oldest", "this", "1", "2", "3", "4", "5"]
LANGS = ["en", "hi", "te"]
CITIES = ["Hyderabad", "Visakhapatnam", "Vijayawada", "Guntur", "Warangal", "Tirupati", "Delhi", "Lucknow", "Varanasi", "Chennai", "Bengaluru"]
FACILITY_TYPES = ["HOSPITAL", "CLINIC", "PHC", "DIAGNOSTIC_LAB", "PHARMACY"]
FIELDS = ["city", "preferredLanguage", "textScale", "voiceResponses", "department", "preferredDate"]
DIRECTIONS = ["up", "down", "top", "bottom"]

# JSON-schema style tool specs (converted to pipecat FunctionSchema in bot.py)
TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "go_to_page",
        "description": "Open a page of the Sushra AI app, or go back. Patients use records/appointments; doctors and ASHA workers use patients; only ASHA workers use register_patient.",
        "properties": {"page": {"type": "string", "enum": PAGES, "description": "Page to open."}},
        "required": ["page"],
    },
    {
        "name": "open_record",
        "description": "Open one of the patient's health records. Use 'which' for latest/oldest/position on the list, or 'this' for the record already open.",
        "properties": {
            "category": {"type": "string", "enum": CATEGORIES, "description": "Kind of record, if the user named one."},
            "which": {"type": "string", "enum": WHICH, "description": "Which matching record."},
        },
        "required": [],
    },
    {
        "name": "explain_record",
        "description": "Explain a health record in simple language, grounded only in the report's own values and lab reference ranges. Returns the explanation text to read out.",
        "properties": {
            "language": {"type": "string", "enum": LANGS, "description": "Language of the explanation."},
            "category": {"type": "string", "enum": CATEGORIES},
            "which": {"type": "string", "enum": WHICH, "description": "Omit or use 'this' for the record on screen."},
        },
        "required": ["language"],
    },
    {
        "name": "search_facilities",
        "description": "Search the demo healthcare facility directory.",
        "properties": {
            "city": {"type": "string", "enum": CITIES},
            "facility_type": {"type": "string", "enum": FACILITY_TYPES},
        },
        "required": [],
    },
    {
        "name": "open_appointment_booking",
        "description": "Open the demo appointment request form. The user must press Submit themselves.",
        "properties": {},
        "required": [],
    },
    {
        "name": "propose_form_change",
        "description": "Propose changing ONE allowed, non-sensitive field. The app shows the change and asks the user to confirm; nothing is saved until they say yes.",
        "properties": {
            "field": {"type": "string", "enum": FIELDS},
            "value": {"type": "string", "description": "New value. city: a supported city; preferredLanguage: en|hi|te; textScale: normal|large|xlarge; voiceResponses: true|false; department: e.g. Cardiology; preferredDate: YYYY-MM-DD."},
        },
        "required": ["field", "value"],
    },
    {
        "name": "reply_to_app_prompt",
        "description": "Pass the user's answer to a pending app prompt: 'yes' or 'no' for a confirmation, or an option number for a choice list.",
        "properties": {"answer": {"type": "string", "enum": ["yes", "no", "1", "2", "3", "4", "5"]}},
        "required": ["answer"],
    },
    {
        "name": "scroll_page",
        "description": "Scroll the current page.",
        "properties": {"direction": {"type": "string", "enum": DIRECTIONS}},
        "required": ["direction"],
    },
    {
        "name": "describe_current_page",
        "description": "Get help text describing what the user can do on the page they are viewing.",
        "properties": {},
        "required": [],
    },
    {
        "name": "cancel_pending_action",
        "description": "Cancel a pending confirmation or choice.",
        "properties": {},
        "required": [],
    },
]


class ActionError(ValueError):
    pass


class _OpenRecord(BaseModel):
    category: str | None = Field(default=None)
    which: str | None = Field(default=None)


def _which_params(which: str | None) -> dict[str, Any]:
    if not which:
        return {}
    if which == "this":
        return {"anaphora": True}
    if which in ("latest", "oldest"):
        return {"ordinal": which}
    return {"ordinal": int(which)}


def _check(value: Any, allowed: list[str], name: str) -> None:
    if value is not None and value not in allowed:
        raise ActionError(f"{name} must be one of {allowed}")


def tool_to_action(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Validate tool arguments and convert them to a browser action.

    Returns either {"kind": "intent", "intent": {...}} (matching the frontend's Zod intent
    schema) or {"kind": "reply", "text": "..."} for answering a pending prompt.
    Raises ActionError for anything invalid — nothing is sent to the browser then.
    """
    args = {k: v for k, v in (args or {}).items() if v not in (None, "")}
    if name == "go_to_page":
        page = args.get("page")
        _check(page, PAGES, "page")
        mapping = {
            "dashboard": {"type": "NAVIGATE_DASHBOARD", "params": {}},
            "records": {"type": "OPEN_HEALTH_RECORDS", "params": {}},
            "profile": {"type": "OPEN_PROFILE", "params": {}},
            "appointments": {"type": "OPEN_APPOINTMENTS", "params": {}},
            "facilities": {"type": "SEARCH_FACILITIES", "params": {}},
            "help": {"type": "SHOW_HELP", "params": {"openHelpPage": True}},
            "back": {"type": "GO_BACK", "params": {}},
            "patients": {"type": "OPEN_PATIENTS", "params": {}},
            "register_patient": {"type": "OPEN_PATIENTS", "params": {"register": True}},
        }
        if page not in mapping:
            raise ActionError("page is required")
        return {"kind": "intent", "intent": mapping[page]}

    if name in ("open_record", "explain_record"):
        try:
            p = _OpenRecord(**{k: args.get(k) for k in ("category", "which")})
        except ValidationError as e:  # pragma: no cover - pydantic guards types
            raise ActionError(str(e)) from e
        _check(p.category, CATEGORIES, "category")
        _check(p.which, WHICH, "which")
        params: dict[str, Any] = {**_which_params(p.which)}
        if p.category:
            params["category"] = p.category
        if name == "explain_record":
            lang = args.get("language")
            _check(lang, LANGS, "language")
            if not lang:
                raise ActionError("language is required")
            params["targetLang"] = lang
            if not p.category and p.which is None:
                params["anaphora"] = True
            return {"kind": "intent", "intent": {"type": "EXPLAIN_REPORT", "params": params}}
        if not params:
            raise ActionError("say which record (category or which)")
        return {"kind": "intent", "intent": {"type": "OPEN_SPECIFIC_REPORT", "params": params}}

    if name == "search_facilities":
        _check(args.get("city"), CITIES, "city")
        _check(args.get("facility_type"), FACILITY_TYPES, "facility_type")
        params = {}
        if args.get("city"):
            params["city"] = args["city"]
        if args.get("facility_type"):
            params["facilityType"] = args["facility_type"]
        return {"kind": "intent", "intent": {"type": "SEARCH_FACILITIES", "params": params}}

    if name == "open_appointment_booking":
        return {"kind": "intent", "intent": {"type": "OPEN_APPOINTMENTS", "params": {"booking": True}}}

    if name == "propose_form_change":
        field, value = args.get("field"), args.get("value")
        _check(field, FIELDS, "field")
        if not field or value is None:
            raise ActionError("field and value are required")
        v: Any = str(value).strip()
        if field == "voiceResponses":
            if v.lower() not in ("true", "false", "on", "off"):
                raise ActionError("voiceResponses must be true or false")
            v = v.lower() in ("true", "on")
        elif field == "city":
            _check(v, CITIES, "city")
        elif field == "preferredLanguage":
            _check(v, LANGS, "preferredLanguage")
        elif field == "textScale":
            _check(v, ["normal", "large", "xlarge"], "textScale")
        return {"kind": "intent", "intent": {"type": "UPDATE_FORM_FIELD", "params": {"field": field, "value": v}}}

    if name == "reply_to_app_prompt":
        ans = args.get("answer")
        _check(ans, ["yes", "no", "1", "2", "3", "4", "5"], "answer")
        if not ans:
            raise ActionError("answer is required")
        return {"kind": "reply", "text": ans}

    if name == "scroll_page":
        d = args.get("direction")
        _check(d, DIRECTIONS, "direction")
        return {"kind": "intent", "intent": {"type": "SCROLL_PAGE", "params": {"direction": d or "down"}}}

    if name == "describe_current_page":
        return {"kind": "intent", "intent": {"type": "SHOW_HELP", "params": {}}}

    if name == "cancel_pending_action":
        return {"kind": "intent", "intent": {"type": "CANCEL_ACTION", "params": {}}}

    raise ActionError(f"unknown tool {name}")


class ActionBridge:
    """Request/response over the RTVI data channel, matched by id, with a timeout."""

    def __init__(self, send: Callable[[dict[str, Any]], Awaitable[None]], timeout: float = 15.0):
        self._send = send
        self._timeout = timeout
        self._pending: dict[str, asyncio.Future] = {}

    async def request(self, action: dict[str, Any]) -> dict[str, Any]:
        action_id = uuid.uuid4().hex
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[action_id] = fut
        try:
            await self._send({"type": "sv-action", "id": action_id, "action": action})
            return await asyncio.wait_for(fut, timeout=self._timeout)
        except asyncio.TimeoutError:
            # Honest failure: the app did not confirm the action happened.
            return {"ok": False, "error": "The app did not respond in time; the action may not have happened."}
        finally:
            self._pending.pop(action_id, None)

    def resolve(self, data: Any) -> bool:
        if not isinstance(data, dict):
            return False
        fut = self._pending.get(str(data.get("id")))
        if fut is None or fut.done():
            return False
        result = data.get("result")
        fut.set_result(result if isinstance(result, dict) else {"ok": False, "error": "malformed result"})
        return True
