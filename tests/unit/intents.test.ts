import { describe, expect, it } from "vitest";
import { findCity, normalize, parseChoice, parseConfirmation, recognize } from "@/lib/voice/intents";

const type = (s: string, ctx = {}) => recognize(s, ctx).type;

describe("intent recognition — required scenarios", () => {
  it("Scenario 1 (Telugu): show my health records", () => {
    expect(type("నా హెల్త్ రికార్డ్స్ చూపించు.")).toBe("OPEN_HEALTH_RECORDS");
    expect(type("నా హెల్త్ రిపోర్ట్స్ చూపించు.")).toBe("OPEN_HEALTH_RECORDS");
  });
  it("Scenario 2 (English): latest blood test report", () => {
    const i = recognize("Show me my latest blood test report.");
    expect(i.type).toBe("OPEN_SPECIFIC_REPORT");
    expect(i.params).toMatchObject({ category: "blood_test", ordinal: "latest" });
  });
  it("Scenario 3 (Hindi): explain my medical report", () => {
    const i = recognize("मेरी मेडिकल रिपोर्ट समझाओ।");
    expect(i.type).toBe("EXPLAIN_REPORT");
    expect(i.params.anaphora).toBe(true);
  });
  it("Scenario 4: change preferred city", () => {
    expect(recognize("Change my preferred city to Hyderabad.")).toMatchObject({ type: "UPDATE_FORM_FIELD", params: { field: "city", value: "Hyderabad" } });
    expect(recognize("Set my city to Visakhapatnam.")).toMatchObject({ type: "UPDATE_FORM_FIELD", params: { field: "city", value: "Visakhapatnam" } });
  });
  it("Scenario 5: find hospitals near a city", () => {
    expect(recognize("Find hospitals near Visakhapatnam.")).toMatchObject({ type: "SEARCH_FACILITIES", params: { city: "Visakhapatnam", facilityType: "HOSPITAL" } });
  });
  it("Scenario 6: multistep", () => {
    expect(type("Open my records.")).toBe("OPEN_HEALTH_RECORDS");
    expect(recognize("Open the latest one.", { hasVisibleRecords: true })).toMatchObject({ type: "OPEN_SPECIFIC_REPORT", params: { ordinal: "latest" } });
    expect(recognize("Explain it in Telugu.", { hasSelectedRecord: true })).toMatchObject({ type: "EXPLAIN_REPORT", params: { targetLang: "te", anaphora: true } });
  });
});

describe("intent recognition — English / Hindi / Telugu coverage", () => {
  const cases: [string, string][] = [
    ["Open my health records", "OPEN_HEALTH_RECORDS"],
    ["मेरी मेडिकल रिपोर्ट दिखाओ।", "OPEN_HEALTH_RECORDS"],
    ["मेरे हेल्थ रिकॉर्ड दिखाओ", "OPEN_HEALTH_RECORDS"],
    ["Show my appointments", "OPEN_APPOINTMENTS"],
    ["मेरे अपॉइंटमेंट दिखाओ", "OPEN_APPOINTMENTS"],
    ["నా అపాయింట్‌మెంట్స్ చూపించు", "OPEN_APPOINTMENTS"],
    ["Find healthcare facilities", "SEARCH_FACILITIES"],
    ["Show available healthcare services", "SEARCH_FACILITIES"],
    ["हैदराबाद में अस्पताल खोजो", "SEARCH_FACILITIES"],
    ["హైదరాబాద్‌లో ఆసుపత్రులు వెతుకు", "SEARCH_FACILITIES"],
    ["What can I do on this page?", "SHOW_HELP"],
    ["Help me fill this form", "SHOW_HELP"],
    ["मदद", "SHOW_HELP"],
    ["సహాయం", "SHOW_HELP"],
    ["Go to dashboard", "NAVIGATE_DASHBOARD"],
    ["डैशबोर्ड खोलो", "NAVIGATE_DASHBOARD"],
    ["డాష్‌బోర్డ్ తెరువు", "NAVIGATE_DASHBOARD"],
    ["Open my profile", "OPEN_PROFILE"],
    ["ప్రొఫైల్ తెరువు", "OPEN_PROFILE"],
    ["scroll down", "SCROLL_PAGE"],
    ["नीचे स्क्रॉल करो", "SCROLL_PAGE"],
    ["go back", "GO_BACK"],
    ["వెనక్కి వెళ్ళు", "GO_BACK"],
    ["cancel", "CANCEL_ACTION"],
    ["रहने दो", "CANCEL_ACTION"],
    ["వద్దు రద్దు చేయి", "CANCEL_ACTION"],
    ["Explain my latest report in Telugu", "EXPLAIN_REPORT"],
    ["దీన్ని తెలుగులో వివరించు", "EXPLAIN_REPORT"],
    ["Open my lab report", "OPEN_HEALTH_RECORDS"],
  ];
  it.each(cases)("%s → %s", (text, expected) => expect(type(text)).toBe(expected));

  it("open appointment booking sets booking flag", () => {
    expect(recognize("Open appointment booking")).toMatchObject({ type: "OPEN_APPOINTMENTS", params: { booking: true } });
  });
  it("record categories in all languages", () => {
    expect(recognize("मेरी शुगर रिपोर्ट खोलो").params.category).toBe("diabetes");
    expect(recognize("నా కొలెస్ట్రాల్ రిపోర్ట్ తెరువు").params.category).toBe("lipid");
    expect(recognize("open my blood pressure log").params.category).toBe("bp_log");
    expect(recognize("show my chest x-ray").params.category).toBe("chest_xray");
  });
  it("Hindi 'कर दो' / 'दिखा दो' is not misread as an ordinal", () => {
    expect(recognize("मेरी रिपोर्ट दिखा दो").type).toBe("OPEN_HEALTH_RECORDS");
  });
  it("form fields in Hindi and Telugu", () => {
    expect(recognize("मेरा शहर हैदराबाद कर दो")).toMatchObject({ type: "UPDATE_FORM_FIELD", params: { field: "city", value: "Hyderabad" } });
    expect(recognize("నా నగరం విశాఖపట్నం కి మార్చు")).toMatchObject({ type: "UPDATE_FORM_FIELD", params: { field: "city", value: "Visakhapatnam" } });
    expect(recognize("set my preferred language to Telugu")).toMatchObject({ type: "UPDATE_FORM_FIELD", params: { field: "preferredLanguage", value: "te" } });
    expect(recognize("make the text large")).toMatchObject({ type: "UPDATE_FORM_FIELD", params: { field: "textScale", value: "large" } });
  });
  it("appointment form fields only when that form is active", () => {
    expect(recognize("set department to cardiology", { activeForm: "appointment-request" })).toMatchObject({ params: { field: "department", value: "Cardiology" } });
    expect(recognize("set department to cardiology").type).not.toBe("UPDATE_FORM_FIELD");
  });
});

describe("language switching", () => {
  it("switch conversation language", () => {
    expect(recognize("switch to Hindi")).toMatchObject({ type: "CHANGE_LANGUAGE", params: { targetLang: "hi" } });
    expect(recognize("తెలుగులో మాట్లాడు")).toMatchObject({ type: "CHANGE_LANGUAGE", params: { targetLang: "te" } });
    expect(recognize("अंग्रेज़ी में बात करो")).toMatchObject({ type: "CHANGE_LANGUAGE", params: { targetLang: "en" } });
  });
  it("'explain in Telugu' is an explanation, not a language switch", () => {
    expect(type("explain this in Telugu")).toBe("EXPLAIN_REPORT");
  });
});

describe("blocked sensitive operations", () => {
  it.each([
    "my OTP is 445566",
    "enter my aadhaar number",
    "set password to abc123",
    "मेरा आधार नंबर भरो",
    "నా ఆధార్ నంబర్ ఎంటర్ చేయి",
    "1234 5678 9012",
  ])("blocks: %s", (s) => expect(type(s)).toBe("BLOCKED_SENSITIVE"));
});

describe("confirmation & choice parsing", () => {
  it("yes / no in three languages", () => {
    for (const y of ["yes", "Yes please", "हाँ", "ठीक है", "అవును", "సరే"]) expect(parseConfirmation(y)).toBe("yes");
    for (const n of ["no", "नहीं", "వద్దు", "లేదు"]) expect(parseConfirmation(n)).toBe("no");
    expect(parseConfirmation("hmm")).toBeNull();
    expect(parseConfirmation("yes no")).toBe("no"); // ambiguous → safe default
  });
  it("ordinals", () => {
    expect(parseChoice("the second one", 3)).toBe(1);
    expect(parseChoice("2", 3)).toBe(1);
    expect(parseChoice("पहला", 2)).toBe(0);
    expect(parseChoice("రెండవది", 2)).toBe(1);
    expect(parseChoice("latest", 3)).toBe(0);
    expect(parseChoice("fifth", 2)).toBeNull();
    expect(parseChoice("7", 2)).toBeNull();
  });
});

describe("helpers", () => {
  it("normalises punctuation including danda", () => expect(normalize("नमस्ते। Hello!")).toBe("नमस्ते hello"));
  it("finds cities via aliases", () => {
    expect(findCity("vizag")).toBe("Visakhapatnam");
    expect(findCity("విశాఖపట్నంలో")).toBe("Visakhapatnam");
    expect(findCity("नई दिल्ली")).toBe("Delhi");
    expect(findCity("bangalore")).toBe("Bengaluru");
  });
});

describe("care-team intents", () => {
  it.each([
    ["Open my patients", undefined],
    ["मेरे मरीज़ दिखाओ", undefined],
    ["నా రోగులను చూపించు", undefined],
    ["नया मरीज़ रजिस्टर करो", true],
    ["కొత్త రోగిని నమోదు చేయి", true],
    ["register a new patient", true],
  ])("%s", (text, register) => {
    const i = recognize(text);
    expect(i.type).toBe("OPEN_PATIENTS");
    expect(i.params.register).toBe(register);
  });
});
