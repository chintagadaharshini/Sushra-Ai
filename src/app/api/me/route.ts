import { json, withAuth } from "@/server/http";

export const GET = withAuth(async (_req, user) =>
  json({
    user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName, role: user.role },
    profile: user.profile,
    doctorProfile: user.doctorProfile,
    ashaProfile: user.ashaProfile,
    preferences: user.preferences,
  }),
);
