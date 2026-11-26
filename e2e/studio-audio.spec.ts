// Opt-in Studio voice tests over the WebSocket transport (the one used on Render).
//   Audio:   SV_LOOPBACK_TEST=audio python voice-agent/server.py  then  STUDIO_AUDIO_TEST=1 npm run e2e -- studio-audio -g audio
//   Actions: SV_LOOPBACK_TEST=1     python voice-agent/server.py  then  STUDIO_ACTION_TEST=1 npm run e2e -- studio-audio -g actions
// The loopback bots replace Sarvam/Groq with a 440 Hz tone / a fixed tool-call script, but use the
// same token handshake, WebSocket transport, RTVI messages and browser audio player as the real bot.
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) } });

/** Every node connected to the speakers also feeds an analyser, so the test hears what the user would. */
async function tapSpeakers(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __svTaps: AnalyserNode[] };
    w.__svTaps = [];
    const orig = AudioNode.prototype.connect as (...a: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      const dest = args[0];
      if (dest instanceof AudioDestinationNode) {
        const an = this.context.createAnalyser();
        an.fftSize = 2048;
        orig.call(this, an);
        w.__svTaps.push(an);
      }
      return orig.apply(this, args);
    } as typeof AudioNode.prototype.connect;
  });
}

async function startStudio(page: Page) {
  await login(page);
  await page.getByRole("button", { name: "Open voice assistant" }).click();
  await page.getByRole("tab", { name: "Studio voice · Sarvam" }).click();
  const start = page.getByRole("button", { name: "Start live voice conversation" });
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();
  await expect(page.getByRole("button", { name: "End live voice conversation" })).toBeVisible({ timeout: 20_000 });
}

test("audio: Studio voice plays the bot's audio through the speakers", async ({ page }) => {
  test.skip(!process.env.STUDIO_AUDIO_TEST, "set STUDIO_AUDIO_TEST=1 and run the audio loopback agent");
  await tapSpeakers(page);
  await startStudio(page);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const taps = (window as unknown as { __svTaps: AnalyserNode[] }).__svTaps;
    const d = new Float32Array(2048);
    let peak = 0;
    for (let i = 0; i < 15; i++) {
      await new Promise((res) => setTimeout(res, 100));
      for (const an of taps) {
        an.getFloatTimeDomainData(d);
        peak = Math.max(peak, Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length));
      }
    }
    return { taps: taps.length, rms: peak, ctxState: taps[0]?.context.state ?? "none" };
  });
  console.log("studio audio:", JSON.stringify(r));
  expect(r.taps).toBeGreaterThan(0);
  expect(r.ctxState).toBe("running");
  expect(r.rms).toBeGreaterThan(0.05);
});

test("actions: agent tool calls run in the browser and results return over the WebSocket", async ({ page }) => {
  test.skip(!process.env.STUDIO_ACTION_TEST, "set STUDIO_ACTION_TEST=1 and run the action loopback agent");
  await startStudio(page);
  // The script opens the records page, then the latest record, and explains it in Telugu.
  await expect(page).toHaveURL(/\/records\/[^/]+$/, { timeout: 30_000 });
  // The bot writes every tool result to SV_LOOPBACK_LOG once the script finishes.
  const log = process.env.SV_LOOPBACK_LOG ?? "/tmp/sv-loopback.json";
  await expect.poll(() => fs.existsSync(log), { timeout: 45_000 }).toBe(true);
  const { request_data, steps } = JSON.parse(fs.readFileSync(log, "utf8")) as { request_data: { role: string }; steps: { tool: string; result?: { ok?: boolean }; rejected?: string }[] };
  expect(request_data.role).toBe("PATIENT"); // identity comes from the signed token, not the browser
  const byTool = (t: string) => steps.filter((s) => s.tool === t);
  expect(byTool("go_to_page")[0].result?.ok).toBe(true);
  expect(byTool("open_record")[0].result?.ok).toBe(true);
  expect(byTool("explain_record")[0].result?.ok).toBe(true);
  expect(byTool("propose_form_change")[1].rejected).toBeTruthy(); // aadhaar is never accepted
});
