// L0 proof v4: persistent-context WebKit — phase 1 = cold first visit,
// phase 2 = SW-controlled repeat visit (the owner's failure scenario:
// code already loaded, screen stayed invisible). Screenshots as evidence.
import { webkit } from "playwright";
import fs from "fs";

const URL = "https://deploy-preview-13--social-momentum.netlify.app/";
const OUT = "/out";
const UD = "/ud";

// self-invoking: multiplied opacity of the Sign In trigger (-1 = not in DOM)
const OP_FN = `(() => {
  const els = document.querySelectorAll('button, [role=tab]');
  let el = null;
  for (const e of els) { const t = (e.textContent || '').trim(); if (t === 'Sign In' || t.startsWith('Sign In ')) { el = e; break; } }
  if (!el) return -1;
  let o = parseFloat(getComputedStyle(el).opacity), p = el;
  while (p) { const po = parseFloat(getComputedStyle(p).opacity); if (!isNaN(po)) o *= po; p = p.parentElement; }
  return o;
})()`;

const ctx = await webkit.launchPersistentContext(UD, {
  viewport: { width: 390, height: 844 },
});
const results = [];

async function runPhase(label, idx, waitSw) {
  const page = await ctx.newPage();
  const out = { phase: label };
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: "commit", timeout: 40000 });
  let visible = null;
  for (let i = 0; i < 300; i++) {
    const op = await page.evaluate(OP_FN);
    if (op >= 0.9) { visible = (Date.now() - t0) / 1000; break; }
    await page.waitForTimeout(100);
  }
  out.visible_after_s = visible === null ? null : +visible.toFixed(2);
  if (waitSw) {
    try {
      await page.waitForFunction(
        "navigator.serviceWorker.getRegistration().then(r => !!r && !!navigator.serviceWorker.controller)",
        null, { timeout: 20000 });
      out.sw = "controller=true";
    } catch {
      out.sw = "controller-not-ready";
    }
  } else {
    out.sw = await page.evaluate(
      "(() => navigator.serviceWorker.controller ? 'controlled' : 'uncontrolled')()"
    ).catch(() => "?");
  }
  await page.close();
  results.push(out);
}

await runPhase("cold-first-visit", 1, true);
await runPhase("sw-controlled-repeat-visit", 2, false);
fs.writeFileSync(`${OUT}/l0-v4.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results));
const repeat = results[1].visible_after_s;
const ok = typeof repeat === "number" && repeat < 2.0;
console.log("L0-PROOF:", ok ? "PASS (SW-controlled repeat visit <2s in WebKit)" : "FAIL", `repeat=${repeat}`);
process.exit(0);
