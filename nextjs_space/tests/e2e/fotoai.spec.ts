// The owner's browser checks, automated (local stack only; see docs/testing-e2e.md).
// One fresh account per run; the steps share it and run in order.

import { expect, test, type Page } from '@playwright/test';

import { askCoach, latestEmailLink, logIn, newAccount, signUpAndConfirm } from './helpers';

test.describe.configure({ mode: 'serial' });

const account = newAccount();
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

/** The account's challenge texts, as the History tab loads them. */
async function historyTexts(): Promise<string[]> {
  return page.evaluate(async () => {
    const res = await fetch('/api/fotoai/challenges?status=all&limit=20');
    const body = await res.json();
    // This endpoint returns database rows (snake_case); the page's client maps them.
    return (body.challenges ?? []).map((c: { challenge_text: string }) => c.challenge_text);
  });
}

test('sign up, confirm the email, and log in', async () => {
  await signUpAndConfirm(page, account);
  await expect(page.getByText(/email verified/i)).toBeVisible();
  await logIn(page, account);
  await expect(page.getByText(/no active challenge/i)).toBeVisible();
});

test('check 1: a chat challenge shows on the dashboard without a page reload', async () => {
  await askCoach(page, 'Give me a street photography challenge for this evening in Melbourne CBD.');
  await expect(page.getByText(/active challenge/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Submit on Dashboard' }).click(); // client-side navigation
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/your mission/i)).toBeVisible();
});

test('check 2: a second, different chat challenge does not replace the first', async () => {
  await askCoach(page, 'Now give me a different challenge: portraits using window light at home tomorrow morning.');
  await expect.poll(async () => new Set(await historyTexts()).size, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  await page.goto('/dashboard');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('button', { name: 'Continue this challenge' })).toBeVisible();
});

test('check 4: a generated challenge carries live weather', async () => {
  // Weather comes from Open-Meteo. When that outside service is down the app correctly carries on
  // without weather, so this check is skipped (not failed) instead of testing someone else's outage.
  const weatherUp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-37.8&longitude=144.9&current=temperature_2m',
    { signal: AbortSignal.timeout(15_000) }).then((r) => r.ok).catch(() => false);
  test.skip(!weatherUp, 'Open-Meteo forecast service is unreachable right now');
  await page.goto('/dashboard');
  const done = page.waitForResponse((r) => r.url().endsWith('/api/fotoai/challenges/generate'), { timeout: 120_000 });
  await page.getByRole('button', { name: /^Generate .* Challenge$/ }).click();
  expect((await done).ok()).toBe(true);
  await expect(page.getByText(/°F/)).toBeVisible();
});

test('check 3: Continue an older challenge from History, then submit it', async () => {
  await page.goto('/dashboard');
  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Continue this challenge' }).first().click();
  await expect(page.getByRole('tab', { name: 'Current Challenge' })).toHaveAttribute('data-state', 'active');
  await page.getByPlaceholder(/share your experience/i).fill('E2E: continued from History.');
  const submitted = page.waitForResponse((r) => r.url().endsWith('/api/fotoai/submissions') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit Challenge' }).click();
  expect((await submitted).status()).toBe(201);
  await expect(page.getByText(/^1$/).first()).toBeVisible(); // completed count
});

test('check 5: an expired access cookie is renewed from the refresh cookie', async () => {
  await page.context().clearCookies({ name: 'fotoai_session' });
  const statuses = await page.evaluate(async () => Promise.all(
    ['/api/fotoai/auth/me', '/api/fotoai/progress', '/api/fotoai/skills'].map((u) => fetch(u).then((r) => r.status)),
  ));
  expect(statuses).toEqual([200, 200, 200]);
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === 'fotoai_session')).toBe(true);
});

test('check 6: forgot password, reset by email link, log in with the new password', async () => {
  await page.evaluate(() => fetch('/api/fotoai/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  await page.goto('/forgot-password');
  await page.getByPlaceholder('you@example.com').fill(account.email);
  await page.getByRole('button', { name: /send reset link/i }).click();
  await page.goto(await latestEmailLink(account.email, /reset/i));
  await expect(page).toHaveURL(/\/reset-password$/); // token removed from the address bar
  const newPassword = `${account.password}-2`;
  await page.getByPlaceholder('Min. 8 characters').fill(newPassword);
  await page.getByPlaceholder('Repeat your password').fill(newPassword);
  await page.getByRole('button', { name: /reset password/i }).click();
  await expect(page.getByText(/changed successfully/i)).toBeVisible();

  const status = (p: string) => page.evaluate(async ([email, password]) => (await fetch('/api/fotoai/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })).status, [account.email, p]);
  expect(await status(account.password)).toBe(401);
  await logIn(page, account, newPassword);
});
