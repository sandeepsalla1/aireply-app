import { createClient } from '@/lib/supabase/server'
import { generateReply } from '@/lib/ai'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await request.json()
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  // Fetch full conversation data
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select(`
      *,
      property:properties(*),
      messages(*)
    `)
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Get user profile (for API key + host name)
  const { data: profile } = await supabase
    .from('profiles')
    .select('openai_api_key, full_name, business_type, business_name')
    .eq('id', user.id)
    .single()

  // Get knowledge base for this property
  let kbQuery = supabase
    .from('knowledge_base')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (conversation.property_id) {
    kbQuery = kbQuery.or(`property_id.eq.${conversation.property_id},property_id.is.null`)
  } else {
    kbQuery = kbQuery.is('property_id', null)
  }

  const { data: knowledgeBase } = await kbQuery

  // Get the latest guest message
  const messages = (conversation.messages as any[]) || []
  const sortedMessages = messages.sort((a, b) =>
    new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  )
  const latestMessage = sortedMessages[0]

  if (!latestMessage) {
    return NextResponse.json({ error: 'No messages in conversation' }, { status: 400 })
  }

  const guestMessage = latestMessage.extracted_guest_message || latestMessage.body_clean || ''

  // Generate reply
  const reply = await generateReply({
    guestName: conversation.guest_name,
    guestMessage,
    property: conversation.property || null,
    knowledgeBase: knowledgeBase || [],
    previousMessages: messages.slice(-5),
    hostName: profile?.full_name || profile?.business_name,
    businessType: profile?.business_type,
    userApiKey: profile?.openai_api_key || undefined,
  })

  // Save the generated reply
  const { data: savedReply, error: replyError } = await supabase
    .from('ai_replies')
    .insert({
      conversation_id: conversationId,
      message_id: latestMessage.id,
      user_id: user.id,
      reply_text: reply.replyText,
      model_used: reply.modelUsed,
      confidence_score: reply.confidenceScore,
      confidence_label: reply.confidenceLabel,
      knowledge_used: reply.knowledgeUsed,
      status: 'draft',
    })
    .select()
    .single()

  if (replyError) {
    console.error('Failed to save reply:', replyError)
  }

  return NextResponse.json({
    ...reply,
    replyId: savedReply?.id,
  })
}

// Update reply status (e.g., mark as copied or edited)
export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { replyId, status, editedText } = await request.json()

  const updateData: Record<string, any> = { status }
  if (editedText !== undefined) {
    updateData.edited_text = editedText
    updateData.user_edited = true
  }
  if (status === 'copied') {
    // Also update conversation status
    const { data: reply } = await supabase
      .from('ai_replies')
      .select('conversation_id')
      .eq('id', replyId)
      .single()

    if (reply) {
      await supabase
        .from('conversations')
        .update({ status: 'replied', replied_at: new Date().toISOString() })
        .eq('id', reply.conversation_id)
    }
  }

  const { data, error } = await supabase
    .from('ai_replies')
    .update(updateData)
    .eq('id', replyId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
