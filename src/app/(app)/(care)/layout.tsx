import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";

/** Care-team pages (doctors and ASHA workers). */
export default async function CareOnlyLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "PATIENT") redirect("/dashboard");
  return children;
}
