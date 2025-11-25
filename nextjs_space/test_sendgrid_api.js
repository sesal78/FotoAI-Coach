const sgMail = require('@sendgrid/mail');

const SENDGRID_API_KEY = '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';

async function testSendGrid() {
  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    
    const msg = {
      to: 'seun_salami@outlook.com',
      from: {
        email: 'seun@topues.com',
        name: 'Seun - Foto Coach'
      },
      subject: 'Test Email from Foto',
      text: 'This is a test email',
      html: '<p>This is a test email</p>'
    };
    
    console.log('Sending test email...');
    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully!');
    console.log('Status:', response[0].statusCode);
  } catch (error) {
    console.error('❌ SendGrid Error:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    if (error.response?.body) {
      console.error('Response:', JSON.stringify(error.response.body, null, 2));
    }
  }
}

testSendGrid();