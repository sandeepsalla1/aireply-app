import OpenAI from 'openai'
import { KnowledgeBase, Property, Message, GenerateReplyResponse } from '@/types/database'

/**
 * SaaS model: YOU (the operator) pay for OpenAI.
 * Users never see or provide an API key — they just pay you a subscription fee.
 * Your OPENAI_API_KEY lives in your Vercel environment variables, never exposed to users.
 *
 * Business math example:
 *   - 500 users × $19/month = $9,500 revenue
 *   - 500 users × 100 replies/month × $0.005/reply = $250 OpenAI cost
 *   - Gross margin: ~97%
 */
function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set. Add it to your Vercel environment variables.')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ============================================================
// AI Reply Generator
// ============================================================

/**
 * Generate a professional, friendly reply to a guest message
 * using the property's knowledge base as context.
 */
export async function generateReply(options: {
  guestName: string | null
  guestMessage: string
  property: Property | null
  knowledgeBase: KnowledgeBase[]
  previousMessages?: Message[]
  hostName?: string
  businessType?: string
}): Promise<GenerateReplyResponse> {
  const openai = getOpenAI()

  // Select relevant knowledge base entries using AI
  const relevantKnowledge = await selectRelevantKnowledge(
    options.guestMessage,
    options.knowledgeBase
  )

  const knowledgeContext = relevantKnowledge
    .map(kb => `[${kb.category.toUpperCase()}] ${kb.title}:\n${kb.content}`)
    .join('\n\n')

  const propertyContext = options.property
    ? `Property: ${options.property.name}${options.property.address ? ` (${options.property.address})` : ''}
${options.property.description ? `Description: ${options.property.description}` : ''}
${options.property.max_guests ? `Max guests: ${options.property.max_guests}` : ''}
${options.property.bedrooms ? `Bedrooms: ${options.property.bedrooms}` : ''}`
    : 'Property details not available'

  const conversationHistory = options.previousMessages?.length
    ? `\nPrevious messages in this conversation:\n${options.previousMessages
        .slice(-3)
        .map(m => `${m.direction === 'inbound' ? 'Guest' : 'Host'}: ${m.body_clean?.substring(0, 300)}`)
        .join('\n')}`
    : ''

  const businessTone = getBusinessTone(options.businessType || 'airbnb_host')

  const systemPrompt = `You are a professional, friendly property manager assistant helping ${options.hostName || 'the host'} respond to guest inquiries.

${businessTone}

Your replies should be:
- Warm and welcoming
- Concise and helpful (not overly long)
- Professional but friendly
- Directly address the guest's question(s)
- Use the knowledge base information when relevant
- If you cannot answer from the knowledge base, acknowledge the question and indicate the host will follow up

Never make up information not in the knowledge base.`

  const userPrompt = `Generate a reply to this guest message.

PROPERTY INFORMATION:
${propertyContext}

KNOWLEDGE BASE:
${knowledgeContext || 'No specific information available for this property yet.'}
${conversationHistory}

GUEST NAME: ${options.guestName || 'Guest'}
GUEST MESSAGE:
"""
${options.guestMessage}
"""

Write a complete, ready-to-send reply. Do not include any meta-commentary about what you're doing. Just write the reply itself, starting with a greeting.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  })

  const replyText = response.choices[0].message.content || ''
  const knowledgeUsed = relevantKnowledge.map(kb => kb.title)

  // Calculate confidence based on how much knowledge was available
  const { score: confidenceScore, label: confidenceLabel } = calculateConfidence(
    relevantKnowledge.length,
    options.knowledgeBase.length,
    replyText
  )

  return {
    replyText,
    confidenceScore,
    confidenceLabel,
    knowledgeUsed,
    modelUsed: 'gpt-4o',
  }
}

/**
 * Use AI to select the most relevant knowledge base entries
 * for the current guest message, avoiding irrelevant context
 */
async function selectRelevantKnowledge(
  guestMessage: string,
  allKnowledge: KnowledgeBase[]
): Promise<KnowledgeBase[]> {
  if (!allKnowledge.length) return []
  if (allKnowledge.length <= 5) return allKnowledge // Use all if few entries

  const openai = getOpenAI()

  const kbList = allKnowledge
    .map((kb, i) => `${i}: ${kb.category} - "${kb.title}" (tags: ${kb.tags?.join(', ') || 'none'})`)
    .join('\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Select the most relevant knowledge base entries for this guest message.

Guest message: "${guestMessage.substring(0, 500)}"

Available knowledge base entries:
${kbList}

Return JSON: { "relevantIndexes": [array of relevant 0-based indexes, max 5] }`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 200,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    const indexes: number[] = result.relevantIndexes || []
    return indexes
      .filter(i => i >= 0 && i < allKnowledge.length)
      .map(i => allKnowledge[i])
  } catch {
    // Fallback: return first 5 entries
    return allKnowledge.slice(0, 5)
  }
}

function calculateConfidence(
  relevantKBCount: number,
  totalKBCount: number,
  replyText: string
): { score: number; label: 'high' | 'medium' | 'low' } {
  let score = 0.5 // Base score

  // More relevant KB entries = higher confidence
  if (relevantKBCount > 0) score += 0.2
  if (relevantKBCount > 2) score += 0.1

  // Has knowledge base = higher confidence
  if (totalKBCount > 3) score += 0.1

  // Reply seems complete (not too short)
  if (replyText.length > 100) score += 0.1

  score = Math.min(score, 1.0)

  const label: 'high' | 'medium' | 'low' =
    score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low'

  return { score, label }
}

function getBusinessTone(businessType: string): string {
  const tones: Record<string, string> = {
    airbnb_host: 'You\'re helping an Airbnb host communicate with short-term vacation rental guests. Tone should be welcoming, helpful, and match the warmth of a hospitality host.',
    hotel: 'You\'re helping a hotel manager respond to guests. Tone should be professional, courteous, and match hotel industry standards.',
    coliving: 'You\'re helping a co-living operator respond to residents. Tone should be community-oriented, friendly, and helpful.',
    landlord: 'You\'re helping a landlord respond to tenants. Tone should be professional, clear, and courteous.',
    boutique_hotel: 'You\'re helping a boutique hotel owner respond to guests. Tone should be personalized, warm, and reflect boutique hospitality.',
    vrbo_host: 'You\'re helping a vacation rental host respond to guests. Tone should be welcoming and helpful.',
  }
  return tones[businessType] || tones.airbnb_host
}

// ============================================================
// AI Knowledge Base Enhancement
// ============================================================

/**
 * Auto-generate a summary of a property based on its knowledge base entries.
 * This is used to improve context for reply generation.
 */
export async function generatePropertySummary(
  property: Property,
  knowledgeBase: KnowledgeBase[]
): Promise<string> {
  if (!knowledgeBase.length) return ''

  const openai = getOpenAI()
  const kbText = knowledgeBase.map(kb => `${kb.title}: ${kb.content}`).join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: `Create a concise 2-3 sentence property summary for "${property.name}" based on this information:\n\n${kbText.substring(0, 2000)}\n\nSummary:`
    }],
    temperature: 0.5,
    max_tokens: 150,
  })

  return response.choices[0].message.content || ''
}

/**
 * Suggest knowledge base tags for a new entry.
 */
export async function suggestKnowledgeTags(
  title: string,
  content: string
): Promise<string[]> {
  const openai = getOpenAI()

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Suggest 3-5 short, lowercase tags for this knowledge base entry:
Title: ${title}
Content: ${content.substring(0, 500)}

Return JSON: { "tags": ["tag1", "tag2", ...] }`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 100,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return result.tags || []
  } catch {
    return []
  }
}
