import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from actions import TOOL_SPECS, ActionBridge, ActionError, tool_to_action  # noqa: E402


def intent(name, **args):
    return tool_to_action(name, args)["intent"]


def test_navigation_maps_to_intents():
    assert intent("go_to_page", page="records") == {"type": "OPEN_HEALTH_RECORDS", "params": {}}
    assert intent("go_to_page", page="help")["params"] == {"openHelpPage": True}
    with pytest.raises(ActionError):
        tool_to_action("go_to_page", {"page": "admin"})


def test_open_and_explain_records():
    assert intent("open_record", category="blood_test", which="latest") == {
        "type": "OPEN_SPECIFIC_REPORT", "params": {"ordinal": "latest", "category": "blood_test"}}
    assert intent("open_record", which="2")["params"] == {"ordinal": 2}
    assert intent("explain_record", language="te") == {"type": "EXPLAIN_REPORT", "params": {"targetLang": "te", "anaphora": True}}
    with pytest.raises(ActionError):
        tool_to_action("explain_record", {"language": "fr"})
    with pytest.raises(ActionError):
        tool_to_action("open_record", {})


def test_form_changes_are_whitelisted():
    assert intent("propose_form_change", field="city", value="Hyderabad")["params"] == {"field": "city", "value": "Hyderabad"}
    assert intent("propose_form_change", field="voiceResponses", value="off")["params"]["value"] is False
    for bad in ({"field": "aadhaar", "value": "1234"}, {"field": "city", "value": "Atlantis"}, {"field": "preferredLanguage", "value": "fr"}):
        with pytest.raises(ActionError):
            tool_to_action("propose_form_change", bad)


def test_prompt_replies_and_facilities():
    assert tool_to_action("reply_to_app_prompt", {"answer": "yes"}) == {"kind": "reply", "text": "yes"}
    with pytest.raises(ActionError):
        tool_to_action("reply_to_app_prompt", {"answer": "delete everything"})
    assert intent("search_facilities", city="Visakhapatnam", facility_type="HOSPITAL")["params"] == {"city": "Visakhapatnam", "facilityType": "HOSPITAL"}


def test_every_tool_spec_is_handled():
    for spec in TOOL_SPECS:
        args = {k: (v.get("enum") or ["x"])[0] for k, v in spec["properties"].items() if k in spec["required"]}
        if spec["name"] == "open_record":
            args = {"which": "latest"}
        if spec["name"] == "propose_form_change":
            args = {"field": "textScale", "value": "large"}
        assert tool_to_action(spec["name"], args)["kind"] in ("intent", "reply")


def test_bridge_round_trip_and_timeout():
    async def run():
        sent = []

        async def send(msg):
            sent.append(msg)

        bridge = ActionBridge(send, timeout=0.5)
        task = asyncio.create_task(bridge.request({"kind": "reply", "text": "yes"}))
        await asyncio.sleep(0.01)
        assert sent[0]["type"] == "sv-action"
        assert bridge.resolve({"id": sent[0]["id"], "result": {"ok": True, "say": "done"}})
        assert (await task) == {"ok": True, "say": "done"}
        assert not bridge.resolve({"id": "unknown", "result": {}})
        timed_out = await bridge.request({"kind": "reply", "text": "no"})
        assert timed_out["ok"] is False

    asyncio.run(run())
