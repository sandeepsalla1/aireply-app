import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/gmail'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pass user ID as state to verify in callback
  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
  const authUrl = getAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
