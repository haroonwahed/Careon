import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '/Users/haroonwahed/Documents/Projects/Careon/client/node_modules/playwright/index.mjs';

const ROOT = '/Users/haroonwahed/Documents/Projects/Careon';
const OUT_DIR = path.join(ROOT, 'design-audit');
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots');
const MANIFEST_PATH = path.join(OUT_DIR, 'audit-manifest.json');
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:8000';
const WIDTH = 1440;
const HEIGHT = 900;

const routesPublic = [
  { name: 'home', url: `${BASE}/`, file: '01-home.png' },
  { name: 'login', url: `${BASE}/login/`, file: '02-login.png' },
  { name: 'register', url: `${BASE}/register/`, file: '03-register.png' },
];

const routesAuth = [
  { name: 'dashboard', url: `${BASE}/dashboard/`, file: '04-dashboard.png' },
  { name: 'regiekamer', url: `${BASE}/dashboard/`, file: '05-regiekamer.png' },
  { name: 'casussen-list', url: `${BASE}/care/casussen/`, file: '06-casussen-list.png' },
  { name: 'casussen-create', url: `${BASE}/care/casussen/new/`, file: '07-casussen-create.png' },
  { name: 'case-detail-84', url: `${BASE}/care/casussen/84/`, file: '08-casus-detail-84.png' },
  { name: 'case-workspace-98', url: `${BASE}/care/cases/98/?tab=matching`, file: '09-case-workspace-98.png' },
  { name: 'matching', url: `${BASE}/care/matching/`, file: '10-matching.png' },
  { name: 'beoordelingen-list', url: `${BASE}/care/beoordelingen/`, file: '11-beoordelingen-list.png' },
  { name: 'beoordeling-detail-35', url: `${BASE}/care/beoordelingen/35/`, file: '12-beoordeling-detail-35.png' },
  { name: 'plaatsingen-list', url: `${BASE}/care/plaatsingen/`, file: '13-plaatsingen-list.png' },
  { name: 'plaatsing-detail-21', url: `${BASE}/care/plaatsingen/21/`, file: '14-plaatsing-detail-21.png' },
  { name: 'intake-overdracht', url: `${BASE}/care/intake-overdracht/`, file: '15-intake-overdracht.png' },
  { name: 'clients-list', url: `${BASE}/care/clients/`, file: '16-clients-list.png' },
  { name: 'client-detail-16', url: `${BASE}/care/clients/16/`, file: '17-client-detail-16.png' },
  { name: 'gemeenten-list', url: `${BASE}/care/gemeenten/`, file: '18-gemeenten-list.png' },
  { name: 'regions-list', url: `${BASE}/care/regio%27s/`, file: '19-regios-list.png' },
  { name: 'documents-list', url: `${BASE}/care/documents/`, file: '20-documents-list.png' },
  { name: 'document-detail-11', url: `${BASE}/care/documents/11/`, file: '21-document-detail-11.png' },
  { name: 'tasks-list', url: `${BASE}/care/tasks/`, file: '22-tasks-list.png' },
  { name: 'signals-list', url: `${BASE}/care/signalen/`, file: '23-signals-list.png' },
  { name: 'signal-detail-12', url: `${BASE}/care/signalen/12/`, file: '24-signal-detail-12.png' },
  { name: 'budgets-list', url: `${BASE}/care/budgets/`, file: '25-budgets-list.png' },
  { name: 'budget-detail-1', url: `${BASE}/care/budgets/1/`, file: '26-budget-detail-1.png' },
  { name: 'deadlines-list', url: `${BASE}/care/deadlines/`, file: '27-deadlines-list.png' },
  { name: 'waittimes-list', url: `${BASE}/care/wachttijden/`, file: '28-wachttijden-list.png' },
  { name: 'audit-log', url: `${BASE}/care/audit-log/`, file: '29-audit-log.png' },
  { name: 'reports', url: `${BASE}/care/reports/`, file: '30-reports.png' },
  { name: 'provider-responses', url: `${BASE}/care/regiekamer/provider-responses/`, file: '31-provider-responses.png' },
  { name: 'organization-team', url: `${BASE}/care/organizations/team/`, file: '32-organization-team.png' },
  { name: 'organization-activity', url: `${BASE}/care/organizations/activity/`, file: '33-organization-activity.png' },
  { name: 'profile', url: `${BASE}/profile/`, file: '34-profile.png' },
  { name: 'settings', url: `${BASE}/settings/`, file: '35-settings.png' },
  { name: 'design-mode', url: `${BASE}/settings/design-mode/`, file: '36-design-mode.png' },
  { name: 'search', url: `${BASE}/care/search/?q=test`, file: '37-search.png' },
  { name: 'notifications', url: `${BASE}/care/notifications/`, file: '38-notifications.png' },
  { name: 'workflows', url: `${BASE}/care/workflows/`, file: '39-workflows.png' },
  { name: 'workflow-detail-1', url: `${BASE}/care/workflows/1/`, file: '40-workflow-detail-1.png' },
  { name: 'workflow-step-update-1', url: `${BASE}/care/workflows/step/1/update/`, file: '41-workflow-step-update-1.png' },
  { name: 'case-not-found', url: `${BASE}/care/does-not-exist/`, file: '42-404.png' },
];

async function capturePage(page, route) {
  const consoleEntries = [];
  const pageErrors = [];
  const requestFailures = [];

  const onConsole = (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleEntries.push({ type: msg.type(), text: msg.text() });
    }
  };
  const onPageError = (err) => pageErrors.push(err.message);
  const onRequestFailed = (req) => requestFailures.push({ url: req.url(), failure: req.failure()?.errorText ?? 'failed' });

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  try {
    await page.goto(route.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  } catch (err) {
    requestFailures.push({ url: route.url, failure: err.message });
  }

  const title = await page.title().catch(() => '');
  const finalUrl = page.url();
  const pathName = route.file;
  const screenshotPath = path.join(SHOTS_DIR, pathName);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 60000 });
  } catch (err) {
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 60000 });
    } catch (fallbackErr) {
      requestFailures.push({ url: finalUrl, failure: `screenshot failed: ${fallbackErr.message}` });
    }
  }

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('requestfailed', onRequestFailed);

  return {
    ...route,
    title,
    finalUrl,
    screenshot: path.join('screenshots', pathName),
    consoleEntries,
    pageErrors,
    requestFailures,
  };
}

async function login(page, username, password) {
  await page.goto(`${BASE}/login/`, { waitUntil: 'load', timeout: 60000 });
  await page.getByLabel('Gebruikersnaam', { exact: true }).fill(username);
  await page.getByLabel('Wachtwoord', { exact: true }).fill(password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
    page.getByRole('button', { name: 'Inloggen' }).click(),
  ]);
}

await fs.mkdir(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

const publicContext = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
const publicPage = await publicContext.newPage();
const publicResults = [];
for (const route of routesPublic) {
  publicResults.push(await capturePage(publicPage, route));
}
await publicContext.close();

const authContext = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
const authPage = await authContext.newPage();
await login(authPage, 'pilot.owner', 'PilotPass123!');
const authResults = [];
for (const route of routesAuth) {
  authResults.push(await capturePage(authPage, route));
}
await authContext.close();
await browser.close();

const manifest = {
  capturedAt: new Date().toISOString(),
  baseUrl: BASE,
  publicResults,
  authResults,
};

await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${MANIFEST_PATH}`);
console.log(`Screenshots in ${SHOTS_DIR}`);
