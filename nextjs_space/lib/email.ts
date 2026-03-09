
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
 * Send weekly progress report
 */
export async function sendWeeklyReport(
  userEmail: string,
  userName: string,
  report: {
    challengesCompleted: number;
    currentStreak: number;
    favoriteSubjects: string[];
    weekHighlight?: string;
  }
): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .stats { display: flex; justify-content: space-around; padding: 30px; background: white; }
    .stat { text-align: center; }
    .stat-number { font-size: 36px; font-weight: bold; color: #f5576c; }
    .stat-label { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Progress Report</h1>
      <p>Great work this week, ${userName}!</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${report.challengesCompleted}</div>
        <div class="stat-label">Challenges Completed</div>
      </div>
      <div class="stat">
        <div class="stat-number">${report.currentStreak}</div>
        <div class="stat-label">Day Streak</div>
      </div>
    </div>
    <div style="padding: 30px; background: #f8f9fa;">
      ${report.favoriteSubjects.length > 0 ? `
        <h3>Your Top Categories</h3>
        <p>${report.favoriteSubjects.join(', ')}</p>
      ` : ''}
      ${report.weekHighlight ? `
        <h3>Week Highlight</h3>
        <p>${report.weekHighlight}</p>
      ` : ''}
      <p style="text-align: center; margin-top: 30px;">
        <a href="https://myfoto.topues.com/dashboard" style="display: inline-block; padding: 12px 24px; background: #f5576c; color: white; text-decoration: none; border-radius: 6px;">View Full Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return await sendEmail({
    to: userEmail,
    subject: `Your Week in Photography - ${report.challengesCompleted} challenges completed!`,
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
