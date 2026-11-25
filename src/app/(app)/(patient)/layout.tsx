import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";

/** Pages that show a patient's own data. Doctors / ASHA workers use /patients instead. */
export default async function PatientOnlyLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "PATIENT") redirect("/patients");
  return children;
}
