import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const propertyId = searchParams.get('property_id')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('conversations')
    .select(`
      *,
      property:properties(id, name, short_name, address),
      messages(id, body_clean, extracted_guest_message, received_at, direction),
      ai_replies(id, reply_text, confidence_label, confidence_score, knowledge_used, status, created_at)
    `)
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Process to get latest message and reply
  const processed = (data || []).map(conv => {
    const msgs = (conv.messages as any[]) || []
    const replies = (conv.ai_replies as any[]) || []
    return {
      ...conv,
      latest_message: msgs.sort((a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      )[0],
      latest_reply: replies.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0],
      messages: undefined,
      ai_replies: undefined,
    }
  })

  return NextResponse.json(processed)
}
