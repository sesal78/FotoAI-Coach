
// Email notification utilities — SMTP primary, Resend fallback
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// ── SMTP (primary) ──────────────────────────────────────────────────────────

const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// ── Resend (fallback) ───────────────────────────────────────────────────────

const resendConfigured = !!process.env.RESEND_API_KEY;
const resend = resendConfigured ? new Resend(process.env.RESEND_API_KEY) : null;

// Startup warnings
if (!smtpConfigured && !resendConfigured) {
  console.error('No email provider configured — set SMTP_* or RESEND_API_KEY env vars');
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * Sanitize text to remove invalid unicode characters
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .replace(/\uFFFD/g, '')
    .trim();
}

/**
 * Build common email fields from options
 */
function buildEmailFields(options: EmailOptions) {
  const fromEmail = options.from || process.env.FROM_EMAIL || 'noreply@myfoto.topues.com';
  const fromName = options.fromName || process.env.FROM_NAME || 'Foto AI Coach';
  const replyTo = options.replyTo || process.env.REPLY_TO_EMAIL || fromEmail;
  const subject = sanitizeText(options.subject);
  const html = options.html ? sanitizeText(options.html) : undefined;
  const text = options.text ? sanitizeText(options.text) : undefined;
  return { fromEmail, fromName, replyTo, subject, html, text };
}

/**
 * Try sending via SMTP
 */
async function sendViaSmtp(options: EmailOptions): Promise<boolean> {
  if (!transporter) return false;

  const { fromEmail, fromName, replyTo, subject, html, text } = buildEmailFields(options);

  const mailOptions: nodemailer.SendMailOptions = {
    from: `${fromName} <${fromEmail}>`,
    to: options.to,
    subject,
    replyTo: replyTo !== fromEmail ? replyTo : undefined,
    html: html || undefined,
    text: text || subject,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[SMTP] Email sent to ${options.to} — messageId: ${info.messageId}`);
  return true;
}

/**
 * Try sending via Resend
 */
async function sendViaResend(options: EmailOptions): Promise<boolean> {
  if (!resend) return false;

  const { fromEmail, fromName, replyTo, subject, html, text } = buildEmailFields(options);

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [options.to],
    subject,
    replyTo: replyTo !== fromEmail ? replyTo : undefined,
    html: html || undefined,
    text: text || subject,
  });

  if (error) throw new Error(error.message);
  console.log(`[Resend] Email sent to ${options.to}`);
  return true;
}

/**
 * Send an email — tries SMTP first, falls back to Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try SMTP first
  if (smtpConfigured) {
    try {
      return await sendViaSmtp(options);
    } catch (error: any) {
      console.error(`[SMTP] Failed: ${error.message}`);
      if (!resendConfigured) return false;
      console.log('[SMTP] Falling back to Resend...');
    }
  }

  // Fallback to Resend
  if (resendConfigured) {
    try {
      return await sendViaResend(options);
    } catch (error: any) {
      console.error(`[Resend] Failed: ${error.message}`);
      return false;
    }
  }

  console.error('No email provider available');
  return false;
}

/**
 * Send daily challenge notification
 */
export async function sendChallengeEmail(
  userEmail: string,
  userName: string,
  challenge: {
    challengeText: string;
    difficulty: string;
    category: string;
    duration: string;
    tips: string;
    recommendedGear: string[];
  }
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
    .challenge-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
    .badge { display: inline-block; padding: 4px 12px; background: #667eea; color: white; border-radius: 20px; font-size: 12px; margin-right: 8px; }
    .gear-list { list-style: none; padding: 0; }
    .gear-list li { padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
    .cta-button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Your Daily Photo Challenge</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Ready to create something amazing, ${userName}?</p>
    </div>
    <div class="content">
      <div class="challenge-box">
        <div style="margin-bottom: 15px;">
          <span class="badge">${challenge.category}</span>
          <span class="badge">${challenge.difficulty}</span>
          <span class="badge">${challenge.duration}</span>
        </div>
        <h2 style="color: #667eea; margin-top: 0;">Today's Challenge</h2>
        <p style="font-size: 16px; line-height: 1.8;">${challenge.challengeText}</p>

        <h3 style="color: #764ba2;">Pro Tips</h3>
        <p style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 3px solid #ffc107;">${challenge.tips}</p>

        ${challenge.recommendedGear.length > 0 ? `
        <h3 style="color: #764ba2;">Recommended Gear</h3>
        <ul class="gear-list">
          ${challenge.recommendedGear.map(gear => `<li>${gear}</li>`).join('')}
        </ul>
        ` : ''}
      </div>

      <p style="text-align: center; color: #666;">
        <a href="https://myfoto.topues.com/dashboard" class="cta-button">View Challenge & Submit Photos</a>
      </p>

      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        You're receiving this because you're enrolled in Foto AI photography coaching.<br>
        Keep shooting!
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Your Daily Photo Challenge

Hi ${userName},

Today's Challenge (${challenge.category} | ${challenge.difficulty} | ${challenge.duration}):
${challenge.challengeText}

Pro Tips:
${challenge.tips}

${challenge.recommendedGear.length > 0 ? `Recommended Gear:\n${challenge.recommendedGear.map(g => `- ${g}`).join('\n')}` : ''}

View your challenge and submit photos at: https://myfoto.topues.com/dashboard

Keep shooting!
- Foto AI
  `;

  return await sendEmail({
    to: userEmail,
    subject: `Your ${challenge.category} challenge is ready!`,
    text,
    html,
  });
}

/**
 * Send weekly progress report with AI-generated insights
 */
export async function sendWeeklyReport(
  userEmail: string,
  userName: string,
  report: {
    challengesCompleted: number;
    challengesCompletedLastWeek: number;
    currentStreak: number;
    longestStreak: number;
    averageScore: number | null;
    previousAverageScore: number | null;
    completionRate: number;
    favoriteSubjects: string[];
    insights: {
      summary: string;
      highlights: string[];
      skillBreakdown: string;
      recommendation: string;
      motivationalNote: string;
    };
  }
): Promise<boolean> {
  const challengeTrendIcon = report.challengesCompleted > report.challengesCompletedLastWeek ? '&#9650;' : report.challengesCompleted < report.challengesCompletedLastWeek ? '&#9660;' : '&#9644;';
  const challengeTrendColor = report.challengesCompleted >= report.challengesCompletedLastWeek ? '#2e7d32' : '#c62828';
  const scoreTrendIcon = report.averageScore !== null && report.previousAverageScore !== null
    ? (report.averageScore > report.previousAverageScore ? '&#9650;' : report.averageScore < report.previousAverageScore ? '&#9660;' : '&#9644;')
    : '';
  const scoreTrendColor = report.averageScore !== null && report.previousAverageScore !== null
    ? (report.averageScore >= report.previousAverageScore ? '#2e7d32' : '#c62828')
    : '#666';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .stats-row { display: flex; justify-content: space-around; padding: 24px 16px; background: white; border-bottom: 1px solid #eee; }
    .stat { text-align: center; flex: 1; }
    .stat-number { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .stat-trend { font-size: 12px; margin-top: 2px; }
    .content { padding: 24px; background: #f8f9fa; }
    .section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .section h3 { margin: 0 0 12px; color: #667eea; font-size: 16px; }
    .highlight-list { padding-left: 0; list-style: none; margin: 0; }
    .highlight-list li { padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .highlight-list li:last-child { border-bottom: none; }
    .highlight-list li::before { content: "\\2713 "; color: #2e7d32; font-weight: bold; margin-right: 6px; }
    .recommendation-box { background: #fff3cd; padding: 16px; border-radius: 6px; border-left: 4px solid #ffc107; font-size: 14px; }
    .cta-button { display: inline-block; padding: 12px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Weekly Insights</h1>
      <p>${userName}, here's how your week in photography went</p>
    </div>

    <div class="stats-row">
      <div class="stat">
        <div class="stat-number">${report.challengesCompleted}</div>
        <div class="stat-label">Completed</div>
        <div class="stat-trend" style="color: ${challengeTrendColor};">${challengeTrendIcon} vs last week (${report.challengesCompletedLastWeek})</div>
      </div>
      <div class="stat">
        <div class="stat-number">${report.currentStreak}</div>
        <div class="stat-label">Day Streak</div>
        <div class="stat-trend" style="color: #666;">Best: ${report.longestStreak}</div>
      </div>
      <div class="stat">
        <div class="stat-number">${report.averageScore !== null ? report.averageScore : '—'}</div>
        <div class="stat-label">Avg Score</div>
        ${report.averageScore !== null ? `<div class="stat-trend" style="color: ${scoreTrendColor};">${scoreTrendIcon} vs last week</div>` : '<div class="stat-trend" style="color: #666;">No critiques</div>'}
      </div>
      <div class="stat">
        <div class="stat-number">${report.completionRate}%</div>
        <div class="stat-label">Completion</div>
      </div>
    </div>

    <div class="content">
      <div class="section">
        <h3>Summary</h3>
        <p style="font-size: 15px; margin: 0;">${report.insights.summary}</p>
      </div>

      ${report.insights.highlights.length > 0 ? `
      <div class="section">
        <h3>Highlights</h3>
        <ul class="highlight-list">
          ${report.insights.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${report.insights.skillBreakdown ? `
      <div class="section">
        <h3>Skill Progress</h3>
        <p style="font-size: 14px; margin: 0;">${report.insights.skillBreakdown}</p>
      </div>
      ` : ''}

      ${report.favoriteSubjects.length > 0 ? `
      <div class="section">
        <h3>Top Categories</h3>
        <p style="font-size: 14px; margin: 0;">${report.favoriteSubjects.join(' &bull; ')}</p>
      </div>
      ` : ''}

      <div class="section">
        <h3>Recommendation for Next Week</h3>
        <div class="recommendation-box">${report.insights.recommendation}</div>
      </div>

      <div style="text-align: center; padding: 8px 0;">
        <p style="font-style: italic; color: #555; font-size: 14px;">${report.insights.motivationalNote}</p>
        <a href="https://myfoto.topues.com/progress" class="cta-button">View Full Progress</a>
      </div>
    </div>

    <div class="footer">
      You're receiving this because you're enrolled in Foto AI photography coaching.<br>
      Keep shooting!
    </div>
  </div>
</body>
</html>
  `;

  const text = `Your Weekly Insights — ${userName}

${report.insights.summary}

Challenges completed: ${report.challengesCompleted} (last week: ${report.challengesCompletedLastWeek})
Streak: ${report.currentStreak} days (best: ${report.longestStreak})
${report.averageScore !== null ? `Average critique score: ${report.averageScore}/100` : ''}
Completion rate: ${report.completionRate}%

${report.insights.highlights.map(h => `- ${h}`).join('\n')}

${report.insights.skillBreakdown}

Recommendation: ${report.insights.recommendation}

${report.insights.motivationalNote}

View your progress: https://myfoto.topues.com/progress
  `;

  return await sendEmail({
    to: userEmail,
    subject: `Your Week in Photography — ${report.challengesCompleted} challenges completed!`,
    text,
    html,
  });
}

/**
 * Send weather alert
 */
export async function sendWeatherAlert(
  userEmail: string,
  userName: string,
  alert: {
    condition: string;
    message: string;
    suggestion: string;
  }
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box { background: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert-box">
      <h2>Weather Alert for Photography</h2>
      <p><strong>${alert.condition}</strong></p>
      <p>${alert.message}</p>
      <p style="background: white; padding: 15px; border-radius: 6px; margin-top: 15px;">
        <strong>Suggestion:</strong> ${alert.suggestion}
      </p>
      <p style="text-align: center; margin-top: 20px;">
        <a href="https://myfoto.topues.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #ffc107; color: #333; text-decoration: none; border-radius: 6px; font-weight: 500;">Go to Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `Perfect Photo Weather: ${alert.condition}`,
    html,
  });
}
