
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
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
      userEmail
    } = body

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
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: #f8f9fa;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .challenge-title {
              font-size: 24px;
              color: #667eea;
              margin-top: 0;
              margin-bottom: 20px;
            }
            .detail-row {
              margin: 15px 0;
              padding: 10px;
              background: white;
              border-radius: 5px;
            }
            .detail-label {
              font-weight: 600;
              color: #667eea;
              margin-bottom: 5px;
            }
            .tips-list {
              background: white;
              padding: 15px;
              border-radius: 5px;
              margin-top: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
            .emoji {
              font-size: 1.2em;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📸 Foto Photography Challenge</h1>
          </div>
          
          <div class="content">
            <h2 class="challenge-title">🎯 ${challengeText}</h2>
            
            ${category ? `
              <div class="detail-row">
                <div class="detail-label">📂 Category</div>
                <div>${category}</div>
              </div>
            ` : ''}
            
            ${difficulty ? `
              <div class="detail-row">
                <div class="detail-label">⚡ Difficulty</div>
                <div>${difficulty}</div>
              </div>
            ` : ''}
            
            ${duration ? `
              <div class="detail-row">
                <div class="detail-label">⏱️ Duration</div>
                <div>${duration}</div>
              </div>
            ` : ''}
            
            ${location ? `
              <div class="detail-row">
                <div class="detail-label">📍 Location</div>
                <div>${location}</div>
              </div>
            ` : ''}
            
            ${recommendedGear ? `
              <div class="detail-row">
                <div class="detail-label">📸 Recommended Gear</div>
                <div>${recommendedGear}</div>
              </div>
            ` : ''}
            
            ${weatherConditions ? `
              <div class="detail-row">
                <div class="detail-label">🌤️ Weather</div>
                <div>${weatherConditions}</div>
              </div>
            ` : ''}
            
            ${tips ? `
              <div class="detail-row">
                <div class="detail-label">💡 Tips</div>
                <div class="tips-list">${tips}</div>
              </div>
            ` : ''}
            
            <div class="footer">
              <p>Happy shooting! 📷</p>
              <p>Visit your <a href="https://myfoto.topues.com/dashboard">dashboard</a> to track your progress.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const emailText = `
📸 FOTO PHOTOGRAPHY CHALLENGE

🎯 ${challengeText}

${category ? `📂 Category: ${category}` : ''}
${difficulty ? `⚡ Difficulty: ${difficulty}` : ''}
${duration ? `⏱️ Duration: ${duration}` : ''}
${location ? `📍 Location: ${location}` : ''}
${recommendedGear ? `📸 Recommended Gear: ${recommendedGear}` : ''}
${weatherConditions ? `🌤️ Weather: ${weatherConditions}` : ''}
${tips ? `💡 Tips: ${tips}` : ''}

Happy shooting! 📷

Visit your dashboard to track your progress:
https://myfoto.topues.com/dashboard
    `.trim()

    // Send email
    await sendEmail({
      to: userEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml
    })

    return NextResponse.json({
      success: true,
      message: `Challenge emailed to ${userEmail}`
    })
  } catch (error: any) {
    console.error('Error sending challenge email:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
