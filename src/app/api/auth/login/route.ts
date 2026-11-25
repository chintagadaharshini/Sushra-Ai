import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { signSession, verifyPassword } from "@/server/crypto";
import { SESSION_COOKIE } from "@/server/session";
import { audit } from "@/server/audit";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/domain";

const schema = z
  .object({
    identifier: z.string().trim().min(3).max(120), // email or 10-digit mobile
    password: z.string().min(1).max(200),
    role: z.enum(ROLES).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter your email or mobile number and password." }, { status: 400 });
  const id = body.data.identifier.toLowerCase();
  const user = await prisma.user.findFirst({ where: /^\d{10}$/.test(id) ? { phone: id } : { email: id } });
  if (!user || !verifyPassword(body.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect email/mobile number or password." }, { status: 401 });
  }
  if (body.data.role && body.data.role !== user.role) {
    return NextResponse.json(
      { error: `This account is registered as ${ROLE_LABEL[user.role as Role]}. Choose the “${ROLE_LABEL[user.role as Role]}” tab to sign in.`, code: "ROLE_MISMATCH" },
      { status: 403 },
    );
  }
  await audit({ userId: user.id, action: "SIGN_IN", outcome: "SUCCESS" });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return res;
}
