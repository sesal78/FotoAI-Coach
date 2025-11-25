
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  let userEmail = 'unknown'; // Initialize to avoid scope issues
  try {
    const body = await request.json()
    
    const {
      challengeText,
      category,
      difficulty,
      duration,
      location,
      recommendedGear,
      tips,
      weatherConditions,
      detailedDescription,
      userEmail: emailFromBody
    } = body
    
    userEmail = emailFromBody; // Assign to outer scope variable

    // Validate required fields
    if (!challengeText || !userEmail) {
      return NextResponse.json(
        { error: 'Challenge text and email are required' },
        { status: 400 }
      )
    }

    // Build email content
    const emailSubject = `📸 Your Photography Challenge: ${challengeText}`
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background-color: #f3f4f6;
              padding: 20px;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0 0 10px 0;
              font-size: 32px;
              font-weight: 700;
            }
            .header p {
              margin: 0;
              font-size: 16px;
              opacity: 0.95;
            }
            .content {
              padding: 40px 30px;
            }
            .challenge-title {
              font-size: 28px;
              color: #667eea;
              margin: 0 0 30px 0;
              font-weight: 700;
              line-height: 1.3;
              padding-bottom: 20px;
              border-bottom: 3px solid #667eea;
            }
            .challenge-description {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #667eea;
              margin-bottom: 30px;
              font-size: 16px;
              line-height: 1.8;
              color: #374151;
            }
            .details-grid {
              display: table;
              width: 100%;
              margin: 30px 0;
            }
            .detail-row {
              display: table-row;
              margin: 12px 0;
            }
            .detail-row > div {
              display: table-cell;
              padding: 16px;
              border-bottom: 1px solid #e5e7eb;
            }
            .detail-label {
              font-weight: 600;
              color: #667eea;
              font-size: 16px;
              width: 40%;
              vertical-align: top;
            }
            .detail-value {
              color: #374151;
              font-size: 15px;
              line-height: 1.6;
            }
            .section {
              margin: 30px 0;
              padding: 25px;
              background: #f9fafb;
              border-radius: 10px;
              border: 2px solid #e5e7eb;
            }
            .section-title {
              font-size: 20px;
              font-weight: 700;
              color: #667eea;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .section-content {
              color: #374151;
              font-size: 15px;
              line-height: 1.8;
            }
            .tips-box {
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #f59e0b;
              margin: 20px 0;
            }
            .gear-list {
              background: white;
              padding: 15px 20px;
              border-radius: 6px;
              margin-top: 10px;
            }
            .cta-button {
              display: inline-block;
              padding: 16px 32px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              text-align: center;
              margin: 30px 0 20px 0;
              box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
              transition: all 0.3s ease;
            }
            .footer {
              text-align: center;
              padding: 30px;
              background: #f9fafb;
              border-top: 2px solid #e5e7eb;
            }
            .footer p {
              color: #6b7280;
              font-size: 14px;
              margin: 10px 0;
            }
            @media only screen and (max-width: 600px) {
              .content {
                padding: 30px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .challenge-title {
                font-size: 24px;
              }
              .detail-row > div {
                display: block;
                padding: 12px 0;
              }
              .detail-label {
                width: 100%;
                padding-bottom: 5px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>📸 Your Photography Challenge</h1>
              <p>Ready to capture something amazing?</p>
            </div>
            
            <div class="content">
              <h2 class="challenge-title">🎯 ${challengeText}</h2>
              
              ${detailedDescription ? `
                <div class="challenge-description">
                  <strong>Challenge Description:</strong><br>
                  ${detailedDescription}
                </div>
              ` : ''}
              
              <div class="details-grid">
                ${category ? `
                  <div class="detail-row">
                    <div class="detail-label">📂 Category</div>
                    <div class="detail-value"><strong>${category}</strong></div>
                  </div>
                ` : ''}
                
                ${difficulty ? `
                  <div class="detail-row">
                    <div class="detail-label">⚡ Difficulty</div>
                    <div class="detail-value"><strong>${difficulty}</strong></div>
                  </div>
                ` : ''}
                
                ${duration ? `
                  <div class="detail-row">
                    <div class="detail-label">⏱️ Duration</div>
                    <div class="detail-value">${duration}</div>
                  </div>
                ` : ''}
                
                ${location ? `
                  <div class="detail-row">
                    <div class="detail-label">📍 Location</div>
                    <div class="detail-value">${location}</div>
                  </div>
                ` : ''}
                
                ${weatherConditions ? `
                  <div class="detail-row">
                    <div class="detail-label">🌤️ Weather</div>
                    <div class="detail-value">${weatherConditions}</div>
                  </div>
                ` : ''}
              </div>
              
              ${recommendedGear ? `
                <div class="section">
                  <div class="section-title">📸 Recommended Gear</div>
                  <div class="gear-list">
                    ${recommendedGear}
                  </div>
                </div>
              ` : ''}
              
              ${tips ? `
                <div class="tips-box">
                  <div class="section-title">💡 Pro Tips</div>
                  <div class="section-content">
                    ${tips}
                  </div>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 40px; padding: 25px; background: #f9fafb; border-radius: 10px; border: 2px solid #e5e7eb;">
                <p style="font-size: 18px; font-weight: 600; color: #667eea; margin-bottom: 10px;">
                  📸 Ready to Shoot?
                </p>
                <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 15px;">
                  This challenge was created just for you in the chat. Head back to continue your conversation with your AI photography coach!
                </p>
                <a href="https://myfoto.topues.com/chat" class="cta-button">
                  Continue Chat →
                </a>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>Happy Shooting! 📷</strong></p>
              <p>This challenge was personalized for your gear and skill level.</p>
              <p style="font-size: 12px; margin-top: 20px;">
                Foto Photography Coach • 
                <a href="https://myfoto.topues.com" style="color: #667eea; text-decoration: none;">myfoto.topues.com</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    const emailText = `
📸 FOTO PHOTOGRAPHY CHALLENGE

🎯 ${challengeText}

${detailedDescription ? `
Challenge Description:
${detailedDescription}

` : ''}═══════════════════════════════════════

CHALLENGE DETAILS:

${category ? `📂 Category: ${category}\n` : ''}${difficulty ? `⚡ Difficulty: ${difficulty}\n` : ''}${duration ? `⏱️ Duration: ${duration}\n` : ''}${location ? `📍 Location: ${location}\n` : ''}${weatherConditions ? `🌤️ Weather: ${weatherConditions}\n` : ''}
${recommendedGear ? `
═══════════════════════════════════════

📸 RECOMMENDED GEAR:
${recommendedGear}
` : ''}
${tips ? `
═══════════════════════════════════════

💡 PRO TIPS:
${tips}
` : ''}

═══════════════════════════════════════

📸 Ready to Shoot?

This challenge was created just for you in the chat. 
Head back to continue your conversation with your AI photography coach!

🔗 Continue Chat:
https://myfoto.topues.com/chat

═══════════════════════════════════════

Happy shooting! 📷

This challenge was personalized for your gear and skill level.

---
Foto Photography Coach
https://myfoto.topues.com
    `.trim()

    // Send email
    console.log('📧 Email API: Attempting to send challenge email...');
    console.log('  - Recipient:', userEmail);
    console.log('  - Subject:', emailSubject);
    console.log('  - Challenge Text:', challengeText);
    
    const emailSent = await sendEmail({
      to: userEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml
    })

    if (!emailSent) {
      console.error('❌ Email API: sendEmail returned false');
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to send email',
          details: 'SendGrid API returned false. Check server logs for details.',
          userEmail: userEmail
        },
        { status: 500 }
      )
    }

    console.log('✅ Email API: Challenge email sent successfully');
    return NextResponse.json({
      success: true,
      message: `Challenge emailed to ${userEmail}`
    })
  } catch (error: any) {
    console.error('❌ Email API: Exception while sending challenge email');
    console.error('   Error:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send email',
        details: error.message || 'Unknown error occurred',
        code: error.code || 'EXCEPTION',
        userEmail: userEmail
      },
      { status: 500 }
    )
  }
}
