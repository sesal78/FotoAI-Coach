import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function GET(request: Request) {
  try {
    console.log('🔍 Email Test Endpoint Called');
    console.log('Environment check:');
    console.log('  - SENDGRID_API_KEY present:', !!process.env.SENDGRID_API_KEY);
    console.log('  - FROM_EMAIL:', process.env.FROM_EMAIL);
    console.log('  - USER_EMAIL:', process.env.USER_EMAIL);

    // Send test email
    const testEmailSent = await sendEmail({
      to: process.env.USER_EMAIL || 'seun_salami@outlook.com',
      subject: '📧 Test Email from Foto App',
      text: 'This is a test email to verify SendGrid configuration is working correctly.',
      html: '<h1>Test Email</h1><p>This is a test email to verify SendGrid configuration is working correctly.</p>'
    });

    if (testEmailSent) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        recipient: process.env.USER_EMAIL || 'seun_salami@outlook.com',
        config: {
          hasApiKey: !!process.env.SENDGRID_API_KEY,
          fromEmail: process.env.FROM_EMAIL,
          userEmail: process.env.USER_EMAIL
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to send test email',
        config: {
          hasApiKey: !!process.env.SENDGRID_API_KEY,
          fromEmail: process.env.FROM_EMAIL,
          userEmail: process.env.USER_EMAIL
        }
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ Email test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
