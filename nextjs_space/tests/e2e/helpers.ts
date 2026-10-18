// Helpers for the local e2e stack: a throwaway account per run, confirmed through
// the local Supabase Mailpit inbox. Nothing here may target a non-local host.

import { expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(MAILPIT)) {
  throw new Error(`E2E_MAILPIT_URL must be local, got ${MAILPIT}`);
}

export interface TestAccount { name: string; email: string; password: string }

export function newAccount(): TestAccount {
  const id = `${Date.now()}${randomBytes(3).toString('hex')}`;
  return { name: 'E2E Tester', email: `e2e+${id}@localhost.test`, password: `E2e-${randomBytes(9).toString('base64url')}` };
}

/** Waits for the newest Mailpit message to `to` whose subject matches, and returns its first link. */
export async function latestEmailLink(to: string, subject: RegExp, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const hit = (list.messages ?? []).find((m: { Subject: string }) => subject.test(m.Subject));
    if (hit) {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`).then((r) => r.json());
      const link = String(msg.HTML || msg.Text).match(/href="([^"]+)"/)?.[1];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No "${subject}" email for ${to} within ${timeoutMs} ms`);
}

export async function signUpAndConfirm(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/signup');
  await page.getByPlaceholder('Alex Johnson').fill(account.name);
  await page.getByPlaceholder('you@example.com').fill(account.email);
  await page.getByPlaceholder('Min. 8 characters').fill(account.password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText(/confirm your email/i)).toBeVisible();
  await page.goto(await latestEmailLink(account.email, /confirm/i));
  await expect(page).toHaveURL(/\/login\?verified=1/);
}

export async function logIn(page: Page, account: TestAccount, password = account.password): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(account.email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Sends one chat message and waits for the coach's reply to finish. */
export async function askCoach(page: Page, text: string): Promise<void> {
  await page.goto('/chat');
  const box = page.getByPlaceholder(/ask for a challenge/i);
  await box.fill(text);
  const reply = page.waitForResponse((r) => r.url().endsWith('/api/fotoai/chat') && r.request().method() === 'POST', { timeout: 120_000 });
  await box.press('Enter');
  expect((await reply).status()).toBe(200);
}
