/**
 * Email Configuration Test Script
 * Run with: npx tsx test_email.ts
 */

import { sendEmail } from './nextjs_space/lib/email';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './nextjs_space/.env' });

async function testEmailConfiguration() {
  console.log('\n🔧 Testing Email Configuration\n');
  console.log('=' .repeat(60));
  
  // Check environment variables
  console.log('\n1. Checking Environment Variables...\n');
  
  const checks = [
    { name: 'SENDGRID_API_KEY', value: process.env.SENDGRID_API_KEY },
    { name: 'FROM_EMAIL', value: process.env.FROM_EMAIL },
    { name: 'FROM_NAME', value: process.env.FROM_NAME },
    { name: 'REPLY_TO_EMAIL', value: process.env.REPLY_TO_EMAIL },
  ];
  
  let allConfigured = true;
  checks.forEach(check => {
    const status = check.value ? '✅' : '❌';
    const displayValue = check.value 
      ? (check.name === 'SENDGRID_API_KEY' ? `${check.value.substring(0, 10)}...` : check.value)
      : 'NOT SET';
    console.log(`   ${status} ${check.name}: ${displayValue}`);
    if (!check.value) allConfigured = false;
  });
  
  if (!allConfigured) {
    console.log('\n❌ Some environment variables are missing!');
    console.log('\n📝 Required variables in .env:');
    console.log('   SENDGRID_API_KEY=your_api_key');
    console.log('   FROM_EMAIL=seun_salami@outlook.com');
    console.log('   FROM_NAME=Seun - Foto Coach');
    console.log('   REPLY_TO_EMAIL=seun_salami@outlook.com');
    process.exit(1);
  }
  
  console.log('\n✅ All environment variables configured!\n');
  console.log('=' .repeat(60));
  
  // Send test email
  console.log('\n2. Sending Test Email...\n');
  
  const testEmail = process.env.USER_EMAIL || process.env.FROM_EMAIL || 'seun_salami@outlook.com';
  
  console.log(`   📧 Sending to: ${testEmail}`);
  console.log(`   From: ${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`);
  console.log(`   Reply-To: ${process.env.REPLY_TO_EMAIL}\n`);
  
  const result = await sendEmail({
    to: testEmail,
    subject: '🧪 Foto Email Test - Configuration Successful',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .success-box { background: #d4edda; border: 2px solid #28a745; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-box">
            <h2 style="color: #28a745; margin-top: 0;">✅ Email Configuration Successful!</h2>
            <p>Your Foto AI email system is now properly configured and working.</p>
          </div>
          
          <h3>Configuration Details:</h3>
          <div class="info-box">
            <p><strong>From Email:</strong> ${process.env.FROM_EMAIL}</p>
            <p><strong>From Name:</strong> ${process.env.FROM_NAME}</p>
            <p><strong>Reply-To:</strong> ${process.env.REPLY_TO_EMAIL}</p>
            <p><strong>Tested At:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <h3>✅ What's Working:</h3>
          <ul>
            <li>SendGrid API connection established</li>
            <li>Professional sender name configured</li>
            <li>Reply-To address set up</li>
            <li>Email templates ready to use</li>
          </ul>
          
          <h3>📧 Test This:</h3>
          <p>Hit the <strong>Reply</strong> button in your email client. The reply should go to: <strong>${process.env.REPLY_TO_EMAIL}</strong></p>
          
          <h3>🚀 Next Steps:</h3>
          <ol>
            <li>Verify sender in SendGrid (if not already done)</li>
            <li>Deploy your application</li>
            <li>Users will receive beautiful challenge emails!</li>
          </ol>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>⚠️ Important:</strong> Make sure <strong>${process.env.FROM_EMAIL}</strong> is verified in your SendGrid account at:<br>
            <a href="https://app.sendgrid.com/settings/sender_auth/senders">https://app.sendgrid.com/settings/sender_auth/senders</a></p>
          </div>
          
          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;">
            Keep shooting! 📸<br>
            <em>- Foto AI Team</em>
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
✅ Email Configuration Successful!

Your Foto AI email system is now properly configured and working.

Configuration Details:
- From Email: ${process.env.FROM_EMAIL}
- From Name: ${process.env.FROM_NAME}
- Reply-To: ${process.env.REPLY_TO_EMAIL}
- Tested At: ${new Date().toLocaleString()}

✅ What's Working:
- SendGrid API connection established
- Professional sender name configured
- Reply-To address set up
- Email templates ready to use

📧 Test This:
Hit the Reply button - it should go to: ${process.env.REPLY_TO_EMAIL}

🚀 Next Steps:
1. Verify sender in SendGrid (if not already done)
2. Deploy your application
3. Users will receive beautiful challenge emails!

⚠️ Important: Make sure ${process.env.FROM_EMAIL} is verified in SendGrid:
https://app.sendgrid.com/settings/sender_auth/senders

Keep shooting! 📸
- Foto AI Team
    `
  });
  
  console.log('=' .repeat(60));
  
  if (result) {
    console.log('\n✅ TEST EMAIL SENT SUCCESSFULLY!\n');
    console.log(`📬 Check your inbox: ${testEmail}`);
    console.log('   (Also check spam folder if not in inbox)\n');
    console.log('🧪 Test the Reply-To:');
    console.log('   1. Open the email');
    console.log('   2. Click Reply');
    console.log(`   3. Verify it goes to: ${process.env.REPLY_TO_EMAIL}\n`);
  } else {
    console.log('\n❌ TEST EMAIL FAILED!\n');
    console.log('Common issues:');
    console.log('1. FROM_EMAIL not verified in SendGrid');
    console.log('2. Invalid SENDGRID_API_KEY');
    console.log('3. SendGrid account suspended/limited\n');
    console.log('📝 Next steps:');
    console.log('   - Check SendGrid dashboard: https://app.sendgrid.com/');
    console.log('   - Verify sender: https://app.sendgrid.com/settings/sender_auth/senders');
    console.log('   - Check API key permissions\n');
  }
  
  console.log('=' .repeat(60));
}

// Run test
testEmailConfiguration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
