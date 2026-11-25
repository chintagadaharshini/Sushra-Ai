import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifySession } from "./crypto";
import type { Role } from "@/lib/domain";

export const SESSION_COOKIE = "sv_session";

export async function getSessionUser() {
  const store = await cookies();
  const payload = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    include: { profile: true, doctorProfile: true, ashaProfile: true, preferences: true },
  });
  if (!user) return null;
  const role = user.role as Role;
  // Every account must have the profile that matches its role
  if (role === "PATIENT" && !user.profile) return null;
  if (role === "DOCTOR" && !user.doctorProfile) return null;
  if (role === "ASHA" && !user.ashaProfile) return null;
  return { ...user, role };
}
export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export function displayNameOf(u: SessionUser): string {
  return u.profile?.fullName ?? u.doctorProfile?.fullName ?? u.ashaProfile?.fullName ?? u.displayName;
}
