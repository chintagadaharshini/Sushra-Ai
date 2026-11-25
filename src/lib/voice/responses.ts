// Localised assistant responses (English / Hindi / Telugu).
import { type Lang } from "../domain";
import type { RecordCategory } from "./intents";

type Dict = Record<string, Record<Lang, string>>;

export const R: Dict = {
  greetingTitle: { en: "How can I help you?", hi: "मैं आपकी कैसे मदद करूँ?", te: "నేను మీకు ఎలా సహాయం చేయగలను?" },
  openingRecords: { en: "Sure. Opening your health records.", hi: "ज़रूर। आपके हेल्थ रिकॉर्ड खोल रही हूँ।", te: "తప్పకుండా. మీ హెల్త్ రికార్డ్స్ తెరుస్తున్నాను." },
  recordsShown: { en: "You have {n} records. The newest is at the top.", hi: "आपके {n} रिकॉर्ड हैं। सबसे नया सबसे ऊपर है।", te: "మీకు {n} రికార్డ్స్ ఉన్నాయి. తాజాది పైన ఉంది." },
  openingDashboard: { en: "Opening your dashboard.", hi: "आपका डैशबोर्ड खोल रही हूँ।", te: "మీ డాష్‌బోర్డ్ తెరుస్తున్నాను." },
  openingProfile: { en: "Opening your profile and preferences.", hi: "आपकी प्रोफ़ाइल और पसंद खोल रही हूँ।", te: "మీ ప్రొఫైల్ మరియు ప్రాధాన్యతలు తెరుస్తున్నాను." },
  openingReportLatest: { en: "Opening your latest {label} report, dated {date}.", hi: "आपकी सबसे नई {label} रिपोर्ट खोल रही हूँ, तारीख {date}।", te: "మీ తాజా {label} రిపోర్ట్ తెరుస్తున్నాను, తేదీ {date}." },
  openingReport: { en: "Opening your {label} record from {date}.", hi: "{date} का आपका {label} रिकॉर्ड खोल रही हूँ।", te: "{date} నాటి మీ {label} రికార్డ్ తెరుస్తున్నాను." },
  chooseRecord: { en: "I found {n} matching records. Which one would you like? Say first, second, or tap one.", hi: "मुझे {n} रिकॉर्ड मिले। आपको कौन-सा चाहिए? पहला, दूसरा बोलें या किसी एक पर टैप करें।", te: "{n} రికార్డ్స్ దొరికాయి. మీకు ఏది కావాలి? మొదటిది, రెండవది అని చెప్పండి లేదా ఒకదాన్ని నొక్కండి." },
  choiceNotUnderstood: { en: "Sorry, which one? Say first, second, or tap an option.", hi: "माफ़ कीजिए, कौन-सा? पहला, दूसरा बोलें या विकल्प पर टैप करें।", te: "క్షమించండి, ఏది? మొదటిది, రెండవది అని చెప్పండి లేదా ఒక ఎంపికను నొక్కండి." },
  noRecordMatch: { en: "I couldn't find a matching record.", hi: "मिलता-जुलता रिकॉर्ड नहीं मिला।", te: "సరిపోయే రికార్డ్ దొరకలేదు." },
  explainIntro: { en: "I'll help explain your report in simple language.", hi: "मैं आपकी रिपोर्ट आसान भाषा में समझाने में मदद करूँगी।", te: "మీ రిపోర్ట్‌ను సులభమైన భాషలో వివరించడంలో సహాయం చేస్తాను." },
  explainWhich: { en: "Which report should I explain? Choose one below.", hi: "मैं कौन-सी रिपोर्ट समझाऊँ? नीचे से एक चुनें।", te: "ఏ రిపోర్ట్‌ను వివరించాలి? కింద నుండి ఒకటి ఎంచుకోండి." },
  explainFailed: { en: "Sorry, I couldn't load that report to explain it. Nothing was shared.", hi: "माफ़ कीजिए, समझाने के लिए रिपोर्ट लोड नहीं हो सकी। कुछ भी साझा नहीं किया गया।", te: "క్షమించండి, వివరించడానికి రిపోర్ట్ లోడ్ కాలేదు. ఏదీ పంచుకోలేదు." },
  confirmField: { en: "Would you like me to set your {field} to {value}?", hi: "क्या मैं {field} को {value} कर दूँ?", te: "మీ {field}: {value} అని మార్చమంటారా?" },
  sayYesNo: { en: "Say yes or no, or use the buttons.", hi: "हाँ या नहीं बोलें, या बटन दबाएँ।", te: "అవును లేదా వద్దు అని చెప్పండి, లేదా బటన్ నొక్కండి." },
  fieldSaved: { en: "Done. Your {field} is now {value}, and it has been saved.", hi: "हो गया। {field} अब {value} है और सेव कर दिया गया है।", te: "పూర్తయింది. మీ {field} ఇప్పుడు {value}. ఇది సేవ్ అయింది." },
  fieldFilled: { en: "I've filled {field} with {value}. Please review the form and press Submit yourself.", hi: "मैंने {field} में {value} भर दिया है। कृपया फ़ॉर्म जाँचें और सबमिट ख़ुद दबाएँ।", te: "{field}లో {value} నింపాను. దయచేసి ఫారమ్ సరిచూసి సబ్మిట్ మీరే నొక్కండి." },
  updateFailed: { en: "Sorry, I couldn't save that change, so nothing was changed. Please try again.", hi: "माफ़ कीजिए, बदलाव सेव नहीं हो सका, इसलिए कुछ नहीं बदला। कृपया फिर कोशिश करें।", te: "క్షమించండి, మార్పు సేవ్ కాలేదు, కాబట్టి ఏమీ మారలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి." },
  formNotAvailable: { en: "That field isn't on this screen. Open the appointment request form first.", hi: "यह फ़ील्ड इस स्क्रीन पर नहीं है। पहले अपॉइंटमेंट अनुरोध फ़ॉर्म खोलें।", te: "ఆ ఫీల్డ్ ఈ స్క్రీన్‌లో లేదు. ముందు అపాయింట్‌మెంట్ అభ్యర్థన ఫారమ్ తెరవండి." },
  cancelled: { en: "Okay, cancelled. Nothing was changed.", hi: "ठीक है, रद्द कर दिया। कुछ नहीं बदला।", te: "సరే, రద్దు చేశాను. ఏమీ మార్చలేదు." },
  nothingToCancel: { en: "There's nothing to cancel right now.", hi: "अभी रद्द करने के लिए कुछ नहीं है।", te: "ఇప్పుడు రద్దు చేయడానికి ఏమీ లేదు." },
  pendingDropped: { en: "I've dropped the earlier pending change.", hi: "पिछला लंबित बदलाव हटा दिया है।", te: "ముందు అడిగిన మార్పును వదిలేశాను." },
  openingFacilitiesCity: { en: "Opening healthcare facility search for {city}.", hi: "{city} के लिए स्वास्थ्य केंद्र खोज खोल रही हूँ।", te: "{city} కోసం ఆరోగ్య కేంద్రాల శోధన తెరుస్తున్నాను." },
  openingFacilities: { en: "Opening the healthcare services directory.", hi: "स्वास्थ्य सेवाओं की सूची खोल रही हूँ।", te: "ఆరోగ్య సేవల జాబితా తెరుస్తున్నాను." },
  facilitiesFound: { en: "I found {n} facilities{where}.", hi: "{where} {n} स्वास्थ्य केंद्र मिले।", te: "{where} {n} ఆరోగ్య కేంద్రాలు దొరికాయి." },
  facilitiesNone: { en: "I couldn't find facilities{where}. Try another city such as Hyderabad or Visakhapatnam.", hi: "{where} कोई केंद्र नहीं मिला। हैदराबाद या विशाखापत्तनम जैसा दूसरा शहर आज़माएँ।", te: "{where} కేంద్రాలు దొరకలేదు. హైదరాబాద్ లేదా విశాఖపట్నం వంటి మరో నగరం ప్రయత్నించండి." },
  openingAppointments: { en: "Opening your appointments.", hi: "आपके अपॉइंटमेंट खोल रही हूँ।", te: "మీ అపాయింట్‌మెంట్స్ తెరుస్తున్నాను." },
  appointmentsShown: { en: "You have {n} upcoming appointments.", hi: "आपके {n} आने वाले अपॉइंटमेंट हैं।", te: "మీకు {n} రాబోయే అపాయింట్‌మెంట్స్ ఉన్నాయి." },
  openingBooking: { en: "Opening the appointment request form. Please check the details and press Submit yourself.", hi: "अपॉइंटमेंट अनुरोध फ़ॉर्म खोल रही हूँ। कृपया विवरण जाँचें और सबमिट ख़ुद दबाएँ।", te: "అపాయింట్‌మెంట్ అభ్యర్థన ఫారమ్ తెరుస్తున్నాను. వివరాలు సరిచూసి సబ్మిట్ మీరే నొక్కండి." },
  scrolled: { en: "Scrolled {dir}.", hi: "{dir} स्क्रॉल किया।", te: "{dir} స్క్రోల్ చేశాను." },
  scrollLimit: { en: "You're already at the {edge} of the page.", hi: "आप पहले से पेज के {edge} पर हैं।", te: "మీరు ఇప్పటికే పేజీ {edge} ఉన్నారు." },
  goingBack: { en: "Going back.", hi: "पीछे जा रही हूँ।", te: "వెనక్కి వెళ్తున్నాను." },
  languageChanged: { en: "Okay, I'll speak English now.", hi: "ठीक है, अब मैं हिंदी में बात करूँगी।", te: "సరే, ఇకపై తెలుగులో మాట్లాడుతాను." },
  blockedSensitive: {
    en: "For your safety, I can't enter, read or store passwords, OTPs, Aadhaar numbers or ABHA credentials. Please type those yourself, only on official screens you trust.",
    hi: "आपकी सुरक्षा के लिए मैं पासवर्ड, OTP, आधार नंबर या ABHA विवरण न भरती हूँ, न पढ़ती हूँ, न सेव करती हूँ। इन्हें केवल भरोसेमंद आधिकारिक स्क्रीन पर ख़ुद टाइप करें।",
    te: "మీ భద్రత కోసం పాస్‌వర్డ్‌లు, OTPలు, ఆధార్ నంబర్లు లేదా ABHA వివరాలను నేను నమోదు చేయను, చదవను, సేవ్ చేయను. వాటిని నమ్మకమైన అధికారిక స్క్రీన్‌లలో మాత్రమే మీరే టైప్ చేయండి.",
  },
  unknown: {
    en: "Sorry, I didn't understand that. You can say “show my health records”, “find hospitals in Hyderabad” or “what can I do on this page?”.",
    hi: "माफ़ कीजिए, मैं समझ नहीं पाई। आप कह सकते हैं “मेरे हेल्थ रिकॉर्ड दिखाओ”, “हैदराबाद में अस्पताल खोजो” या “मदद”।",
    te: "క్షమించండి, అర్థం కాలేదు. మీరు “నా హెల్త్ రికార్డ్స్ చూపించు”, “హైదరాబాద్‌లో ఆసుపత్రులు వెతుకు” లేదా “సహాయం” అని చెప్పవచ్చు.",
  },
  navFailed: { en: "I tried to open that page, but it didn't load. Please try again.", hi: "मैंने वह पेज खोलने की कोशिश की, पर वह लोड नहीं हुआ। कृपया फिर कोशिश करें।", te: "ఆ పేజీ తెరవడానికి ప్రయత్నించాను, కానీ అది లోడ్ కాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి." },
  networkError: { en: "I couldn't reach the server. Please check your connection.", hi: "सर्वर से संपर्क नहीं हो सका। कृपया अपना कनेक्शन जाँचें।", te: "సర్వర్‌ను చేరుకోలేకపోయాను. దయచేసి మీ కనెక్షన్ చూడండి." },
  sessionExpired: { en: "Your session has ended. Please sign in again.", hi: "आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।", te: "మీ సెషన్ ముగిసింది. దయచేసి మళ్ళీ సైన్ ఇన్ చేయండి." },
  openingPatients: { en: "Opening your patients.", hi: "आपके मरीज़ खोल रही हूँ।", te: "మీ రోగుల జాబితా తెరుస్తున్నాను." },
  openingPatient: { en: "Opening {name}.", hi: "{name} को खोल रही हूँ।", te: "{name} వివరాలు తెరుస్తున్నాను." },
  openingRegisterPatient: { en: "Opening patient registration. Fill in the details and press Register yourself.", hi: "मरीज़ पंजीकरण खोल रही हूँ। विवरण भरें और रजिस्टर ख़ुद दबाएँ।", te: "రోగి నమోదు ఫారమ్ తెరుస్తున్నాను. వివరాలు నింపి రిజిస్టర్ మీరే నొక్కండి." },
  onlyAshaRegisters: { en: "Only ASHA workers can register patients. I've opened your patient list.", hi: "मरीज़ों का पंजीकरण केवल आशा कार्यकर्ता कर सकती हैं। मैंने आपकी मरीज़ सूची खोल दी है।", te: "రోగులను నమోదు చేయడం ఆశా కార్యకర్తలు మాత్రమే చేయగలరు. మీ రోగుల జాబితా తెరిచాను." },
  notForPatients: { en: "That's for doctors and ASHA workers. You can say “show my health records”.", hi: "यह डॉक्टरों और आशा कार्यकर्ताओं के लिए है। आप कह सकते हैं “मेरी मेडिकल रिपोर्ट दिखाओ”।", te: "ఇది డాక్టర్లు, ఆశా కార్యకర్తల కోసం. మీరు “నా హెల్త్ రికార్డ్స్ చూపించు” అని చెప్పవచ్చు." },
  careNotAvailable: { en: "That's in the patient's own app. You can say “open my patients”.", hi: "यह मरीज़ के अपने ऐप में है। आप कह सकते हैं “मेरे मरीज़ दिखाओ”।", te: "అది రోగి యాప్‌లో ఉంటుంది. మీరు “నా రోగులను చూపించు” అని చెప్పవచ్చు." },
  careOpenRecordFirst: { en: "Open a patient's record first, then say “explain it”.", hi: "पहले मरीज़ का कोई रिकॉर्ड खोलें, फिर कहें “इसे समझाओ”।", te: "ముందు రోగి రికార్డ్ తెరవండి, తర్వాత “దీన్ని వివరించు” అని చెప్పండి." },
  openingHelp: { en: "Opening the voice command guide.", hi: "वॉइस कमांड गाइड खोल रही हूँ।", te: "వాయిస్ కమాండ్ గైడ్ తెరుస్తున్నాను." },
};

export const DIR_WORDS: Record<string, Record<Lang, string>> = {
  down: { en: "down", hi: "नीचे", te: "కిందకి" },
  up: { en: "up", hi: "ऊपर", te: "పైకి" },
  top: { en: "to the top", hi: "सबसे ऊपर", te: "పైభాగానికి" },
  bottom: { en: "to the bottom", hi: "सबसे नीचे", te: "చివరికి" },
};
export const EDGE_WORDS: Record<"top" | "bottom", Record<Lang, string>> = {
  top: { en: "top", hi: "सबसे ऊपर", te: "పైభాగంలో" },
  bottom: { en: "bottom", hi: "सबसे नीचे", te: "చివరలో" },
};

export const FIELD_LABELS: Record<string, Record<Lang, string>> = {
  city: { en: "city", hi: "शहर", te: "నగరం" },
  preferredLanguage: { en: "preferred language", hi: "पसंदीदा भाषा", te: "ఇష్టమైన భాష" },
  textScale: { en: "text size", hi: "अक्षरों का आकार", te: "అక్షరాల పరిమాణం" },
  voiceResponses: { en: "voice responses", hi: "आवाज़ में जवाब", te: "వాయిస్ సమాధానాలు" },
  department: { en: "department", hi: "विभाग", te: "విభాగం" },
  preferredDate: { en: "preferred date", hi: "पसंदीदा तारीख", te: "ఇష్టమైన తేదీ" },
};

export const VALUE_LABELS: Record<string, Record<Lang, string>> = {
  en: { en: "English", hi: "अंग्रेज़ी", te: "ఇంగ్లీష్" },
  hi: { en: "Hindi", hi: "हिंदी", te: "హిందీ" },
  te: { en: "Telugu", hi: "तेलुगु", te: "తెలుగు" },
  normal: { en: "normal", hi: "सामान्य", te: "సాధారణ" },
  large: { en: "large", hi: "बड़ा", te: "పెద్ద" },
  xlarge: { en: "extra large", hi: "बहुत बड़ा", te: "చాలా పెద్ద" },
  true: { en: "on", hi: "चालू", te: "ఆన్" },
  false: { en: "off", hi: "बंद", te: "ఆఫ్" },
};

export const CATEGORY_LABELS: Record<RecordCategory, Record<Lang, string>> = {
  blood_test: { en: "blood test", hi: "ब्लड टेस्ट", te: "బ్లడ్ టెస్ట్" },
  diabetes: { en: "blood sugar", hi: "ब्लड शुगर", te: "బ్లడ్ షుగర్" },
  lipid: { en: "cholesterol", hi: "कोलेस्ट्रॉल", te: "కొలెస్ట్రాల్" },
  thyroid: { en: "thyroid", hi: "थायरॉइड", te: "థైరాయిడ్" },
  consultation: { en: "consultation summary", hi: "परामर्श सारांश", te: "కన్సల్టేషన్ సారాంశం" },
  prescription: { en: "prescription", hi: "प्रिस्क्रिप्शन", te: "ప్రిస్క్రిప్షన్" },
  chest_xray: { en: "chest X-ray", hi: "छाती का एक्स-रे", te: "ఛాతీ ఎక్స్-రే" },
  bp_log: { en: "blood pressure log", hi: "ब्लड प्रेशर लॉग", te: "బీపీ లాగ్" },
};

export function t(lang: Lang, key: keyof typeof R | string, vars: Record<string, string | number> = {}): string {
  const entry = R[key];
  const template = entry ? entry[lang] ?? entry.en : key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : "")).replace(/\s+([।.,])/g, "$1").trim();
}

/** Page-aware help for "what can I do on this page?" */
export function pageHelp(path: string, lang: Lang): string {
  const page = path.startsWith("/records/") ? "detail" : path.split("/")[1] || "dashboard";
  const H: Record<string, Record<Lang, string>> = {
    dashboard: {
      en: "This is your dashboard. You can say: show my health records, show my appointments, find hospitals in Hyderabad, or open my profile.",
      hi: "यह आपका डैशबोर्ड है। आप कह सकते हैं: मेरे हेल्थ रिकॉर्ड दिखाओ, मेरे अपॉइंटमेंट दिखाओ, हैदराबाद में अस्पताल खोजो, या मेरी प्रोफ़ाइल खोलो।",
      te: "ఇది మీ డాష్‌బోర్డ్. మీరు ఇలా చెప్పవచ్చు: నా హెల్త్ రికార్డ్స్ చూపించు, నా అపాయింట్‌మెంట్స్ చూపించు, హైదరాబాద్‌లో ఆసుపత్రులు వెతుకు, లేదా నా ప్రొఫైల్ తెరువు.",
    },
    records: {
      en: "This page lists your records, newest first. Say: open the latest one, open the second one, or open my blood test report.",
      hi: "इस पेज पर आपके रिकॉर्ड हैं, सबसे नया पहले। बोलें: सबसे नया वाला खोलो, दूसरा वाला खोलो, या मेरी ब्लड टेस्ट रिपोर्ट खोलो।",
      te: "ఈ పేజీలో మీ రికార్డ్స్ ఉన్నాయి, తాజావి ముందు. ఇలా చెప్పండి: లేటెస్ట్ ది తెరువు, రెండవది తెరువు, లేదా నా బ్లడ్ టెస్ట్ రిపోర్ట్ తెరువు.",
    },
    detail: {
      en: "This is a single record. Say: explain it, explain it in Telugu, or go back.",
      hi: "यह एक रिकॉर्ड है। बोलें: इसे समझाओ, इसे तेलुगु में समझाओ, या पीछे जाओ।",
      te: "ఇది ఒక రికార్డ్. ఇలా చెప్పండి: దీన్ని వివరించు, హిందీలో వివరించు, లేదా వెనక్కి వెళ్ళు.",
    },
    facilities: {
      en: "Search healthcare facilities. Say: find hospitals in Visakhapatnam, show clinics in Hyderabad, or find pharmacies.",
      hi: "स्वास्थ्य केंद्र खोजें। बोलें: विशाखापत्तनम में अस्पताल खोजो, हैदराबाद में क्लिनिक दिखाओ।",
      te: "ఆరోగ్య కేంద్రాలు వెతకండి. ఇలా చెప్పండి: విశాఖపట్నంలో ఆసుపత్రులు వెతుకు, హైదరాబాద్‌లో క్లినిక్‌లు చూపించు.",
    },
    appointments: {
      en: "See your appointments. Say: open appointment booking. In the form, say: set department to cardiology, or set date to tomorrow. You press Submit yourself.",
      hi: "अपने अपॉइंटमेंट देखें। बोलें: अपॉइंटमेंट बुकिंग खोलो। फ़ॉर्म में बोलें: विभाग हृदय करो, या तारीख कल करो। सबमिट आप ख़ुद दबाएँगे।",
      te: "మీ అపాయింట్‌మెంట్స్ చూడండి. ఇలా చెప్పండి: అపాయింట్‌మెంట్ బుకింగ్ తెరువు. ఫారమ్‌లో: విభాగం కార్డియాలజీ పెట్టు, తేదీ రేపు పెట్టు. సబ్మిట్ మీరే నొక్కాలి.",
    },
    profile: {
      en: "Change your preferences by voice. Say: set my city to Visakhapatnam, set my preferred language to Telugu, or make the text large. I will ask before saving.",
      hi: "आवाज़ से अपनी पसंद बदलें। बोलें: मेरा शहर हैदराबाद करो, मेरी पसंदीदा भाषा हिंदी करो, या अक्षर बड़े करो। सेव करने से पहले मैं पूछूँगी।",
      te: "వాయిస్‌తో మీ ప్రాధాన్యతలు మార్చండి. ఇలా చెప్పండి: నా నగరం విశాఖపట్నం కి మార్చు, నా ఇష్టమైన భాష తెలుగు కి మార్చు, లేదా అక్షరాలు పెద్దవి చేయి. సేవ్ చేసే ముందు నేను అడుగుతాను.",
    },
  };
  return (H[page] ?? H.dashboard)[lang];
}
