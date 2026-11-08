/**
 * mobile-shot.ts — open public URLs on a MobileRun cloud phone and save screenshots.
 *
 *   npm run shot -- <url> <slug> [<url> <slug> ...] [--device <id>] [--wait <s>] [--provision-minute] [--cdp]
 *   npm run shot -- https://example.com example
 *     -> ./screenshots/example-mobile.png
 *
 * Read-only browsing. Opens each URL as an Android VIEW intent and captures the whole screen.
 * A fresh phone shows Chrome's first-run screens first; the script dismisses them by tapping ONLY
 * decline/skip buttons from DECLINE_LABELS (e.g. "Use without an account", "No thanks"), only inside
 * Chrome or the Android permission dialog. That accepts Chrome's own Terms of Service on the
 * throwaway phone (approved by Murad 2026-11-07); it never signs in, allows, turns on, or types.
 * --cdp tries Chrome DevTools first (did NOT work on minute-billed android_cloud_phone, 2026-11-07).
 * No agent task, no logins, no forms.
 *
 * Phone source:
 *   default             use an existing device in state "ready". Never creates, resumes or deletes one.
 *   --provision-minute  create ONE android_cloud_phone with billing=minute (spends phone minutes,
 *                       never falls back to a subscription), take every shot on it, then terminate it,
 *                       even on error or Ctrl+C. Pass several url/slug pairs to share one phone.
 * Docs: https://docs.mobilerun.ai/api-reference/devices/provision-a-new-device.md
 *       https://docs.mobilerun.ai/api-reference/deep-link/open-a-deep-link.md
 *       https://docs.mobilerun.ai/api-reference/screenshots/capture-a-device-screenshot.md
 */
import "./load-env.js";
import Mobilerun from "@mobilerun/sdk";
import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error(
    "Usage: npm run shot -- <url> <slug> [<url> <slug> ...] [--device <id>] [--wait <s>] [--provision-minute]",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const positional: string[] = [];
let deviceArg: string | undefined;
let waitSec = 8;
let provision = false;
let mode: "cdp" | "screen" = "screen";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--device") deviceArg = args[++i];
  else if (args[i] === "--cdp") mode = "cdp";
  else if (args[i] === "--screen") mode = "screen";
  else if (args[i] === "--wait") waitSec = Number(args[++i]);
  else if (args[i] === "--provision-minute") provision = true;
  else positional.push(args[i]);
}
if (positional.length === 0 || positional.length % 2 !== 0) usage();
if (provision && deviceArg) usage("Use either --device or --provision-minute, not both.");
if (!Number.isFinite(waitSec) || waitSec < 0 || waitSec > 60) usage("--wait must be 0-60 seconds.");

const jobs: { url: URL; slug: string }[] = [];
for (let i = 0; i < positional.length; i += 2) {
  const [rawUrl, slug] = [positional[i], positional[i + 1]];
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    usage(`Not a valid URL: ${rawUrl}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") usage(`Only http(s) URLs are allowed: ${rawUrl}`);
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug)) usage(`Slug must be lowercase letters, digits, dashes: ${slug}`);
  jobs.push({ url, slug });
}

const apiKey = process.env.MOBILERUN_API_KEY;
if (!apiKey) usage("MOBILERUN_API_KEY is missing from .env.");
const client = new Mobilerun({ apiKey });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function existingReadyDevice(): Promise<string> {
  if (deviceArg) return deviceArg;
  const ready: any = await client.devices.list({ state: ["ready"] } as any);
  const first = ready.items?.[0];
  if (first) {
    console.log(`Using ready device ${first.id}${first.name ? ` (${first.name})` : ""}`);
    return first.id;
  }
  const all: any = await client.devices.list({} as any);
  const items: any[] = all.items ?? [];
  if (items.length === 0) {
    console.error("BLOCKED: no MobileRun devices. Rerun with --provision-minute to use phone minutes.");
  } else {
    console.error("BLOCKED: no device is in state 'ready'. Devices:");
    for (const d of items) console.error(`  ${d.id}  state=${d.state}  type=${d.type ?? "?"}`);
  }
  process.exit(2);
}

async function provisionMinutePhone(): Promise<string> {
  console.log("Creating one android_cloud_phone with billing=minute");
  const created: any = await client.devices.create(
    { deviceType: "android_cloud_phone", billing: "minute" },
    { headers: { "Idempotency-Key": `shot-${randomUUID()}` } },
  );
  const id: string = created.id ?? created.device?.id;
  if (!id) throw new Error("Create returned no device id.");
  console.log(`Created ${id} (billing: ${created.billingStrategy ?? created.device?.billingStrategy ?? "?"})`);
  return id;
}

async function terminate(id: string) {
  try {
    await client.devices.terminate(id);
    console.log(`Terminated ${id}; minute billing stops.`);
  } catch (err) {
    console.error(`!! Could not terminate ${id}: ${(err as Error).message}`);
    console.error("!! Delete it in the MobileRun dashboard now so it stops billing.");
  }
}

function save(slug: string, png: Buffer, suffix = "mobile") {
  const dir = resolve(process.cwd(), "screenshots");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, `${slug}-${suffix}.png`);
  writeFileSync(out, png);
  console.log(`Saved ${out} (${png.length} bytes)`);
}

// Primary path: drive the phone's own Chrome over CDP (docs.mobilerun.ai/browser-automation).
// Opens a new tab, loads the page, screenshots the page at the phone's real viewport.
// This sidesteps Chrome's first-run sign-in screen without tapping or accepting anything.
let chromeStarted = false;
async function shootCdp(deviceId: string, url: URL, slug: string) {
  if (!chromeStarted) {
    // Chrome's DevTools socket only exists while Chrome runs, so start it with the URL first.
    console.log("CDP: starting Chrome on the phone");
    await client.devices.deepLink.executeDeepLink(deviceId, { deepLink: url.href });
    await sleep(6000);
    chromeStarted = true;
  }
  const cdp = await openCdp(deviceId);
  let createdTarget: string | undefined;
  try {
    const version = await cdp.send("Browser.getVersion");
    console.log(`CDP: connected to ${version.product}`);
    const { targetInfos } = await cdp.send("Target.getTargets");
    const pages = targetInfos.filter((t: any) => t.type === "page");
    console.log(`CDP: ${targetInfos.length} targets, ${pages.length} pages`);

    let targetId: string;
    let navigate = false;
    try {
      ({ targetId } = await cdp.send("Target.createTarget", { url: url.href }));
      createdTarget = targetId;
      console.log("CDP: opened a new tab");
    } catch (err) {
      if (!pages.length) throw err;
      console.warn(`CDP: new tab refused (${(err as Error).message}); reusing an existing tab`);
      targetId = pages[0].targetId;
      navigate = true;
    }
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    if (navigate) await cdp.send("Page.navigate", { url: url.href }, sessionId);

    // Wait for the page to finish loading (max 30s), then give it the settle time.
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const r = await cdp
        .send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true }, sessionId)
        .catch(() => undefined);
      if (r?.result?.value === "complete") break;
      await sleep(500);
    }
    await sleep(Math.min(waitSec, 3) * 1000);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
    save(slug, Buffer.from(shot.data, "base64"));
  } finally {
    if (createdTarget) await cdp.send("Target.closeTarget", { targetId: createdTarget }).catch(() => {});
    cdp.close();
  }
}

// Minimal CDP client over one browser-level WebSocket. Every step logs, so a failure names the step.
function openCdp(deviceId: string): Promise<{
  send: (method: string, params?: object, sessionId?: string) => Promise<any>;
  close: () => void;
}> {
  return new Promise((resolveOpen, rejectOpen) => {
    const ws = new WebSocket(`wss://api.mobilerun.ai/v1/devices/${deviceId}/browser/cdp`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      maxPayload: 64 * 1024 * 1024,
    });
    let nextId = 1;
    const pending = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void; method: string }>();
    const failAll = (why: string) => {
      for (const p of pending.values()) p.fail(new Error(`${p.method}: ${why}`));
      pending.clear();
    };
    ws.on("unexpected-response", (_req, res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => rejectOpen(new Error(`CDP handshake HTTP ${res.statusCode}: ${body.slice(0, 200)}`)));
    });
    ws.on("error", (e) => {
      rejectOpen(e);
      failAll(e.message);
    });
    ws.on("close", (code, reason) => {
      const why = `socket closed (code ${code}${reason.length ? `, ${String(reason).slice(0, 200)}` : ""})`;
      console.warn(`CDP: ${why}`);
      failAll(why);
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      const p = msg.id != null ? pending.get(msg.id) : undefined;
      if (!p) return; // events are ignored
      pending.delete(msg.id);
      if (msg.error) p.fail(new Error(`${p.method}: ${msg.error.message}`));
      else p.ok(msg.result);
    });
    ws.on("open", () =>
      resolveOpen({
        send: (method, params = {}, sessionId) =>
          new Promise((ok, fail) => {
            const id = nextId++;
            const timer = setTimeout(() => {
              pending.delete(id);
              fail(new Error(`${method}: timed out`));
            }, 30_000);
            pending.set(id, {
              method,
              ok: (v) => (clearTimeout(timer), ok(v)),
              fail: (e) => (clearTimeout(timer), fail(e)),
            });
            ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
          }),
        close: () => ws.close(),
      }),
    );
  });
}

// Exact button labels (case-insensitive) the script may tap to get past Chrome's first-run screens.
// Decline / skip / acknowledge only. Never "Add account", "Sign in", "Allow", "Turn on", "Yes".
const DECLINE_LABELS = new Set([
  "use without an account", "accept & continue", "no thanks", "no, thanks", "not now", "skip",
  "got it", "dismiss", "cancel", "don't allow", "don\u2019t allow",
]);
const TAP_PACKAGES = new Set([
  "com.android.chrome", "com.google.android.permissioncontroller", "com.android.permissioncontroller",
]);

function flatten(node: any, out: any[] = []): any[] {
  if (!node) return out;
  out.push(node);
  for (const c of node.children ?? []) flatten(c, out);
  return out;
}

/** Taps through Chrome's first-run screens. Returns true if anything was tapped. */
async function dismissChromeSetup(deviceId: string): Promise<boolean> {
  let tapped = false;
  for (let round = 0; round < 6; round++) {
    const ui: any = await client.devices.state.ui(deviceId, { filter: false });
    const nodes = flatten(ui.a11y_tree);
    const label = (n: any) => String(n.text || n.contentDescription || "").trim();
    const hit = nodes.find(
      (n) =>
        TAP_PACKAGES.has(n.packageName) &&
        n.isEnabled !== false &&
        DECLINE_LABELS.has(label(n).toLowerCase()) &&
        n.boundsInScreen && n.boundsInScreen.right > n.boundsInScreen.left,
    );
    if (!hit) {
      const fg = ui.phone_state?.packageName ?? ui.phone_state?.currentApp ?? "?";
      const visible = nodes.filter((n) => n.isClickable && label(n)).map(label).slice(0, 10);
      console.log(`Setup: nothing to dismiss (foreground ${fg}; buttons: ${visible.join(" | ") || "none"})`);
      return tapped;
    }
    const b = hit.boundsInScreen;
    const x = Math.round((b.left + b.right) / 2);
    const y = Math.round((b.top + b.bottom) / 2);
    console.log(`Setup: tapping "${label(hit)}"`);
    await client.devices.actions.tap(deviceId, { x, y });
    tapped = true;
    await sleep(2500);
  }
  console.warn("Setup: still prompting after 6 taps; screenshotting anyway");
  return tapped;
}

async function shoot(deviceId: string, url: URL, slug: string) {
  if (mode === "cdp") {
    try {
      await shootCdp(deviceId, url, slug);
      return;
    } catch (err) {
      console.warn(`CDP failed (${(err as Error).message}); falling back to a whole-screen capture`);
    }
  }
  console.log(`Opening ${url.href}`);
  await client.devices.deepLink.executeDeepLink(deviceId, { deepLink: url.href });
  await sleep(4000);
  if (await dismissChromeSetup(deviceId)) {
    // First-run can swallow the original intent, so open the URL again once setup is gone.
    console.log(`Re-opening ${url.href}`);
    await client.devices.deepLink.executeDeepLink(deviceId, { deepLink: url.href });
  }
  await sleep(waitSec * 1000);
  // The SDK types the capture body as string; read raw bytes so the PNG is not mangled.
  const res = await client.devices.screenshots.capture(deviceId, { hideOverlay: true }).asResponse();
  let png = Buffer.from(await res.arrayBuffer());
  if (!png.subarray(0, 8).equals(PNG)) {
    // Fall back to a base64 (optionally JSON-quoted) body, which the OpenAPI spec also allows.
    png = Buffer.from(png.toString("utf8").trim().replace(/^"|"$/g, ""), "base64");
    if (!png.subarray(0, 8).equals(PNG)) {
      throw new Error(`Unexpected screenshot response (content-type ${res.headers.get("content-type")}).`);
    }
  }
  save(slug, png);
}

let createdId: string | undefined;
const onSignal = async () => {
  if (createdId) await terminate(createdId);
  process.exit(130);
};
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

let failed = false;
try {
  let deviceId: string;
  if (provision) {
    createdId = await provisionMinutePhone();
    deviceId = createdId;
    console.log("Waiting for the phone to be ready");
    await client.devices.waitReady(deviceId, { timeout: 5 * 60 * 1000 });
  } else {
    deviceId = await existingReadyDevice();
  }
  for (const job of jobs) {
    try {
      await shoot(deviceId, job.url, job.slug);
    } catch (err) {
      failed = true;
      console.error(`Shot failed for ${job.slug}: ${(err as Error).message}`);
    }
  }
} catch (err) {
  failed = true;
  console.error(`Failed: ${(err as Error).message}`);
} finally {
  if (createdId) await terminate(createdId);
}
process.exit(failed ? 1 : 0);
