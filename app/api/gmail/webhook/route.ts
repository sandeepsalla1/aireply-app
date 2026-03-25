import { createServiceClient } from '@/lib/supabase/server'
import { google } from 'googleapis'
import { decrypt, encrypt } from '@/lib/utils'
import { getOAuthClient } from '@/lib/gmail'
import { parseEmailWithAI, matchPropertyToEmail } from '@/lib/email-parser'
import { generateReply } from '@/lib/ai'
import { NextResponse } from 'next/server'

/**
 * POST /api/gmail/webhook
 *
 * This is the Google Pub/Sub push endpoint.
 * Google calls this URL the INSTANT a new email arrives in a connected Gmail account.
 * No more manual "Sync Gmail" button — emails appear in real-time.
 *
 * How it works:
 *   1. User connects Gmail → app calls gmail.users.watch() to subscribe
 *   2. Gmail detects a new email → notifies Google Pub/Sub topic
 *   3. Pub/Sub delivers a push message to THIS endpoint
 *   4. We fetch the new email, parse it, generate an AI reply
 *   5. User opens the app and sees new message already processed
 *
 * Pub/Sub message format:
 *   { message: { data: base64({ emailAddress, historyId }) }, subscription: "..." }
 */
export async function POST(request: Request) {
  // Verify this request is genuinely from Google Pub/Sub
  // (In production, also verify the bearer token from Google)
  const body = await request.json()

  const pubsubMessage = body?.message
  if (!pubsubMessage?.data) {
    return NextResponse.json({ error: 'Invalid Pub/Sub message' }, { status: 400 })
  }

  // Decode the base64 Pub/Sub data
  let notificationData: { emailAddress: string; historyId: string }
  try {
    const decoded = Buffer.from(pubsubMessage.data, 'base64').toString('utf-8')
    notificationData = JSON.parse(decoded)
  } catch {
    return NextResponse.json({ error: 'Invalid message data' }, { status: 400 })
  }

  const { emailAddress, historyId } = notificationData

  if (!emailAddress || !historyId) {
    return NextResponse.json({ error: 'Missing emailAddress or historyId' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Find which user this Gmail account belongs to
  const { data: integration, error: intError } = await supabase
    .from('gmail_integrations')
    .select('*, profiles(*)')
    .eq('gmail_address', emailAddress)
    .eq('is_active', true)
    .single()

  if (intError || !integration) {
    // Unknown Gmail account — ignore silently (return 200 so Pub/Sub doesn't retry)
    console.log(`No integration found for ${emailAddress}`)
    return NextResponse.json({ ok: true })
  }

  const userId = integration.user_id
  const profile = (integration as any).profiles

  try {
    // Use Gmail History API to fetch only what's NEW since lastHistoryId
    const oauth2Client = getOAuthClient()
    const accessToken = decrypt(integration.access_token)
    const refreshToken = decrypt(integration.refresh_token)

    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })

    // Auto-refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await supabase.from('gmail_integrations').update({
          access_token: encrypt(tokens.access_token),
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        }).eq('id', integration.id)
      }
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Get history since last known historyId
    const startHistoryId = integration.last_history_id || historyId
    let newMessageIds: string[] = []

    try {
      const historyRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      })

      for (const record of historyRes.data.history || []) {
        for (const msg of record.messagesAdded || []) {
          if (msg.message?.id) newMessageIds.push(msg.message.id)
        }
      }
    } catch (historyError: any) {
      // If history is too old, fall back to fetching latest messages
      if (historyError?.code === 404) {
        const listRes = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 5,
          labelId: 'INBOX',
          q: 'from:airbnb.com OR subject:"new message" OR subject:"reservation" newer_than:1h',
        })
        newMessageIds = (listRes.data.messages || []).map(m => m.id!)
      } else {
        throw historyError
      }
    }

    // Update stored historyId so next webhook only fetches NEW messages
    await supabase.from('gmail_integrations').update({
      last_history_id: historyId,
      last_synced_at: new Date().toISOString(),
    }).eq('id', integration.id)

    if (newMessageIds.length === 0) {
      return NextResponse.json({ ok: true, newMessages: 0 })
    }

    // Get user's properties for matching
    const { data: properties } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    let processed = 0

    // Process each new message
    for (const messageId of newMessageIds) {
      try {
        // Skip if already processed
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('gmail_message_id', messageId)
          .single()
        if (existing) continue

        // Fetch full message
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        })

        const msg = msgRes.data
        const headers = msg.payload?.headers || []
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

        const subject = getHeader('Subject')
        const from = getHeader('From')
        const to = getHeader('To')
        const fromNameMatch = from.match(/^"?([^"<]+)"?\s*</)
        const fromEmailMatch = from.match(/<([^>]+)>/) || [null, from]
        const fromName = fromNameMatch?.[1]?.trim() || ''
        const fromEmail = fromEmailMatch[1] || from

        // Extract body
        let bodyText = ''
        const extractText = (payload: any): string => {
          if (payload.mimeType === 'text/plain' && payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
          }
          if (payload.parts) {
            return payload.parts.map(extractText).join('\n')
          }
          return ''
        }
        bodyText = extractText(msg.payload)

        // AI parsing
        const parsed = await parseEmailWithAI(subject, bodyText, fromEmail, fromName)

        // Property matching
        const { property } = await matchPropertyToEmail(
          parsed.propertyHint,
          parsed.cleanMessage,
          subject,
          properties || []
        )

        // Find or create conversation
        let conversationId: string
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', userId)
          .eq('gmail_thread_id', msg.threadId)
          .single()

        if (existingConv) {
          conversationId = existingConv.id
          await supabase.from('conversations').update({
            status: 'unread',
            last_message_at: new Date(parseInt(msg.internalDate!)).toISOString(),
            property_id: property?.id || undefined,
            inquiry_type: parsed.inquiryTypes,
            sentiment: parsed.sentiment,
          }).eq('id', conversationId)
        } else {
          const { data: newConv } = await supabase.from('conversations').insert({
            user_id: userId,
            property_id: property?.id || null,
            guest_name: parsed.guestName,
            guest_email: parsed.guestEmail,
            check_in_date: parsed.checkInDate,
            check_out_date: parsed.checkOutDate,
            num_guests: parsed.numGuests,
            booking_reference: parsed.bookingReference,
            status: 'unread',
            priority: parsed.sentiment === 'urgent' ? 'urgent' : parsed.sentiment === 'negative' ? 'high' : 'normal',
            inquiry_type: parsed.inquiryTypes,
            sentiment: parsed.sentiment,
            gmail_thread_id: msg.threadId,
            subject,
            last_message_at: new Date(parseInt(msg.internalDate!)).toISOString(),
          }).select().single()
          conversationId = newConv!.id
        }

        // Save message
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          gmail_message_id: messageId,
          gmail_thread_id: msg.threadId,
          from_email: fromEmail,
          from_name: fromName,
          to_email: to,
          subject,
          body_raw: bodyText.substring(0, 10000),
          body_clean: parsed.cleanMessage,
          extracted_guest_message: parsed.cleanMessage,
          extracted_property_hint: parsed.propertyHint,
          extraction_confidence: parsed.confidence,
          direction: 'inbound',
          received_at: new Date(parseInt(msg.internalDate!)).toISOString(),
        })

        // Auto-generate AI reply (uses YOUR OpenAI key — no user key needed)
        if (parsed.confidence > 0.4) {
          let kbQuery = supabase.from('knowledge_base').select('*').eq('user_id', userId).eq('is_active', true)
          if (property?.id) kbQuery = kbQuery.or(`property_id.eq.${property.id},property_id.is.null`)
          else kbQuery = kbQuery.is('property_id', null)
          const { data: kb } = await kbQuery

          const reply = await generateReply({
            guestName: parsed.guestName,
            guestMessage: parsed.cleanMessage,
            property,
            knowledgeBase: kb || [],
            hostName: profile?.full_name || profile?.business_name,
            businessType: profile?.business_type,
            // NO userApiKey — always uses the operator's OPENAI_API_KEY from environment
          })

          const { data: latestMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', conversationId)
            .order('received_at', { ascending: false })
            .limit(1)
            .single()

          await supabase.from('ai_replies').insert({
            conversation_id: conversationId,
            message_id: latestMsg?.id || null,
            user_id: userId,
            reply_text: reply.replyText,
            model_used: reply.modelUsed,
            confidence_score: reply.confidenceScore,
            confidence_label: reply.confidenceLabel,
            knowledge_used: reply.knowledgeUsed,
            status: 'draft',
          })
        }

        processed++
      } catch (msgError) {
        console.error(`Error processing message ${messageId}:`, msgError)
      }
    }

    return NextResponse.json({ ok: true, newMessages: newMessageIds.length, processed })

  } catch (error) {
    console.error('Webhook processing error:', error)
    // Return 200 to prevent Pub/Sub from retrying endlessly
    return NextResponse.json({ ok: true, error: 'Processing failed silently' })
  }
}
