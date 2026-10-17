// lib/email.ts templates: every interpolated value is HTML-escaped; plain text stays plain.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildChallengeEmail, buildWeatherAlertEmail, buildWeeklyReportEmail, escapeHtml } from '../../lib/email.ts';

const EVIL = '<a href=//evil>x</a>';
const EVIL_ESCAPED = '&lt;a href=//evil&gt;x&lt;/a&gt;';
const QUOTES = `"'&`;

function assertNoRawInjection(html: string) {
  assert.ok(!html.includes(EVIL), 'raw markup from a value reached the HTML');
  assert.ok(!html.includes('<a href=//evil>'), 'injected link');
}

test('escapeHtml: escapes & < > " \' and leaves plain text alone', () => {
  assert.equal(escapeHtml(EVIL), EVIL_ESCAPED);
  assert.equal(escapeHtml(QUOTES), '&quot;&#39;&amp;');
  assert.equal(escapeHtml('Golden hour, f/8'), 'Golden hour, f/8');
  assert.equal(escapeHtml(42), '42');
});

test('challenge email: name and every challenge field are escaped in HTML; text keeps the raw words', () => {
  const email = buildChallengeEmail(EVIL, {
    challengeText: `Shoot ${EVIL}`,
    difficulty: EVIL,
    category: EVIL,
    duration: EVIL,
    tips: `${QUOTES}${EVIL}`,
    recommendedGear: [EVIL, 'X-T5'],
  });
  assertNoRawInjection(email.html);
  assert.ok(email.html.includes(`Ready to create something amazing, ${EVIL_ESCAPED}?`));
  assert.ok(email.html.includes(`Shoot ${EVIL_ESCAPED}`));
  assert.ok(email.html.includes(`<span class="badge">${EVIL_ESCAPED}</span>`));
  assert.ok(email.html.includes(`<li>${EVIL_ESCAPED}</li>`));
  assert.ok(email.html.includes('&quot;&#39;&amp;'));
  assert.ok(email.html.includes('<a href="https://myfoto.topues.com/dashboard"'), 'template markup itself is untouched');
  assert.ok(email.text?.includes(`Hi ${EVIL},`), 'text part is plain, not escaped');
});

test('weekly report email: name, insights, highlights and favourite subjects are escaped in HTML', () => {
  const email = buildWeeklyReportEmail(EVIL, {
    challengesCompleted: 2,
    challengesCompletedLastWeek: 1,
    currentStreak: 3,
    longestStreak: 9,
    averageScore: 80,
    previousAverageScore: 70,
    completionRate: 67,
    favoriteSubjects: [EVIL, 'street'],
    insights: {
      summary: EVIL,
      highlights: [EVIL],
      skillBreakdown: EVIL,
      recommendation: EVIL,
      motivationalNote: EVIL,
    },
  });
  assertNoRawInjection(email.html);
  assert.ok(email.html.includes(`<p>${EVIL_ESCAPED}, here's how your week in photography went</p>`));
  assert.ok(email.html.includes(`<li>${EVIL_ESCAPED}</li>`));
  assert.ok(email.html.includes(`${EVIL_ESCAPED} &bull; street`));
  assert.equal(email.html.split(EVIL_ESCAPED).length - 1, 7, 'name, 5 insight fields, 1 subject');
  assert.ok(email.html.includes('<div class="stat-number">2</div>'));
  assert.ok(email.text?.includes(`Your Weekly Insights — ${EVIL}`));
});

test('weather alert email: condition, message and suggestion are escaped in HTML', () => {
  const email = buildWeatherAlertEmail(EVIL, { condition: EVIL, message: EVIL, suggestion: EVIL });
  assertNoRawInjection(email.html);
  assert.equal(email.html.split(EVIL_ESCAPED).length - 1, 3);
});
