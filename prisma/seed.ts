// Seeds sample accounts and records. All people, IDs and facilities are fictional.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "../src/server/crypto";

export const SEED_PASSWORD = "Sushra@123";

export async function seed(url = process.env.DATABASE_URL ?? "file:./dev.db") {
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    // Wipe in dependency order (seed database only)
    await prisma.auditEvent.deleteMany();
    await prisma.doctorProfile.deleteMany();
    await prisma.ashaProfile.deleteMany();
    await prisma.consentRecord.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.labResult.deleteMany();
    await prisma.healthRecord.deleteMany();
    await prisma.facility.deleteMany();
    await prisma.userPreference.deleteMany();
    await prisma.patientProfile.deleteMany();
    await prisma.user.deleteMany();

    // ---------- Facilities (fictional names) ----------
    const F = (name: string, facilityType: string, ownership: string, city: string, state: string, address: string, services: string, openHours = "Mon–Sat, 9:00–17:00") => ({
      name, facilityType, ownership, city, state, address, phone: "", services, openHours, isDemo: true,
    });
    const facilityData = [
      F("Sagara Coast Multispeciality Hospital", "HOSPITAL", "PRIVATE", "Visakhapatnam", "Andhra Pradesh", "Beach Road, Sector 4", "General Medicine, Cardiology, Orthopaedics, Emergency, Diabetology", "24×7"),
      F("Visakha District Government Hospital", "HOSPITAL", "GOVERNMENT", "Visakhapatnam", "Andhra Pradesh", "Hospital Lane, Ward 12", "General Medicine, Paediatrics, Gynaecology, Emergency, Dental", "24×7"),
      F("Rushikonda Primary Health Centre", "PHC", "GOVERNMENT", "Visakhapatnam", "Andhra Pradesh", "Village Road", "General Medicine, Immunisation, Maternal care"),
      F("Seaside Diagnostics Lab", "DIAGNOSTIC_LAB", "PRIVATE", "Visakhapatnam", "Andhra Pradesh", "Main Road", "Blood tests, Thyroid profile, Lipid profile, X-ray"),
      F("Charminar Care Hospital", "HOSPITAL", "PRIVATE", "Hyderabad", "Telangana", "Old City Road", "General Medicine, Cardiology, Ophthalmology, ENT, Emergency", "24×7"),
      F("Deccan Government General Hospital", "HOSPITAL", "GOVERNMENT", "Hyderabad", "Telangana", "Civic Centre", "General Medicine, Orthopaedics, Paediatrics, Gynaecology, Dermatology, Emergency", "24×7"),
      F("Banjara Family Clinic", "CLINIC", "PRIVATE", "Hyderabad", "Telangana", "Road No. 3, Banjara Hills", "General Medicine, Paediatrics, Diabetology"),
      F("Hussain Sagar Diagnostics", "DIAGNOSTIC_LAB", "PRIVATE", "Hyderabad", "Telangana", "Lake View Road", "Blood tests, Ultrasound, X-ray, ECG"),
      F("Krishna River Hospital", "HOSPITAL", "PRIVATE", "Vijayawada", "Andhra Pradesh", "Riverside Road", "General Medicine, Cardiology, Ophthalmology, Diabetology", "24×7"),
      F("Indrakeeladri Health Clinic", "CLINIC", "PRIVATE", "Vijayawada", "Andhra Pradesh", "Temple Street", "General Medicine, Dermatology"),
      F("Guntur Community Health Centre", "PHC", "GOVERNMENT", "Guntur", "Andhra Pradesh", "Market Road", "General Medicine, Maternal care, Immunisation"),
      F("Kakatiya Heritage Hospital", "HOSPITAL", "GOVERNMENT", "Warangal", "Telangana", "Fort Road", "General Medicine, Orthopaedics, Emergency", "24×7"),
      F("Seven Hills Eye & ENT Clinic", "CLINIC", "PRIVATE", "Tirupati", "Andhra Pradesh", "Hill Road", "Ophthalmology, ENT"),
      F("Yamuna City Hospital", "HOSPITAL", "PRIVATE", "Delhi", "Delhi", "Ring Road", "General Medicine, Cardiology, Orthopaedics, Emergency", "24×7"),
      F("Gomti Nagar Polyclinic", "CLINIC", "PRIVATE", "Lucknow", "Uttar Pradesh", "Vibhuti Khand", "General Medicine, Paediatrics, Dental"),
      F("Ganga Ghat Government Hospital", "HOSPITAL", "GOVERNMENT", "Varanasi", "Uttar Pradesh", "Ghat Road", "General Medicine, Gynaecology, Emergency", "24×7"),
      F("Jan Seva Generic Pharmacy", "PHARMACY", "PRIVATE", "Hyderabad", "Telangana", "Market Complex", "Generic medicines"),
    ];
    const facilities = [] as { id: string; name: string; city: string }[];
    for (const f of facilityData) facilities.push(await prisma.facility.create({ data: f }));
    const fac = (name: string) => facilities.find((f) => f.name.startsWith(name))!;

    // ---------- Users ----------
    // Fixed IDs: a signed-in demo session stays valid if the server restarts and re-seeds.
    const lakshmi = await prisma.user.create({
      data: {
        id: "demo-patient-lakshmi",
        email: "lakshmi@sushra.in",
        phone: "9000000001",
        role: "PATIENT",
        displayName: "Lakshmi",
        passwordHash: hashPassword(SEED_PASSWORD),
        profile: {
          create: {
            fullName: "Lakshmi Devi Konda",
            gender: "Female",
            yearOfBirth: 1961,
            bloodGroup: "B+",
            healthId: "SU-7K2P9Q",
            phoneMasked: "+91 ••••• ••001",
            state: "Andhra Pradesh",
            city: "Vijayawada",
          },
        },
        preferences: { create: { preferredLanguage: "en", city: "Vijayawada", textScale: "normal", voiceResponses: true } },
      },
      include: { profile: true },
    });
    const ravi = await prisma.user.create({
      data: {
        id: "demo-patient-ravi",
        email: "ravi@sushra.in",
        phone: "9000000002",
        role: "PATIENT",
        displayName: "Ravi",
        passwordHash: hashPassword(SEED_PASSWORD),
        profile: {
          create: {
            fullName: "Ravi Shankar Varma",
            gender: "Male",
            yearOfBirth: 1978,
            bloodGroup: "O+",
            healthId: "SU-3M8T4L",
            phoneMasked: "+91 ••••• ••002",
            state: "Uttar Pradesh",
            city: "Lucknow",
          },
        },
        preferences: { create: { preferredLanguage: "hi", city: "Lucknow" } },
      },
      include: { profile: true },
    });
    const L = lakshmi.profile!.id;
    const R = ravi.profile!.id;

    type Lab = { code: string; name: string; value?: number; valueText?: string; unit: string; low?: number; high?: number; refText?: string };
    async function rec(patientId: string, r: {
      recordType: string; category: string; title: string; date: string; facility: string; authorType: string; authorName: string;
      source?: string; verification?: string; authorUserId?: string; summary: string; keywords: string; details?: object; labs?: Lab[];
    }) {
      return prisma.healthRecord.create({
        data: {
          patientId,
          recordType: r.recordType,
          category: r.category,
          title: r.title,
          recordDate: new Date(r.date),
          facilityName: r.facility,
          authorType: r.authorType,
          authorName: r.authorName,
          source: r.source ?? "PROVIDER",
          verificationStatus: r.verification ?? "PROVIDER_ISSUED",
          authorUserId: r.authorUserId,
          summary: r.summary,
          keywords: r.keywords,
          detailsJson: JSON.stringify(r.details ?? {}),
          labResults: r.labs
            ? { create: r.labs.map((l, i) => ({ testCode: l.code, testName: l.name, value: l.value ?? null, valueText: l.valueText ?? null, unit: l.unit, refLow: l.low ?? null, refHigh: l.high ?? null, refText: l.refText ?? null, sortOrder: i })) }
            : undefined,
        },
      });
    }

    const KW_BLOOD = "blood test cbc complete blood count hemoglobin haemoglobin ब्लड टेस्ट खून की जांच रक्त బ్లడ్ టెస్ట్ రక్త పరీక్ష";
    // ---------- Lakshmi's records ----------
    await rec(L, {
      recordType: "LAB_REPORT", category: "blood_test", title: "Complete Blood Count (CBC)", date: "2026-11-18T09:30:00+05:30",
      facility: "Seaside Diagnostics Lab", authorType: "LABORATORY", authorName: "Pathology Dept.",
      summary: "Routine CBC. Haemoglobin and MCV below the lab reference range; other values within range.", keywords: KW_BLOOD,
      labs: [
        { code: "HGB", name: "Haemoglobin", value: 10.9, unit: "g/dL", low: 12.0, high: 15.5 },
        { code: "RBC", name: "Red blood cell count", value: 4.1, unit: "million/µL", low: 4.0, high: 5.2 },
        { code: "MCV", name: "Mean corpuscular volume (MCV)", value: 76, unit: "fL", low: 80, high: 100 },
        { code: "WBC", name: "White blood cell count", value: 7.2, unit: "×10³/µL", low: 4.0, high: 11.0 },
        { code: "PLT", name: "Platelet count", value: 245, unit: "×10³/µL", low: 150, high: 410 },
      ],
    });
    await rec(L, {
      recordType: "LAB_REPORT", category: "blood_test", title: "Complete Blood Count (CBC)", date: "2026-04-12T08:45:00+05:30",
      facility: "Krishna River Hospital", authorType: "LABORATORY", authorName: "Hospital Laboratory",
      summary: "Routine CBC. Haemoglobin slightly below the lab reference range.", keywords: KW_BLOOD,
      labs: [
        { code: "HGB", name: "Haemoglobin", value: 11.6, unit: "g/dL", low: 12.0, high: 15.5 },
        { code: "RBC", name: "Red blood cell count", value: 4.3, unit: "million/µL", low: 4.0, high: 5.2 },
        { code: "MCV", name: "Mean corpuscular volume (MCV)", value: 81, unit: "fL", low: 80, high: 100 },
        { code: "WBC", name: "White blood cell count", value: 6.8, unit: "×10³/µL", low: 4.0, high: 11.0 },
        { code: "PLT", name: "Platelet count", value: 262, unit: "×10³/µL", low: 150, high: 410 },
      ],
    });
    await rec(L, {
      recordType: "LAB_REPORT", category: "diabetes", title: "Blood Sugar Panel (Fasting glucose & HbA1c)", date: "2026-11-18T09:15:00+05:30",
      facility: "Seaside Diagnostics Lab", authorType: "LABORATORY", authorName: "Biochemistry Dept.",
      summary: "Fasting glucose and HbA1c above the lab reference range.",
      keywords: "sugar glucose diabetes hba1c शुगर मधुमेह डायबिटीज़ షుగర్ చక్కెర మధుమేహం డయాబెటిస్",
      labs: [
        { code: "FBS", name: "Fasting blood glucose", value: 132, unit: "mg/dL", low: 70, high: 99 },
        { code: "HBA1C", name: "HbA1c (glycated haemoglobin)", value: 7.1, unit: "%", high: 5.6, refText: "Below 5.7% (as printed by lab)" },
      ],
    });
    await rec(L, {
      recordType: "LAB_REPORT", category: "lipid", title: "Lipid Profile", date: "2026-09-15T08:15:00+05:30",
      facility: "Krishna River Hospital", authorType: "LABORATORY", authorName: "Hospital Laboratory",
      summary: "Total cholesterol, LDL and triglycerides above the lab reference values; HDL within range.",
      keywords: "lipid cholesterol ldl hdl triglycerides कोलेस्ट्रॉल लिपिड కొలెస్ట్రాల్ లిపిడ్",
      labs: [
        { code: "TCHOL", name: "Total cholesterol", value: 214, unit: "mg/dL", high: 199, refText: "Below 200" },
        { code: "LDL", name: "LDL cholesterol", value: 138, unit: "mg/dL", high: 99, refText: "Below 100" },
        { code: "HDL", name: "HDL cholesterol", value: 46, unit: "mg/dL", low: 40, refText: "40 or above" },
        { code: "TG", name: "Triglycerides", value: 162, unit: "mg/dL", high: 149, refText: "Below 150" },
      ],
    });
    await rec(L, {
      recordType: "LAB_REPORT", category: "thyroid", title: "Thyroid Function Test", date: "2026-06-20T10:00:00+05:30",
      facility: "Seaside Diagnostics Lab", authorType: "LABORATORY", authorName: "Biochemistry Dept.",
      summary: "TSH and free T4 within the lab reference range.", keywords: "thyroid tsh t4 थायरॉइड థైరాయిడ్",
      labs: [
        { code: "TSH", name: "Thyroid stimulating hormone (TSH)", value: 2.8, unit: "µIU/mL", low: 0.4, high: 4.0 },
        { code: "FT4", name: "Free T4", value: 1.2, unit: "ng/dL", low: 0.8, high: 1.8 },
      ],
    });
    await rec(L, {
      recordType: "CONSULTATION", category: "consultation", title: "General Medicine Consultation Summary", date: "2026-11-02T11:20:00+05:30",
      facility: "Krishna River Hospital", authorType: "CLINICIAN", authorName: "Dr. A. Srinivas",
      summary: "Visit for tiredness. Doctor advised blood tests (CBC, blood sugar), diet changes, an iron supplement and review in 4 weeks.",
      keywords: "consultation doctor visit summary परामर्श डॉक्टर కన్సల్టేషన్ డాక్టర్",
      details: {
        chiefComplaint: "Tiredness for 2 months",
        clinicianNotes: "Previous CBC (Apr 2026) showed mildly low haemoglobin. Advised repeat CBC and blood sugar tests. Discussed diet and activity.",
        plan: ["CBC and blood sugar tests", "Iron and folic acid supplement as prescribed", "Diet counselling"],
        followUp: "Review in 4 weeks",
        explain: {
          en: "This is a summary written by your doctor after your visit on 2 November 2026. You came because you were feeling tired. The doctor asked for blood tests, talked about food and activity, and planned a follow-up visit in about 4 weeks.",
          hi: "यह 2 नवंबर 2026 की मुलाक़ात के बाद आपके डॉक्टर का लिखा सारांश है। आप थकान की वजह से आई थीं। डॉक्टर ने खून की जाँच कराने को कहा, खाने और व्यायाम के बारे में बात की, और लगभग 4 हफ़्ते बाद दोबारा मिलने की योजना बनाई।",
          te: "ఇది 2 నవంబర్ 2026 నాటి మీ సందర్శన తర్వాత మీ డాక్టర్ రాసిన సారాంశం. మీరు అలసటగా ఉందని వచ్చారు. డాక్టర్ రక్త పరీక్షలు చేయించుకోమని చెప్పారు, ఆహారం మరియు వ్యాయామం గురించి మాట్లాడారు, సుమారు 4 వారాల తర్వాత మళ్ళీ రావాలని సూచించారు.",
        },
      },
    });
    await rec(L, {
      recordType: "PRESCRIPTION", category: "prescription", title: "Prescription — General Medicine", date: "2026-11-02T11:35:00+05:30",
      facility: "Krishna River Hospital", authorType: "CLINICIAN", authorName: "Dr. A. Srinivas",
      summary: "2 medicines prescribed by the treating clinician (synthetic record).",
      keywords: "prescription medicine tablets दवा पर्चा प्रिस्क्रिप्शन మందులు ప్రిస్క్రిప్షన్",
      details: {
        medications: [
          { name: "Iron + Folic acid tablet", dose: "1 tablet", frequency: "Once daily after lunch", duration: "3 months" },
          { name: "Metformin 500 mg", dose: "1 tablet", frequency: "Twice daily after meals", duration: "Until review" },
        ],
        explain: {
          en: "This prescription lists 2 medicines your doctor wrote on 2 November 2026. Take them exactly as written on the prescription. Do not start, stop or change any medicine without talking to your doctor or pharmacist.",
          hi: "इस पर्चे में 2 दवाइयाँ हैं जो आपके डॉक्टर ने 2 नवंबर 2026 को लिखीं। इन्हें ठीक वैसे ही लें जैसा पर्चे में लिखा है। डॉक्टर या फ़ार्मासिस्ट से बात किए बिना कोई दवा शुरू, बंद या बदलें नहीं।",
          te: "ఈ ప్రిస్క్రిప్షన్‌లో మీ డాక్టర్ 2 నవంబర్ 2026న రాసిన 2 మందులు ఉన్నాయి. వాటిని ప్రిస్క్రిప్షన్‌లో రాసినట్లే వాడండి. డాక్టర్ లేదా ఫార్మసిస్ట్‌తో మాట్లాడకుండా ఏ మందునూ మొదలుపెట్టవద్దు, ఆపవద్దు, మార్చవద్దు.",
        },
      },
    });
    await rec(L, {
      recordType: "IMAGING", category: "chest_xray", title: "Chest X-ray (PA view) Report", date: "2026-03-08T16:00:00+05:30",
      facility: "Krishna River Hospital", authorType: "CLINICIAN", authorName: "Dr. M. Rao, Radiology",
      summary: "Impression: No active lung lesion seen. Heart size within normal limits.",
      keywords: "xray x-ray chest lungs एक्स-रे छाती ఎక్స్-రే ఛాతీ",
      details: {
        findings: "Lung fields clear. No consolidation or effusion. Cardiac silhouette within normal limits.",
        impression: "No active lung lesion seen.",
        explain: {
          en: "This is a radiologist's report on your chest X-ray from 8 March 2026. The report says the lungs look clear and the heart size looks normal on the image. Your doctor can tell you what this means together with your symptoms.",
          hi: "यह 8 मार्च 2026 के आपके छाती के एक्स-रे पर रेडियोलॉजिस्ट की रिपोर्ट है। रिपोर्ट के अनुसार फेफड़े साफ़ दिख रहे हैं और दिल का आकार सामान्य दिख रहा है। आपके लक्षणों के साथ इसका मतलब आपके डॉक्टर बता सकते हैं।",
          te: "ఇది 8 మార్చి 2026 నాటి మీ ఛాతీ ఎక్స్-రే పై రేడియాలజిస్ట్ రిపోర్ట్. రిపోర్ట్ ప్రకారం ఊపిరితిత్తులు స్పష్టంగా ఉన్నాయి, గుండె పరిమాణం సాధారణంగా కనిపిస్తోంది. మీ లక్షణాలతో కలిపి దీని అర్థం ఏమిటో మీ డాక్టర్ చెప్పగలరు.",
        },
      },
    });
    await rec(L, {
      recordType: "PATIENT_NOTE", category: "bp_log", title: "Home Blood Pressure Log (self-entered)", date: "2026-11-10T20:00:00+05:30",
      facility: "Home (patient-entered)", authorType: "PATIENT", authorName: "Lakshmi (self)", source: "PATIENT_ENTERED", verification: "PATIENT_REPORTED",
      summary: "7 home readings entered by the patient. Not verified by a clinician.",
      keywords: "bp blood pressure log home बीपी ब्लड प्रेशर బీపీ రక్తపోటు",
      details: {
        readings: [
          { date: "2026-11-04", value: "128/82" }, { date: "2026-11-05", value: "132/84" }, { date: "2026-11-06", value: "126/80" },
          { date: "2026-11-07", value: "134/86" }, { date: "2026-11-08", value: "130/82" }, { date: "2026-11-09", value: "127/81" }, { date: "2026-11-10", value: "129/83" },
        ],
        explain: {
          en: "These are blood pressure readings you entered yourself at home. They have not been checked by a clinician. Share them with your doctor at your next visit.",
          hi: "ये ब्लड प्रेशर रीडिंग आपने घर पर खुद दर्ज की हैं। किसी डॉक्टर ने इनकी जाँच नहीं की है। अगली मुलाक़ात में इन्हें अपने डॉक्टर को दिखाएँ।",
          te: "ఇవి మీరు ఇంట్లో స్వయంగా నమోదు చేసిన బీపీ రీడింగ్‌లు. వీటిని ఏ డాక్టర్ పరిశీలించలేదు. మీ తదుపరి సందర్శనలో వీటిని మీ డాక్టర్‌కు చూపించండి.",
        },
      },
    });

    // ---------- Ravi's records (for access-control testing) ----------
    await rec(R, {
      recordType: "LAB_REPORT", category: "blood_test", title: "Complete Blood Count (CBC)", date: "2026-08-02T09:00:00+05:30",
      facility: "Gomti Nagar Polyclinic", authorType: "LABORATORY", authorName: "Central Laboratory", summary: "All values within range.", keywords: KW_BLOOD,
      labs: [{ code: "HGB", name: "Haemoglobin", value: 14.6, unit: "g/dL", low: 13.0, high: 17.0 }],
    });
    await rec(R, {
      recordType: "CONSULTATION", category: "consultation", title: "Orthopaedics Consultation", date: "2026-07-14T12:00:00+05:30",
      facility: "Gomti Nagar Polyclinic", authorType: "CLINICIAN", authorName: "Dr. P. Mishra", summary: "Knee pain review.", keywords: "consultation knee",
    });

    // ---------- Appointments ----------
    await prisma.appointment.createMany({
      data: [
        { patientId: L, facilityId: fac("Krishna River Hospital").id, department: "General Medicine", doctorName: "Dr. A. Srinivas", scheduledAt: new Date("2026-12-01T10:30:00+05:30"), status: "SCHEDULED", notes: "Follow-up for tiredness" },
        { patientId: L, facilityId: fac("Charminar Care Hospital").id, department: "Ophthalmology", doctorName: "Dr. S. Reddy", scheduledAt: new Date("2026-12-15T15:00:00+05:30"), status: "SCHEDULED", notes: "Annual eye check" },
        { patientId: L, facilityId: fac("Krishna River Hospital").id, department: "General Medicine", doctorName: "Dr. A. Srinivas", scheduledAt: new Date("2026-11-02T11:00:00+05:30"), status: "COMPLETED" },
        { patientId: R, facilityId: fac("Gomti Nagar Polyclinic").id, department: "Orthopaedics", scheduledAt: new Date("2026-12-05T09:30:00+05:30"), status: "SCHEDULED" },
      ],
    });

    // ---------- Care team ----------
    const doctor = await prisma.user.create({
      data: {
        id: "demo-doctor-srinivas",
        role: "DOCTOR", email: "dr.srinivas@sushra.in", phone: "9000000003", displayName: "Dr. Srinivas", passwordHash: hashPassword(SEED_PASSWORD),
        doctorProfile: { create: { fullName: "Dr. A. Srinivas", registrationNumber: "APMC/2009/45123", specialization: "General Medicine", facilityName: "Krishna River Hospital", city: "Vijayawada", verificationStatus: "VERIFIED" } },
        preferences: { create: { preferredLanguage: "en", city: "Vijayawada" } },
      },
    });
    const asha = await prisma.user.create({
      data: {
        id: "demo-asha-padma",
        role: "ASHA", email: "padma.asha@sushra.in", phone: "9000000004", displayName: "Padma", passwordHash: hashPassword(SEED_PASSWORD),
        ashaProfile: { create: { fullName: "Padma Kumari", ashaId: "AP-NTR-0457", village: "Gollapudi", district: "Vijayawada", phcName: "Gollapudi Primary Health Centre" } },
        preferences: { create: { preferredLanguage: "te", city: "Vijayawada" } },
      },
    });
    const inMonths = (m: number) => new Date(Date.now() + m * 30 * 864e5);
    await prisma.consentRecord.createMany({
      data: [
        { patientId: L, purpose: "CARE_ACCESS", scope: "All health records (view) and adding consultation notes", grantedTo: "Dr. A. Srinivas", grantedToUserId: doctor.id, recordedByUserId: lakshmi.id, status: "GRANTED", expiresAt: inMonths(6) },
        { patientId: L, purpose: "CARE_ACCESS", scope: "All health records (view) and recording home visits", grantedTo: "Padma Kumari (ASHA)", grantedToUserId: asha.id, recordedByUserId: lakshmi.id, status: "GRANTED", expiresAt: inMonths(12) },
        { patientId: L, purpose: "SHARE_WITH_FACILITY", scope: "Lab reports (2026)", grantedTo: "Krishna River Hospital", status: "GRANTED", expiresAt: new Date("2027-04-30T00:00:00+05:30") },
      ],
    });
    await rec(L, {
      recordType: "HOME_VISIT", category: "home_visit", title: "ASHA Home Visit", date: "2026-11-14T10:30:00+05:30",
      facility: "Home visit · Gollapudi", authorType: "ASHA", authorName: "Padma Kumari (ASHA)", source: "ASHA_ENTERED", verification: "ASHA_RECORDED", authorUserId: asha.id,
      summary: "BP 130/84 mmHg, weight 58 kg. Reminded about the blood tests and the follow-up visit.",
      keywords: "asha home visit vitals ఆశా ఇంటి సందర్శన आशा घर",
      details: {
        vitals: { bp: "130/84 mmHg", weight: "58 kg" },
        notes: "Reminded about the blood tests and the follow-up visit.",
        explain: {
          en: "This is a home visit note recorded by your ASHA worker Padma Kumari on 14 November 2026. Your blood pressure was 130/84 and your weight was 58 kg. These are home readings, not a diagnosis. Share them with your doctor.",
          hi: "यह 14 नवंबर 2026 को आपकी आशा कार्यकर्ता पद्मा कुमारी द्वारा दर्ज घर की मुलाक़ात का नोट है। आपका ब्लड प्रेशर 130/84 और वज़न 58 किलो था। ये घर पर ली गई रीडिंग हैं, निदान नहीं। इन्हें अपने डॉक्टर को दिखाएँ।",
          te: "ఇది 14 నవంబర్ 2026న మీ ఆశా కార్యకర్త పద్మ కుమారి నమోదు చేసిన ఇంటి సందర్శన నోట్. మీ బీపీ 130/84, బరువు 58 కిలోలు. ఇవి ఇంట్లో తీసిన రీడింగ్‌లు, రోగనిర్ధారణ కాదు. వీటిని మీ డాక్టర్‌కు చూపించండి.",
        },
      },
    });

    await prisma.auditEvent.createMany({
      data: [
        { userId: lakshmi.id, action: "RECORD_ADDED", entity: "HealthRecord", channel: "UI", outcome: "SUCCESS", createdAt: new Date("2026-11-10T20:01:00+05:30") },
        { userId: lakshmi.id, action: "CARE_ACCESS_GRANTED", entity: "ConsentRecord", channel: "UI", outcome: "SUCCESS", createdAt: new Date("2026-11-02T12:00:00+05:30") },
      ],
    });

    return { lakshmiId: lakshmi.id, raviId: ravi.id, lakshmiPatientId: L, raviPatientId: R, doctorId: doctor.id, ashaId: asha.id };
  } finally {
    await prisma.$disconnect();
  }
}

// Run directly: `tsx prisma/seed.ts`
if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  seed()
    .then(() =>
      console.log(
        "✔ Seeded sample data. Password for all: " + SEED_PASSWORD +
          "\n  Patient: lakshmi@sushra.in · Doctor: dr.srinivas@sushra.in · ASHA: padma.asha@sushra.in",
      ),
    )
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
