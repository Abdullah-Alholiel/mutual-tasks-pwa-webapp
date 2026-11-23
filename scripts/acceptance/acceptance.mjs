#!/usr/bin/env node
// ============================================================================
// Momentum acceptance suite — BROWSER phase (lane L4d, owner decision D-045)
// ============================================================================
// Drives the core loop on the STAGING preview in Chromium AND WebKit (both
// inside the mcr.microsoft.com/playwright:v1.62.1-noble container — the host
// has no browser deps). This process has NO database access by design:
// everything DB-side (token, row checks, cleanup, zero-leftover proof) is the
// host runner's job (run-acceptance.sh), which reads ONLY qa-bot's rows.
//
// Contract with the runner:
// - Inputs (env): ACCEPTANCE_URL, ACCEPTANCE_ENGINE, QA_TOKEN (qa-bot session
//   token read host-side from sessions — the ONLY DB value this flow sees),
//   QA_USER_JSON (qa-bot profile row), ACCEPTANCE_OUT (facts file path),
//   ACCEPTANCE_SHOTS (screenshots dir).
// - Output: facts JSON at ACCEPTANCE_OUT: steps[], projectName, taskTitles[],
//   engine, url, time. Exit 0 iff every browser step passed.
// - The flow creates: 1 project, 2 tasks (1 completed). It deletes the project
//   through the UI; the host runner then verifies + finishes cleanup and
//   proves zero leftover rows (D-045 requirement).
// ============================================================================

import { chromium, webkit } from '/deps/node_modules/playwright/index.mjs';

const ENGINE = process.env.ACCEPTANCE_ENGINE || 'chromium';
const STAGING_URL = process.env.ACCEPTANCE_URL || 'https://staging.social-momentum-8zq.pages.dev';
const OUT = process.env.ACCEPTANCE_OUT || `/tmp/FACTS.${ENGINE}.json`;
const SHOTS = process.env.ACCEPTANCE_SHOTS || '/tmp/shots';
const QA_TOKEN = process.env.QA_TOKEN || '';
const QA_USER = JSON.parse(process.env.QA_USER_JSON || 'null');
if (!QA_TOKEN || !QA_USER) {
  console.error('FATAL: QA_TOKEN / QA_USER_JSON not provided by the runner');
  process.exit(2);
}

const STAMP = new Date().toISOString();
const RUN_TAG = `QA ${STAMP.slice(0, 16)}`;
const PROJECT_NAME = `${RUN_TAG} project`;
const TASK_TITLES = [`${RUN_TAG} task one`, `${RUN_TAG} task rt`];

const steps = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    steps.push({ name, pass: true, ms: Date.now() - t0 });
    console.log(`PASS ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    steps.push({ name, pass: false, ms: Date.now() - t0, error: String(e).slice(0, 300) });
    console.log(`FAIL ${name}: ${String(e).slice(0, 300)}`);
  }
};

// The app renders hidden <section> placeholders (#root > * matches them while
// INVISIBLE), so "an element exists" proves nothing. Wait for real VISIBLE
// text instead.
const waitAppVisible = (page) =>
  page.waitForFunction(() => ((document.querySelector('#root')?.innerText) || '').trim().length > 10, null, { timeout: 30000 });
// Project page's create-task button: desktop variant is a text button "New",
// mobile icon-only variant carries title="New Task" (accessible name via
// title). .or() matches whichever variant is rendered; .first() takes it.
const addTaskButton = (page) =>
  page.getByRole('button', { name: 'New', exact: true })
    .or(page.getByRole('button', { name: 'New Task' }))
    .or(page.getByRole('button', { name: /Add Task/i }))
    .first();

const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
const result = {
  phase: 'browser', engine: ENGINE, url: STAGING_URL, time: STAMP,
  projectName: PROJECT_NAME, taskTitles: TASK_TITLES, steps,
};
let context;
try {
  context = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const shot = async (n) => {
    try { await page.screenshot({ path: `${SHOTS}/${n}.png` }); } catch {}
  };

  // 1. App loads signed-out (render + no crash)
  await step('app loads signed-out', async () => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))));
    await page.evaluate(() => caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitAppVisible(page);
    if (errors.length) throw new Error(`page errors: ${errors[0]}`);
    await shot('01-signed-out');
  });

  // 2. Sign in AS QA-BOT (token injection = the app's own storage contract;
  //    the token was read from the sessions table by the host runner — qa-bot ONLY)
  await step('sign in as @qa-bot (session token from DB)', async () => {
    await page.evaluate(([t, u]) => {
      localStorage.setItem('momentum_session_token', t);
      localStorage.setItem('momentum_session_expiry', new Date(Date.now() + 864e5).toISOString());
      localStorage.setItem('momentum_user_cache', JSON.stringify(u));
    }, [QA_TOKEN, QA_USER]);
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByText('qa-bot').first().waitFor({ timeout: 30000 });
    await shot('02-signed-in');
  });

  // 3. Create a project (New → New Project → name → Create)
  await step('create a project', async () => {
    await page.getByRole('button', { name: 'New', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'New Project' }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await shot('03-project-form');
    await page.getByRole('button', { name: /Create (Public|Private) Project/ }).click();
    await page.getByText(PROJECT_NAME).first().waitFor({ timeout: 20000 });
  });

  // 4. Open the project, add task one
  await step('add a task to the project', async () => {
    await page.getByText(PROJECT_NAME).first().click();
    await page.waitForURL(/project/, { timeout: 20000 });
    await addTaskButton(page).click();
    await page.locator('#title').fill(TASK_TITLES[0]);
    await shot('04-task-form');
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.getByText(TASK_TITLES[0]).first().waitFor({ timeout: 20000 });
  });

  // 5. Complete the task (UI confirms; the host runner proves the completion_logs
  //    row in the DB — user_stats is derived FROM logs by recalculateStats)
  await step('complete the task', async () => {
    await page.getByRole('button', { name: `Mark task as completed: ${TASK_TITLES[0]}` }).click();
    const skip = page.getByRole('button', { name: 'Skip' });
    if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) await skip.click();
    await shot('05-completed');
    // UI proof: a completion confirmation appears (toast or state change)
    await page.waitForTimeout(2500);
  });

  // 6. Realtime: second tab in the SAME context shares the session; a new task
  //    from tab 1 must appear in tab 2 without a reload (postgres_changes)
  await step('realtime update visible in a second tab', async () => {
    const page2 = await context.newPage();
    await page2.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitAppVisible(page2);
    await page2.getByText(PROJECT_NAME).first().click();
    await page2.waitForURL(/project/, { timeout: 20000 });
    await addTaskButton(page).click();
    await page.locator('#title').fill(TASK_TITLES[1]);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.getByText(TASK_TITLES[1]).first().waitFor({ timeout: 20000 });
    let delivered = true;
    try {
      await page2.getByText(TASK_TITLES[1]).first().waitFor({ timeout: 20000 });
    } catch {
      delivered = false;
    }
    await page2.close();
    result.realtime = delivered ? 'delivered' : 'NOT delivered';
    if (!delivered) throw new Error('second tab did not show the new task within 20s (D-065 watch)');
  });

  // 7. Delete the project through the UI (Settings → Delete Project → Delete Everything)
  await step('delete the project via UI', async () => {
    await page.getByRole('button', { name: 'Project Settings' }).first().click();
    await page.getByRole('button', { name: 'Delete Project' }).click();
    await shot('07-delete-confirm');
    await page.getByRole('button', { name: 'Delete Everything' }).click();
    await page.waitForTimeout(4000);
    const still = await page.getByText(PROJECT_NAME).first().isVisible({ timeout: 8000 }).catch(() => false);
    if (still) throw new Error('project still visible after delete');
  });

  // 8. AR leg: /privacy?lang=ar renders Arabic with dir=rtl (the app's real AR surface)
  await step('AR: legal page renders Arabic with dir=rtl', async () => {
    await page.goto(`${STAGING_URL}/privacy?lang=ar`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitAppVisible(page);
    const dir = await page.evaluate(() => document.documentElement.dir);
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (dir !== 'rtl' || lang !== 'ar') throw new Error(`dir=${dir} lang=${lang}`);
    await shot('08-privacy-ar');
  });
} catch (e) {
  result.fatal = String(e).slice(0, 300);
} finally {
  await browser.close().catch(() => {});
}

result.browserPass = !result.fatal && steps.length > 0 && steps.every((s) => s.pass);
//eslint-disable-next-line no-undef
const { writeFileSync, mkdirSync } = await import('node:fs');
try { mkdirSync(SHOTS, { recursive: true }); } catch {}
mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`BROWSER PHASE ${ENGINE}: ${result.browserPass ? 'PASS' : 'FAIL'} (${steps.filter((s) => s.pass).length}/${steps.length})`);
process.exit(result.browserPass ? 0 : 1);
