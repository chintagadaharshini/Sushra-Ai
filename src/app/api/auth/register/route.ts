import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/server/db";
import { hashPassword, signSession } from "@/server/crypto";
import { SESSION_COOKIE } from "@/server/session";
import { audit } from "@/server/audit";
import { CITIES, registerSchema } from "@/lib/domain";
import { newHealthId } from "@/server/ids";

export async function POST(req: Request) {
  let input;
  try {
    input = registerSchema.parse(await req.json());
  } catch (e) {
    const issues = e instanceof ZodError ? e.issues.map((i) => ({ field: i.path.join("."), message: i.message })) : [];
    return NextResponse.json({ error: issues[0]?.message ?? "Please check the form.", issues }, { status: 400 });
  }
  const taken = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, { phone: input.phone }] }, select: { email: true } });
  if (taken) {
    return NextResponse.json({ error: taken.email === input.email ? "An account with this email already exists. Please sign in." : "This mobile number is already registered. Please sign in." }, { status: 409 });
  }
  const firstName = input.fullName.replace(/^(dr\.?\s+)/i, "").split(/\s+/)[0];
  const base = {
    role: input.role,
    email: input.email,
    phone: input.phone,
    displayName: input.role === "DOCTOR" ? `Dr. ${firstName}` : firstName,
    passwordHash: hashPassword(input.password),
    isDemo: false,
    preferences: { create: { preferredLanguage: input.preferredLanguage, city: input.role === "ASHA" ? input.district : input.city } },
  };
  const user = await prisma.user.create({
    data:
      input.role === "PATIENT"
        ? {
            ...base,
            profile: {
              create: {
                fullName: input.fullName, gender: input.gender, yearOfBirth: input.yearOfBirth, city: input.city,
                state: CITIES.find((c) => c.id === input.city)!.state, healthId: await newHealthId(), phoneMasked: `+91 ••••• ••${input.phone.slice(-3)}`,
              },
            },
          }
        : input.role === "DOCTOR"
          ? { ...base, doctorProfile: { create: { fullName: input.fullName.startsWith("Dr") ? input.fullName : `Dr. ${input.fullName}`, registrationNumber: input.registrationNumber, specialization: input.specialization, facilityName: input.facilityName, city: input.city } } }
          : { ...base, ashaProfile: { create: { fullName: input.fullName, ashaId: input.ashaId, village: input.village, district: input.district, phcName: input.phcName } } },
  });
  await audit({ userId: user.id, action: `REGISTERED_${input.role}` });
  const res = NextResponse.json({ ok: true, role: user.role }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}
