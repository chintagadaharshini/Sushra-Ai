import { ApiError, json, withAuth } from "@/server/http";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/crypto";
import { newHealthId, tempPassword } from "@/server/ids";
import { audit } from "@/server/audit";
import { CITIES, assistedPatientSchema } from "@/lib/domain";

/**
 * ASHA-assisted registration for people without a smartphone/email. The patient signs in with
 * their mobile number and the one-time password shown here; the ASHA worker gets care access
 * because the patient agreed on the spot (recorded as such, revocable by the patient).
 */
export const POST = withAuth(async (req, user) => {
  if (req.headers.get("x-sv-channel") === "VOICE") throw new ApiError(403, "Registration must be submitted on screen.", "HUMAN_REQUIRED");
  const input = assistedPatientSchema.parse(await req.json());
  if (await prisma.user.findUnique({ where: { phone: input.phone } })) throw new ApiError(409, "This mobile number is already registered.", "CONFLICT");
  const password = tempPassword();
  const firstName = input.fullName.split(/\s+/)[0];
  const patientUser = await prisma.user.create({
    data: {
      role: "PATIENT",
      email: `${input.phone}@patients.sushra.local`, // internal placeholder; patient signs in with mobile number
      phone: input.phone,
      displayName: firstName,
      passwordHash: hashPassword(password),
      isDemo: false,
      preferences: { create: { preferredLanguage: input.preferredLanguage, city: input.city } },
      profile: {
        create: {
          fullName: input.fullName, gender: input.gender, yearOfBirth: input.yearOfBirth, city: input.city,
          state: CITIES.find((c) => c.id === input.city)!.state, healthId: await newHealthId(),
          phoneMasked: `+91 ••••• ••${input.phone.slice(-3)}`, registeredByUserId: user.id,
        },
      },
    },
    include: { profile: true },
  });
  const a = user.ashaProfile!;
  await prisma.consentRecord.create({
    data: {
      patientId: patientUser.profile!.id, purpose: "CARE_ACCESS", grantedToUserId: user.id, grantedTo: `${a.fullName} (ASHA)`,
      recordedByUserId: user.id, status: "GRANTED", scope: "All health records (view) and recording home visits · consent given in person during assisted registration",
      expiresAt: new Date(Date.now() + 365 * 864e5),
    },
  });
  await audit({ userId: user.id, action: "PATIENT_REGISTERED_BY_ASHA", entity: "PatientProfile", entityId: patientUser.profile!.id });
  return json({ patientId: patientUser.profile!.id, healthId: patientUser.profile!.healthId, loginPhone: input.phone, temporaryPassword: password }, 201);
}, ["ASHA"]);
