import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, short_name, address, property_type, platform, description, max_guests, bedrooms, bathrooms, email_keywords, listing_url } = body

  if (!name) return NextResponse.json({ error: 'Property name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('properties')
    .insert({
      user_id: user.id,
      name,
      short_name: short_name || null,
      address: address || null,
      property_type: property_type || 'airbnb',
      platform: platform || 'airbnb',
      description: description || null,
      max_guests: max_guests || 2,
      bedrooms: bedrooms || 1,
      bathrooms: bathrooms || 1,
      email_keywords: email_keywords || [],
      listing_url: listing_url || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
