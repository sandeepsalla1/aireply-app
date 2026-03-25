import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOAuthClient } from '@/lib/gmail'
import { decrypt, encrypt } from '@/lib/utils'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

/**
 * POST /api/gmail/watch
 *
 * Sets up a Gmail Push Notification "watch" for the connected Gmail account.
 * This tells Gmail: "whenever a new email arrives, notify our Pub/Sub topic".
 *
 * Gmail watch expires every 7 days — call this endpoint on first connection
 * and again weekly (via a cron job / Vercel cron).
 *
 * Prerequisites (one-time setup in Google Cloud Console):
 *   1. Enable Cloud Pub/Sub API
 *   2. Create a Pub/Sub topic: e.g., "gmail-notifications"
 *   3. Grant "Gmail API Service Account" publish rights to the topic
 *   4. Create a Pub/Sub subscription with push endpoint = your /api/gmail/webhook URL
 *   5. Add GOOGLE_PUBSUB_TOPIC to your environment variables
 */
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: integration } = await serviceClient
    .from('gmail_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'No Gmail integration found' }, { status: 404 })
  }

  const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC
  if (!pubsubTopic) {
    return NextResponse.json({ error: 'GOOGLE_PUBSUB_TOPIC not configured' }, { status: 500 })
  }

  try {
    const oauth2Client = getOAuthClient()
    oauth2Client.setCredentials({
      access_token: decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
    })

    // Refresh token handler
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await serviceClient.from('gmail_integrations').update({
          access_token: encrypt(tokens.access_token),
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        }).eq('id', integration.id)
      }
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Set up watch — Gmail will push to our Pub/Sub topic on any INBOX change
    const watchRes = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: pubsubTopic,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      },
    })

    // Store the historyId returned — we'll use this to fetch only NEW messages
    const historyId = watchRes.data.historyId
    const expiry = new Date(parseInt(watchRes.data.expiration || '0'))

    await serviceClient.from('gmail_integrations').update({
      last_history_id: historyId,
    }).eq('id', integration.id)

    return NextResponse.json({
      success: true,
      historyId,
      watchExpires: expiry.toISOString(),
      message: 'Gmail watch set up. Real-time email notifications are now active.',
    })
  } catch (error: any) {
    console.error('Gmail watch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/gmail/watch
 * Called by Vercel Cron every 6 days to renew the watch before it expires.
 * Add to vercel.json: { "crons": [{ "path": "/api/gmail/watch/renew", "schedule": "0 0 */6 * *" }] }
 */
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (not a random visitor)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get ALL active Gmail integrations across all users
  const { data: integrations } = await supabase
    .from('gmail_integrations')
    .select('*')
    .eq('is_active', true)

  if (!integrations?.length) {
    return NextResponse.json({ renewed: 0 })
  }

  const pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC
  if (!pubsubTopic) {
    return NextResponse.json({ error: 'GOOGLE_PUBSUB_TOPIC not configured' }, { status: 500 })
  }

  let renewed = 0
  const errors: string[] = []

  for (const integration of integrations) {
    try {
      const oauth2Client = getOAuthClient()
      oauth2Client.setCredentials({
        access_token: decrypt(integration.access_token),
        refresh_token: decrypt(integration.refresh_token),
      })

      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
          await supabase.from('gmail_integrations').update({
            access_token: encrypt(tokens.access_token),
          }).eq('id', integration.id)
        }
      })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      const watchRes = await gmail.users.watch({
        userId: 'me',
        requestBody: { topicName: pubsubTopic, labelIds: ['INBOX'] },
      })

      await supabase.from('gmail_integrations').update({
        last_history_id: watchRes.data.historyId,
      }).eq('id', integration.id)

      renewed++
    } catch (err: any) {
      errors.push(`${integration.gmail_address}: ${err.message}`)
    }
  }

  return NextResponse.json({ renewed, errors: errors.length ? errors : undefined })
}
