import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: gmail } = await supabase
    .from('gmail_integrations')
    .select('id, gmail_address, last_synced_at, is_active, created_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return NextResponse.json({ gmail: gmail || null })
}
