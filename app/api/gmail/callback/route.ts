import { createServiceClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getOAuthClient } from '@/lib/gmail'
import { encrypt } from '@/lib/utils'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/integrations?error=${error}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/integrations?error=missing_params`)
  }

  try {
    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString())
    if (!userId) throw new Error('Invalid state')

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens — make sure you requested offline access')
    }

    // Get user's Gmail address
    const oauth2Client = getOAuthClient()
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    const gmailAddress = userInfo.data.email

    if (!gmailAddress) throw new Error('Could not get Gmail address')

    // Store encrypted tokens in Supabase
    const supabase = createServiceClient()
    await supabase
      .from('gmail_integrations')
      .upsert({
        user_id: userId,
        gmail_address: gmailAddress,
        access_token: encrypt(tokens.access_token),
        refresh_token: encrypt(tokens.refresh_token),
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        is_active: true,
        last_synced_at: null,
      }, {
        onConflict: 'user_id,gmail_address',
      })

    // ✅ Auto-set up Gmail Push Notifications (real-time webhook)
    // This means emails will appear instantly without any manual sync button.
    // Only works if GOOGLE_PUBSUB_TOPIC is configured (see LAUNCH_GUIDE.md Step 3b).
    if (process.env.GOOGLE_PUBSUB_TOPIC) {
      try {
        const watchUrl = `${origin}/api/gmail/watch`
        // Fire and forget — don't block the redirect
        fetch(watchUrl, {
          method: 'POST',
          headers: { cookie: `user_id=${userId}` }, // minimal auth hint
        }).catch(e => console.error('Watch setup failed:', e))
      } catch {
        // Non-fatal — user can still manually sync
      }
    }

    return NextResponse.redirect(`${origin}/integrations?success=gmail_connected&email=${encodeURIComponent(gmailAddress)}`)
  } catch (err) {
    console.error('Gmail callback error:', err)
    return NextResponse.redirect(`${origin}/integrations?error=connection_failed`)
  }
}
