import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const unique = () => Date.now().toString().slice(-8);

async function say(page: Page, text: string) {
  if (!(await page.getByRole("dialog", { name: "Voice assistant" }).isVisible())) await page.getByRole("button", { name: "Open voice assistant" }).click();
  const box = page.getByLabel("Type a command for the assistant");
  await box.fill(text);
  await box.press("Enter");
}

test("wrong role tab gives a clear message", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: /^Doctor/ }).click();
  await page.getByLabel("Email or mobile number").fill("lakshmi@sushra.in");
  await page.getByLabel("Password").fill("Sushra@123");
  await page.getByRole("button", { name: /^Sign in as/ }).click();
  await expect(page.getByText(/registered as Patient/)).toBeVisible();
});

test("sign in with mobile number works", async ({ page }) => {
  await login(page, "9000000001");
  await expect(page.getByRole("heading", { name: /Namaste, Lakshmi/ })).toBeVisible();
});

test("new patient registers and lands on their dashboard", async ({ page }) => {
  const n = unique();
  await page.goto("/register?role=PATIENT");
  await page.getByLabel("Full name").fill("Sita Ramaiah");
  await page.getByLabel("Email").fill(`sita${n}@example.com`);
  await page.getByLabel("Mobile number").fill(`97${n}`);
  await page.getByLabel("Year of birth").fill("1966");
  await page.getByLabel("Password", { exact: true }).fill("Health2026");
  await page.getByLabel("Confirm password").fill("Health2026");
  await page.getByRole("button", { name: "Register as Patient" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /Namaste, Sita/ })).toBeVisible();
  await page.goto("/records");
  await expect(page.getByText("No records match.")).toBeVisible();
});

test("new doctor registers with pending verification", async ({ page }) => {
  const n = unique();
  await page.goto("/register?role=DOCTOR");
  await page.getByLabel("Full name (as registered)").fill("Meena Iyer");
  await page.getByLabel("Email").fill(`meena${n}@example.com`);
  await page.getByLabel("Mobile number").fill(`96${n}`);
  await page.getByLabel("Medical council registration no.").fill(`TSMC/2015/${n.slice(-4)}`);
  await page.getByLabel("Hospital / clinic").fill("Lake View Clinic");
  await page.getByLabel("Password", { exact: true }).fill("Health2026");
  await page.getByLabel("Confirm password").fill("Health2026");
  await page.getByRole("button", { name: "Register as Doctor" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText(/verification pending/)).toBeVisible();
  await expect(page.getByText(/No patients have shared/)).toBeVisible();
});

test("doctor sees a consenting patient, opens a report and adds a note", async ({ page }) => {
  await login(page, "dr.srinivas@sushra.in", "Doctor");
  await say(page, "Open my patients");
  await page.waitForURL("**/patients");
  await expect(page.getByTestId("patient-row")).toHaveCount(1);
  await page.getByTestId("patient-row").first().click();
  await expect(page.getByTestId("patient-name")).toHaveText("Lakshmi Devi Konda");
  await page.getByLabel("Reason for visit").fill("Review of blood tests");
  await page.getByLabel("Plan (one item per line)").fill("Continue iron supplement");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("status")).toContainText("Saved to Lakshmi Devi Konda");
  const newNote = page.getByRole("link", { name: /General Medicine Consultation(?! Summary)/ });
  await expect(newNote.first()).toBeVisible();
  await newNote.first().click();
  await expect(page.getByTestId("record-title")).toHaveText("General Medicine Consultation");
  await say(page, "explain it in Hindi");
  await expect(page.getByTestId("explanation")).toContainText("Review of blood tests");
  // patient-only pages are off-limits
  await page.goto("/records");
  await page.waitForURL("**/patients");
  // Ravi has not shared → not reachable
  const res = await page.request.get("/api/care/patients");
  expect((await res.json()).patients).toHaveLength(1);
});

test("ASHA registers a patient (with consent) and records a home visit", async ({ page }) => {
  const n = unique();
  await login(page, "padma.asha@sushra.in", "ASHA worker");
  await say(page, "కొత్త రోగిని నమోదు చేయి");
  await page.waitForURL("**/patients/register");
  await page.getByLabel("Full name").fill("Ramaiah Gollapudi");
  await page.getByLabel("Mobile number").fill(`95${n}`);
  await page.getByLabel("Year of birth").fill("1952");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register patient" }).click();
  await expect(page.getByText("Ramaiah Gollapudi is registered")).toBeVisible();
  const temp = await page.getByTestId("temp-password").innerText();
  await page.getByRole("button", { name: "Open patient" }).click();
  await page.getByLabel("BP — upper").fill("142");
  await page.getByLabel("BP — lower").fill("90");
  await page.getByLabel("Notes").fill("Advised PHC visit for BP check");
  await page.getByRole("button", { name: "Save visit" }).click();
  await expect(page.getByRole("status")).toContainText("Home visit saved");
  // the new patient can sign in with mobile + temporary password and sees the visit
  await page.context().clearCookies();
  await login(page, `95${n}`, "Patient", temp);
  await page.goto("/records");
  await expect(page.getByText("ASHA Home Visit")).toBeVisible();
});

test("patient shares with a doctor and can stop sharing", async ({ page, browser }) => {
  await login(page, "ravi@sushra.in");
  await page.goto("/privacy");
  await page.getByRole("option", { name: /Dr. A. Srinivas/ }).click();
  await page.getByRole("button", { name: "Share records" }).click();
  await expect(page.getByTestId("care-team")).toContainText("Dr. A. Srinivas");

  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const doc = await ctx.newPage();
  await login(doc, "dr.srinivas@sushra.in", "Doctor");
  expect((await (await doc.request.get("/api/care/patients")).json()).patients.length).toBe(2);

  await page.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByTestId("care-team")).not.toContainText("Dr. A. Srinivas");
  expect((await (await doc.request.get("/api/care/patients")).json()).patients.length).toBe(1);
  await ctx.close();
});
