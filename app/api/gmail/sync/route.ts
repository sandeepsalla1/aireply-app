import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchEmails } from '@/lib/gmail'
import { parseEmailWithAI, matchPropertyToEmail } from '@/lib/email-parser'
import { NextResponse } from 'next/server'

/**
 * POST /api/gmail/sync
 * Manually trigger a Gmail sync.
 * Also called by a cron job for background syncing.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient()

  // Log the sync
  const { data: syncLog } = await serviceClient
    .from('sync_logs')
    .insert({
      user_id: user.id,
      sync_type: 'manual',
    })
    .select()
    .single()

  const errors: string[] = []
  let emailsFetched = 0
  let emailsProcessed = 0

  try {
    // Get user's properties for matching
    const { data: properties } = await serviceClient
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Get user's profile for API key
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('openai_api_key, business_type')
      .eq('id', user.id)
      .single()

    const userApiKey = profile?.openai_api_key || undefined

    // Fetch emails from Gmail
    const { messages } = await fetchEmails(user.id, { maxResults: 30 })
    emailsFetched = messages.length

    for (const email of messages) {
      try {
        // Check if already processed
        const { data: existing } = await serviceClient
          .from('messages')
          .select('id')
          .eq('gmail_message_id', email.id)
          .single()

        if (existing) continue // Skip duplicates

        // AI-powered email parsing
        const parsed = await parseEmailWithAI(
          email.subject,
          email.bodyText,
          email.fromEmail,
          email.fromName,
          userApiKey
        )

        // Match to a property
        const { property } = await matchPropertyToEmail(
          parsed.propertyHint,
          parsed.cleanMessage,
          email.subject,
          properties || [],
          userApiKey
        )

        // Find or create conversation (group by Gmail thread)
        let conversationId: string

        const { data: existingConversation } = await serviceClient
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('gmail_thread_id', email.threadId)
          .single()

        if (existingConversation) {
          conversationId = existingConversation.id
          // Update conversation with latest info
          await serviceClient
            .from('conversations')
            .update({
              status: 'unread',
              last_message_at: email.receivedAt.toISOString(),
              property_id: property?.id || undefined,
              inquiry_type: parsed.inquiryTypes,
              sentiment: parsed.sentiment,
            })
            .eq('id', conversationId)
        } else {
          const { data: newConversation, error: convError } = await serviceClient
            .from('conversations')
            .insert({
              user_id: user.id,
              property_id: property?.id || null,
              guest_name: parsed.guestName,
              guest_email: parsed.guestEmail,
              check_in_date: parsed.checkInDate,
              check_out_date: parsed.checkOutDate,
              num_guests: parsed.numGuests,
              booking_reference: parsed.bookingReference,
              status: 'unread',
              priority: getSentimentPriority(parsed.sentiment),
              inquiry_type: parsed.inquiryTypes,
              sentiment: parsed.sentiment,
              gmail_thread_id: email.threadId,
              subject: email.subject,
              last_message_at: email.receivedAt.toISOString(),
            })
            .select()
            .single()

          if (convError || !newConversation) {
            throw new Error(`Failed to create conversation: ${convError?.message}`)
          }
          conversationId = newConversation.id
        }

        // Store the message
        await serviceClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            gmail_message_id: email.id,
            gmail_thread_id: email.threadId,
            from_email: email.fromEmail,
            from_name: email.fromName,
            to_email: email.toEmail,
            subject: email.subject,
            body_raw: email.bodyText.substring(0, 10000),
            body_clean: parsed.cleanMessage,
            body_html: email.bodyHtml.substring(0, 20000),
            extracted_guest_message: parsed.cleanMessage,
            extracted_property_hint: parsed.propertyHint,
            extraction_confidence: parsed.confidence,
            direction: 'inbound',
            received_at: email.receivedAt.toISOString(),
          })

        // Auto-generate AI reply in background
        if (parsed.confidence > 0.5) {
          generateAndSaveReply(
            conversationId,
            user.id,
            parsed,
            property,
            properties || [],
            profile,
            serviceClient
          ).catch(e => console.error('Background reply generation failed:', e))
        }

        emailsProcessed++
      } catch (emailError) {
        const errMsg = emailError instanceof Error ? emailError.message : 'Unknown error'
        errors.push(`Email ${email.id}: ${errMsg}`)
        console.error(`Error processing email ${email.id}:`, emailError)
      }
    }

    // Update sync log and last synced timestamp
    await serviceClient
      .from('sync_logs')
      .update({
        emails_fetched: emailsFetched,
        emails_processed: emailsProcessed,
        errors: errors.length > 0 ? errors : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id)

    await serviceClient
      .from('gmail_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      emailsFetched,
      emailsProcessed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Sync failed'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

function getSentimentPriority(sentiment: string): string {
  if (sentiment === 'urgent') return 'urgent'
  if (sentiment === 'negative') return 'high'
  return 'normal'
}

async function generateAndSaveReply(
  conversationId: string,
  userId: string,
  parsed: any,
  property: any,
  allProperties: any[],
  profile: any,
  supabase: any
) {
  try {
    const { generateReply } = await import('@/lib/ai')

    // Get knowledge base for this property
    let kbQuery = supabase
      .from('knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (property?.id) {
      kbQuery = kbQuery.or(`property_id.eq.${property.id},property_id.is.null`)
    } else {
      kbQuery = kbQuery.is('property_id', null)
    }

    const { data: knowledgeBase } = await kbQuery

    const reply = await generateReply({
      guestName: parsed.guestName,
      guestMessage: parsed.cleanMessage,
      property,
      knowledgeBase: knowledgeBase || [],
      hostName: profile?.full_name,
      businessType: profile?.business_type,
      userApiKey: profile?.openai_api_key,
    })

    // Get the latest message ID
    const { data: latestMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('received_at', { ascending: false })
      .limit(1)
      .single()

    await supabase
      .from('ai_replies')
      .insert({
        conversation_id: conversationId,
        message_id: latestMessage?.id || null,
        user_id: userId,
        reply_text: reply.replyText,
        model_used: reply.modelUsed,
        confidence_score: reply.confidenceScore,
        confidence_label: reply.confidenceLabel,
        knowledge_used: reply.knowledgeUsed,
        status: 'draft',
      })
  } catch (error) {
    console.error('Failed to auto-generate reply:', error)
  }
}
