const sgMail = require('@sendgrid/mail');

const apiKey = process.env.SENDGRID_API_KEY || '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';

sgMail.setApiKey(apiKey);

const msg = {
  to: 'seun_salami@outlook.com',
  from: {
    email: 'seun@topues.com',
    name: 'Foto Test'
  },
  subject: 'SendGrid Test',
  text: 'This is a test email from Foto app',
  html: '<strong>This is a test email from Foto app</strong>',
};

console.log('Testing SendGrid with:');
console.log('- API Key:', apiKey.substring(0, 15) + '...');
console.log('- From:', msg.from.email);
console.log('- To:', msg.to);

sgMail
  .send(msg)
  .then((response) => {
    console.log('✅ Email sent successfully!');
    console.log('Status Code:', response[0].statusCode);
    console.log('Headers:', response[0].headers);
  })
  .catch((error) => {
    console.error('❌ Email failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  });
