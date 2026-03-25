import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')

  let query = supabase
    .from('knowledge_base')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('category')
    .order('sort_order')

  if (propertyId) {
    query = query.or(`property_id.eq.${propertyId},property_id.is.null`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { property_id, category, title, content, tags, sort_order } = body

  if (!category || !title || !content) {
    return NextResponse.json({ error: 'Category, title, and content are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      user_id: user.id,
      property_id: property_id || null,
      category,
      title,
      content,
      tags: tags || [],
      sort_order: sort_order || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
