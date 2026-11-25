// End-to-end demo scenarios. Commands are typed into the assistant, which runs the
// exact same pipeline as recognised speech (speech-to-text is the only step skipped).
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";


async function say(page: Page, text: string) {
  if (!(await page.getByRole("dialog", { name: "Voice assistant" }).isVisible())) {
    await page.getByRole("button", { name: "Open voice assistant" }).click();
  }
  const box = page.getByLabel("Type a command for the assistant");
  await box.fill(text);
  await box.press("Enter");
}

const panel = (page: Page) => page.getByRole("dialog", { name: "Voice assistant" });

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("dashboard renders without demo labels", async ({ page }) => {
  await expect(page.getByText(/demo/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Namaste, Lakshmi/ })).toBeVisible();
  await expect(page.getByText("My care team")).toBeVisible();
  await expect(page.getByText("Recent medical reports")).toBeVisible();
});

test("Scenario 1 — Telugu: open health records", async ({ page }) => {
  await page.getByRole("button", { name: "తె" }).first().click();
  await say(page, "నా హెల్త్ రికార్డ్స్ చూపించు.");
  await page.waitForURL("**/records");
  await expect(panel(page).getByText("తప్పకుండా. మీ హెల్త్ రికార్డ్స్ తెరుస్తున్నాను.")).toBeVisible();
  await expect(page.getByTestId("record-row").first()).toBeVisible();
  expect(await page.getByTestId("record-row").count()).toBeGreaterThanOrEqual(10);
});

test("Scenario 2 — English: latest blood test report", async ({ page }) => {
  await say(page, "Show me my latest blood test report.");
  await page.waitForURL(/\/records\/[^/]+$/);
  await expect(page.getByTestId("record-title")).toHaveText("Complete Blood Count (CBC)");
  await expect(page.getByText("18 Nov 2026").first()).toBeVisible();
  await expect(panel(page).getByText(/Opening your latest blood test report/)).toBeVisible();
});

test("Scenario 3 — Hindi: explain my report (with clarification)", async ({ page }) => {
  await page.getByRole("button", { name: "हिं" }).first().click();
  await say(page, "मेरी मेडिकल रिपोर्ट समझाओ।");
  await expect(panel(page).getByText(/मैं आपकी रिपोर्ट आसान भाषा में समझाने में मदद करूँगी/)).toBeVisible();
  await say(page, "पहला");
  await page.waitForURL(/\/records\/[^/]+$/);
  await expect(page.getByTestId("explanation")).toContainText("हीमोग्लोबिन");
  await expect(page.getByTestId("explanation")).toContainText("डॉक्टर");
});

test("Scenario 4 — form filling with confirmation", async ({ page }) => {
  await say(page, "Change my preferred city to Hyderabad.");
  await expect(panel(page).getByText("Would you like me to set your city to Hyderabad?", { exact: false })).toBeVisible();
  await expect(page).not.toHaveURL(/profile/); // nothing happens before confirmation
  await say(page, "Yes.");
  await page.waitForURL("**/profile");
  await expect(panel(page).getByText(/Your city is now Hyderabad, and it has been saved/)).toBeVisible();
  await expect(page.getByTestId("pref-city")).toHaveValue("Hyderabad");
  // persisted on the server
  const me = await page.request.get("/api/me");
  expect((await me.json()).preferences.city).toBe("Hyderabad");
});

test("Scenario 4b — declining changes nothing", async ({ page }) => {
  const before = (await (await page.request.get("/api/me")).json()).preferences.city;
  await say(page, "Set my city to Guntur");
  await say(page, "no");
  await expect(panel(page).getByText("Okay, cancelled. Nothing was changed.")).toBeVisible();
  expect((await (await page.request.get("/api/me")).json()).preferences.city).toBe(before);
});

test("Scenario 5 — find hospitals near Visakhapatnam", async ({ page }) => {
  await say(page, "Find hospitals near Visakhapatnam.");
  await page.waitForURL(/\/facilities\?city=Visakhapatnam/);
  await expect(page.getByLabel("City")).toHaveValue("Visakhapatnam");
  await expect(page.getByTestId("facility-card")).toHaveCount(2);
  await expect(panel(page).getByText(/Opening healthcare facility search for Visakhapatnam\. I found 2 facilities/)).toBeVisible();
});

test("Scenario 6b — latest blood test explained in Telugu", async ({ page }) => {
  await say(page, "Show me my latest blood test report.");
  await page.waitForURL(/\/records\/[^/]+$/);
  await say(page, "Explain it in Telugu.");
  await expect(page.getByTestId("explanation")).toContainText("హిమోగ్లోబిన్");
  await expect(page.getByTestId("explanation")).toContainText("ల్యాబ్ ఇచ్చిన రిఫరెన్స్ పరిధి కంటే తక్కువ");
});

test("Scenario 6 — multistep: records → latest one → explain in Telugu", async ({ page }) => {
  await say(page, "Open my records.");
  await page.waitForURL("**/records");
  await expect(page.getByTestId("record-row").first()).toBeVisible();
  const newest = (await page.getByTestId("record-row").first().locator("span.block.font-bold").first().innerText()).trim();
  await say(page, "Open the latest one.");
  await page.waitForURL(/\/records\/[^/]+$/);
  await expect(page.getByTestId("record-title")).toHaveText(newest);
  await say(page, "Explain it in Telugu.");
  await expect(page.getByTestId("explanation")).toBeVisible();
  await expect(page.getByTestId("explanation")).toHaveAttribute("lang", "te-IN");
  await expect(panel(page).getByText(/సులభమైన భాషలో/)).toBeVisible();
});

test("blocked sensitive input", async ({ page }) => {
  await say(page, "my aadhaar number is 1234 5678 9012");
  await expect(panel(page).getByText(/can't enter, read or store passwords, OTPs, Aadhaar/)).toBeVisible();
});

test("appointment booking: voice fills, only the human submits", async ({ page }) => {
  await say(page, "Open appointment booking");
  await page.waitForURL(/\/appointments\?new=1/);
  await expect(page.getByTestId("appointment-form")).toBeVisible();
  await say(page, "set department to cardiology");
  await say(page, "yes");
  await expect(page.getByTestId("appt-department")).toHaveValue("Cardiology");
  await expect(panel(page).getByText(/press Submit yourself/).last()).toBeVisible();
  // API refuses assistant-channel submissions
  const r = await page.request.post("/api/appointments", { headers: { "x-sv-channel": "VOICE" }, data: { facilityId: "x", department: "Cardiology", preferredDate: "2027-01-10" } });
  expect(r.status()).toBe(403);
});

test("access control: other patient's record is not reachable", async ({ page, browser }) => {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await ctx.newPage();
  await login(other, "ravi@sushra.in");
  const raviRecords = (await (await other.request.get("/api/records")).json()).records;
  const r = await page.request.get(`/api/records/${raviRecords[0].id}`);
  expect(r.status()).toBe(404);
  await ctx.close();
  const anon = await page.request.get("/api/records", { headers: { cookie: "" } });
  expect([200, 401]).toContain(anon.status());
});

test("navigation, help, scroll, back by voice", async ({ page }) => {
  await say(page, "What can I do on this page?");
  await expect(panel(page).getByText(/This is your dashboard/)).toBeVisible();
  await say(page, "open my profile");
  await page.waitForURL("**/profile");
  await say(page, "go to dashboard");
  await page.waitForURL("**/dashboard");
  await say(page, "go back");
  await page.waitForURL("**/profile");
});

test("FHIR R4 export", async ({ page }) => {
  const recs = (await (await page.request.get("/api/records?type=LAB_REPORT")).json()).records;
  const res = await page.request.get(`/api/records/${recs[0].id}/fhir`);
  const b = await res.json();
  expect(b.resourceType).toBe("Bundle");
  expect(b.entry.map((e: { resource: { resourceType: string } }) => e.resource.resourceType)).toContain("DiagnosticReport");
});
