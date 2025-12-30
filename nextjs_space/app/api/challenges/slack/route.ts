import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SLACK_CHANNEL_ID = 'C0A604Q05L3'
const SLACK_CHANNEL_NAME = 'fotoai'

function getSlackToken(): string | null {
  // First check environment variable (for deployed environment)
  if (process.env.SLACK_ACCESS_TOKEN) {
    return process.env.SLACK_ACCESS_TOKEN
  }
  // Fallback to secrets file (for development)
  try {
    const secretsPath = '/home/ubuntu/.config/abacusai_auth_secrets.json'
    if (fs.existsSync(secretsPath)) {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'))
      return secrets?.slack?.secrets?.access_token?.value || 
             secrets?.SLACK?.secrets?.access_token?.value || null
    }
  } catch (error) {
    console.error('Error reading Slack token:', error)
  }
  return null
}

export async function POST(request: NextRequest) {
  console.log('📱 Slack Challenge Endpoint Called')

  try {
    const body = await request.json()
    const { challengeText, category, difficulty, duration, location, recommendedGear, tips, weatherConditions, detailedDescription } = body

    console.log('Challenge data received:', { challengeText, category })

    if (!challengeText) {
      return NextResponse.json(
        { success: false, error: 'Challenge text is required' },
        { status: 400 }
      )
    }

    const slackToken = getSlackToken()
    if (!slackToken) {
      console.error('❌ Slack token not found')
      return NextResponse.json(
        { success: false, error: 'Slack not configured' },
        { status: 500 }
      )
    }

    // Build Slack message blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📸 New Photography Challenge!',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${challengeText}*`
        }
      }
    ]

    // Add metadata if available
    const metaFields = []
    if (category) metaFields.push({ type: 'mrkdwn', text: `*Category:* ${category}` })
    if (difficulty) metaFields.push({ type: 'mrkdwn', text: `*Difficulty:* ${difficulty}` })
    if (duration) metaFields.push({ type: 'mrkdwn', text: `*Duration:* ${duration}` })
    if (location) metaFields.push({ type: 'mrkdwn', text: `*Location:* ${location}` })

    if (metaFields.length > 0) {
      blocks.push({
        type: 'section',
        fields: metaFields.slice(0, 10) // Slack limit
      } as any)
    }

    // Add detailed description
    if (detailedDescription) {
      blocks.push(
        { type: 'divider' } as any,
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: detailedDescription.substring(0, 2900) // Slack limit
          }
        } as any
      )
    }

    // Add gear and tips
    if (recommendedGear || tips) {
      blocks.push({ type: 'divider' } as any)
      if (recommendedGear) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📷 Recommended Gear:* ${recommendedGear}`
          }
        } as any)
      }
      if (tips) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*💡 Tips:* ${tips}`
          }
        } as any)
      }
    }

    // Add weather if available
    if (weatherConditions) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `☀️ Weather: ${weatherConditions}`
          }
        ]
      } as any)
    }

    // Add footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent from *Foto* - Your Photography Coach | ${new Date().toLocaleDateString()}`
        }
      ]
    } as any)

    // Send to Slack
    console.log('📤 Sending to Slack channel:', SLACK_CHANNEL_ID)
    
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL_ID,
        text: `📸 New Challenge: ${challengeText}`,
        blocks: blocks
      })
    })

    const result = await response.json()

    if (result.ok) {
      console.log('✅ Slack message sent successfully')
      return NextResponse.json({
        success: true,
        message: `Challenge sent to #${SLACK_CHANNEL_NAME}!`,
        ts: result.ts
      })
    } else {
      console.error('❌ Slack API error:', result.error)
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send to Slack' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Slack endpoint error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
