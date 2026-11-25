import type { Page } from "@playwright/test";

export async function login(page: Page, identifier = "lakshmi@sushra.in", role: "Patient" | "Doctor" | "ASHA worker" = "Patient", password = "Sushra@123") {
  await page.goto("/login");
  await page.getByRole("radio", { name: new RegExp(`^${role}`) }).click();
  await page.getByLabel("Email or mobile number").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^Sign in as/ }).click();
  await page.waitForURL("**/dashboard");
}
