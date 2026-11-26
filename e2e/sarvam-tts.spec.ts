// Browser-voice speech output: replies are spoken with the audio returned by /api/tts (Sarvam Bulbul),
// and when Sarvam is unavailable the user is TOLD that the device voice is used instead.
// /api/tts and /api/voice-agent/status are stubbed here because CI cannot reach Sarvam;
// the real Sarvam call is verified on the deployed agent (see docs/DEPLOYMENT.md).
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/** 0.5 s 440 Hz mono 16-bit WAV, base64. */
function toneWav(): string {
  const rate = 24000, n = rate / 2, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return buf.toString("base64");
}

async function trackAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __played: string[] };
    w.__played = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__played.push(this.src.slice(0, 30));
      return orig.call(this);
    };
  });
}

async function say(page: Page, text: string) {
  await page.getByRole("button", { name: "Open voice assistant" }).click();
  const box = page.getByLabel("Type a command for the assistant");
  await box.fill(text);
  await box.press("Enter");
}

test("browser voice speaks replies with Sarvam audio", async ({ page }) => {
  await trackAudio(page);
  let ttsCalls = 0;
  await page.route("**/api/voice-agent/status", (r) => r.fulfill({ json: { available: true, reason: null } }));
  await page.route("**/api/tts", async (r) => {
    ttsCalls++;
    const body = r.request().postDataJSON() as { lang: string; text: string };
    expect(body.text.length).toBeGreaterThan(0);
    await r.fulfill({ json: { mime: "audio/wav", audios: [toneWav()] } });
  });
  await login(page);
  await say(page, "open my health records");
  await expect.poll(() => ttsCalls, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __played: string[] }).__played.filter((s) => s.startsWith("data:audio/wav")).length), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.getByText(/Sarvam voice unavailable/)).toHaveCount(0);
});

test("browser voice tells the user when Sarvam is unavailable (no silent swap)", async ({ page }) => {
  await page.route("**/api/voice-agent/status", (r) => r.fulfill({ json: { available: true, reason: null } }));
  await page.route("**/api/tts", (r) => r.fulfill({ status: 502, json: { error: "Sarvam TTS returned HTTP 403: invalid api key", reason: "agent-502" } }));
  await login(page);
  await say(page, "open my health records");
  await expect(page.getByText(/Sarvam voice unavailable \(Sarvam TTS returned HTTP 403/)).toBeVisible({ timeout: 15_000 });
});
