
// Email notification utilities using SendGrid
import * as sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY is not set in environment variables');
} else {
  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('✅ SendGrid API key configured');
  } catch (error: any) {
    console.error('❌ Failed to configure SendGrid:', error.message);
  }
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
 * Send an email via SendGrid with Reply-To support
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // Validate API key is set
    if (!SENDGRID_API_KEY) {
      console.error('❌ Cannot send email: SENDGRID_API_KEY is not configured');
      return false;
    }

    const fromEmail = options.from || process.env.FROM_EMAIL || 'noreply@myfoto.topues.com';
    const fromName = options.fromName || process.env.FROM_NAME || 'Foto AI Coach';
    const replyToEmail = options.replyTo || process.env.REPLY_TO_EMAIL || fromEmail;

    console.log('📧 Preparing to send email:');
    console.log('  - To:', options.to);
    console.log('  - From:', `${fromName} <${fromEmail}>`);
    console.log('  - Subject:', options.subject);
    console.log('  - API Key present:', !!SENDGRID_API_KEY);

    const msg: any = {
      to: options.to,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: options.subject,
    };

    // Add reply-to if different from from email
    if (replyToEmail !== fromEmail) {
      msg.replyTo = replyToEmail;
    }

    // Add text or html content
    if (options.html) {
      msg.html = options.html;
    }
    if (options.text) {
      msg.text = options.text;
    }
    // Fallback to text if no html
    if (!msg.html && !msg.text) {
      msg.text = options.subject;
    }

    console.log('📤 Sending email via SendGrid...');
    console.log('   Message object:', JSON.stringify({
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      hasHtml: !!msg.html,
      hasText: !!msg.text
    }, null, 2));

    const response = await sgMail.send(msg);
    console.log(`✅ Email sent successfully to ${options.to}`);
    console.log(`   Status: ${response[0].statusCode}`);
    return true;
  } catch (error: any) {
    console.error('❌ Email sending failed:');
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    if (error.response?.body) {
      console.error('   Response body:', JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
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
      <h1 style="margin: 0;">📸 Your Daily Photo Challenge</h1>
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
        
        <h3 style="color: #764ba2;">💡 Pro Tips</h3>
        <p style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 3px solid #ffc107;">${challenge.tips}</p>
        
        ${challenge.recommendedGear.length > 0 ? `
        <h3 style="color: #764ba2;">🎒 Recommended Gear</h3>
        <ul class="gear-list">
          ${challenge.recommendedGear.map(gear => `<li>📷 ${gear}</li>`).join('')}
        </ul>
        ` : ''}
      </div>
      
      <p style="text-align: center; color: #666;">
        <a href="https://myfoto.topues.com/dashboard" class="cta-button">View Challenge & Submit Photos</a>
      </p>
      
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        You're receiving this because you're enrolled in Foto AI photography coaching.<br>
        Keep shooting! 📸
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
📸 Your Daily Photo Challenge

Hi ${userName},

Today's Challenge (${challenge.category} | ${challenge.difficulty} | ${challenge.duration}):
${challenge.challengeText}

💡 Pro Tips:
${challenge.tips}

${challenge.recommendedGear.length > 0 ? `🎒 Recommended Gear:\n${challenge.recommendedGear.map(g => `- ${g}`).join('\n')}` : ''}

View your challenge and submit photos at: https://myfoto.topues.com/dashboard

Keep shooting! 📸
- Foto AI
  `;

  return await sendEmail({
    to: userEmail,
    subject: `📸 Your ${challenge.category} challenge is ready!`,
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
      <h1>🎉 Weekly Progress Report</h1>
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
        <h3>📊 Your Top Categories</h3>
        <p>${report.favoriteSubjects.join(', ')}</p>
      ` : ''}
      ${report.weekHighlight ? `
        <h3>✨ Week Highlight</h3>
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
    subject: `📊 Your Week in Photography - ${report.challengesCompleted} challenges completed!`,
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
      <h2>⚡ Weather Alert for Photography</h2>
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
    subject: `⚡ Perfect Photo Weather: ${alert.condition}`,
    html,
  });
}
