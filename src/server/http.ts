import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser, type SessionUser } from "./session";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "ERROR") {
    super(message);
  }
}

export function json<T>(data: T, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

type Handler<C> = (req: Request, user: SessionUser, ctx: C) => Promise<Response>;
type PatientUser = SessionUser & { profile: NonNullable<SessionUser["profile"]> };

/** Wraps a route handler: requires a valid session (optionally one of `roles`), maps errors to safe JSON (no PHI in logs). */
export function withAuth<C = unknown>(handler: Handler<C>, roles?: SessionUser["role"][]) {
  return async (req: Request, ctx: C) => {
    try {
      const user = await getSessionUser();
      if (!user) return json({ error: "Not signed in", code: "UNAUTHENTICATED" }, 401);
      if (roles && !roles.includes(user.role)) return json({ error: "Not allowed for your account type", code: "FORBIDDEN" }, 403);
      return await handler(req, user, ctx);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message, code: err.code }, err.status);
      if (err instanceof ZodError)
        return json({ error: "Invalid request", code: "VALIDATION", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) }, 400);
      console.error("[api] unhandled error:", (err as Error)?.name ?? "Error"); // deliberately no message/body
      return json({ error: "Internal error", code: "INTERNAL" }, 500);
    }
  };
}

/** Patient-only route: the handler receives a user with a guaranteed patient profile. */
export function withPatient<C = unknown>(handler: (req: Request, user: PatientUser, ctx: C) => Promise<Response>) {
  return withAuth<C>((req, user, ctx) => handler(req, user as PatientUser, ctx), ["PATIENT"]);
}
