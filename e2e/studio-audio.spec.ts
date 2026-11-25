// Opt-in: proves the bot's WebRTC audio is actually PLAYED in the browser.
// Run the agent with   SV_LOOPBACK_TEST=audio python voice-agent/server.py   (it streams a tone instead of Sarvam audio),
// then   STUDIO_AUDIO_TEST=1 npm run e2e -- studio-audio
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.skip(!process.env.STUDIO_AUDIO_TEST, "set STUDIO_AUDIO_TEST=1 and run the audio loopback agent");
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) } });

test("Studio voice plays the bot's audio track", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Open voice assistant" }).click();
  await page.getByRole("tab", { name: "Studio voice · Sarvam" }).click();
  await page.getByRole("button", { name: "Start live voice conversation" }).click();
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const el = document.querySelector<HTMLAudioElement>('[data-testid="studio-bot-audio"]');
    const s = el?.srcObject as MediaStream | null;
    if (!el || !s) return { ok: false, rms: 0, advanced: 0 };
    const t0 = el.currentTime;
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    ctx.createMediaStreamSource(s).connect(an);
    const d = new Float32Array(an.fftSize);
    let peak = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise((res) => setTimeout(res, 100));
      an.getFloatTimeDomainData(d);
      peak = Math.max(peak, Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length));
    }
    return { ok: !el.paused, rms: peak, advanced: el.currentTime - t0 };
  });
  expect(r.ok).toBe(true);
  expect(r.advanced).toBeGreaterThan(0.5);
  expect(r.rms).toBeGreaterThan(0.05);
});
