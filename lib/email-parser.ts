import OpenAI from 'openai'
import { ParsedEmailData } from '@/types/database'
import { Property } from '@/types/database'

// ============================================================
// Smart AI-Powered Email Parser
//
// Instead of brittle regex patterns that break when Airbnb
// changes their email template, we use GPT-4o to understand
// the email semantically. This means the parser will continue
// to work even when email formats change.
// ============================================================

function getOpenAI(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  })
}

/**
 * Parse an incoming email using AI to extract structured data.
 * This is the core "smart parsing" that makes the system resilient
 * to email format changes from Airbnb or any other platform.
 */
export async function parseEmailWithAI(
  subject: string,
  body: string,
  fromEmail: string,
  fromName: string,
  userApiKey?: string
): Promise<ParsedEmailData> {
  const openai = getOpenAI(userApiKey)

  const prompt = `You are an expert at parsing property management emails (from Airbnb, VRBO, Booking.com, direct guests, etc.).

Analyze this email and extract structured information. Even if the email format is unusual or has changed, use your understanding to find the relevant information.

EMAIL DETAILS:
From: ${fromName} <${fromEmail}>
Subject: ${subject}
Body:
---
${body.substring(0, 4000)}
---

Extract and return a JSON object with these fields:
{
  "guestName": "Full name of the guest (null if not found)",
  "guestEmail": "Guest's email address (null if same as sender or not found)",
  "propertyHint": "Property name, address, or listing name mentioned in the email (null if not found)",
  "cleanMessage": "The actual guest message/inquiry stripped of all email boilerplate, Airbnb headers, footers, and formatting. Just the core message content.",
  "checkInDate": "Check-in date in YYYY-MM-DD format (null if not mentioned)",
  "checkOutDate": "Check-out date in YYYY-MM-DD format (null if not mentioned)",
  "numGuests": "Number of guests as integer (null if not mentioned)",
  "bookingReference": "Booking/confirmation/reservation number (null if not found)",
  "inquiryTypes": ["Array of topic categories from: wifi, checkin, checkout, parking, rules, maintenance, noise, pets, amenities, local_info, pricing, booking, cancellation, emergency, general"],
  "sentiment": "positive, neutral, negative, or urgent",
  "confidence": "Your confidence 0.0-1.0 that you correctly identified the guest message and property"
}

Important:
- cleanMessage should contain ONLY the actual question/message from the guest
- Remove any Airbnb/platform boilerplate ("You have a new message from...", email footers, unsubscribe links, etc.)
- If this is not a guest message email (e.g., a receipt, newsletter, etc.), return cleanMessage as the subject
- Be smart about propertyHint - look for listing names, addresses, property names in subject AND body`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temp for consistent extraction
      max_tokens: 800,
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error('No response from AI')

    const parsed = JSON.parse(content)

    return {
      guestName: parsed.guestName || fromName || null,
      guestEmail: parsed.guestEmail || fromEmail || null,
      propertyHint: parsed.propertyHint || null,
      cleanMessage: parsed.cleanMessage || body.substring(0, 1000),
      checkInDate: parsed.checkInDate || null,
      checkOutDate: parsed.checkOutDate || null,
      numGuests: parsed.numGuests ? parseInt(parsed.numGuests) : null,
      bookingReference: parsed.bookingReference || null,
      inquiryTypes: Array.isArray(parsed.inquiryTypes) ? parsed.inquiryTypes : [],
      sentiment: parsed.sentiment || 'neutral',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    }
  } catch (error) {
    console.error('AI email parsing failed, using fallback:', error)
    return fallbackParse(subject, body, fromEmail, fromName)
  }
}

/**
 * Fallback parser if AI is unavailable.
 * Uses basic heuristics — not as robust but better than nothing.
 */
function fallbackParse(
  subject: string,
  body: string,
  fromEmail: string,
  fromName: string
): ParsedEmailData {
  // Basic cleanup - remove common Airbnb boilerplate
  let cleanMessage = body
    .replace(/Reply to this email to respond to .+/gi, '')
    .replace(/This message was sent by .+/gi, '')
    .replace(/You have a new message from .+/gi, '')
    .replace(/To respond to .+/gi, '')
    .replace(/\[cid:[^\]]+\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Determine inquiry type from keywords
  const lowerBody = body.toLowerCase()
  const inquiryTypes: string[] = []
  if (lowerBody.includes('wifi') || lowerBody.includes('wi-fi') || lowerBody.includes('internet')) inquiryTypes.push('wifi')
  if (lowerBody.includes('check in') || lowerBody.includes('check-in') || lowerBody.includes('arrival')) inquiryTypes.push('checkin')
  if (lowerBody.includes('check out') || lowerBody.includes('check-out') || lowerBody.includes('departure')) inquiryTypes.push('checkout')
  if (lowerBody.includes('park') || lowerBody.includes('parking')) inquiryTypes.push('parking')
  if (lowerBody.includes('broken') || lowerBody.includes('not working') || lowerBody.includes('repair')) inquiryTypes.push('maintenance')

  return {
    guestName: fromName || null,
    guestEmail: fromEmail || null,
    propertyHint: extractPropertyFromSubject(subject),
    cleanMessage: cleanMessage.substring(0, 2000),
    checkInDate: null,
    checkOutDate: null,
    numGuests: null,
    bookingReference: null,
    inquiryTypes: inquiryTypes.length > 0 ? inquiryTypes : ['general'],
    sentiment: 'neutral',
    confidence: 0.4,
  }
}

function extractPropertyFromSubject(subject: string): string | null {
  // Common Airbnb subject patterns:
  // "New message from Guest about [Listing Name]"
  // "Reservation confirmed: [Listing Name]"
  const patterns = [
    /about\s+(.+?)(?:\s*-|\s*\||\s*$)/i,
    /listing[:\s]+(.+?)(?:\s*-|\s*\||\s*$)/i,
    /property[:\s]+(.+?)(?:\s*-|\s*\||\s*$)/i,
    /re:\s+(.+?)(?:\s*-|\s*\||\s*$)/i,
  ]
  for (const pattern of patterns) {
    const match = subject.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

// ============================================================
// Property Matching
// ============================================================

/**
 * Match an email to a specific property using AI-assisted fuzzy matching.
 * This handles cases where property names in emails don't exactly match
 * the names stored in the database.
 */
export async function matchPropertyToEmail(
  propertyHint: string | null,
  cleanMessage: string,
  subject: string,
  properties: Property[],
  userApiKey?: string
): Promise<{ property: Property | null; confidence: number }> {
  if (!properties.length) return { property: null, confidence: 0 }
  if (!propertyHint && !subject && !cleanMessage) return { property: null, confidence: 0 }

  // Step 1: Try exact/fuzzy string matching first (fast, no API cost)
  const stringMatch = tryStringMatch(propertyHint || subject, properties)
  if (stringMatch.confidence > 0.8) return stringMatch

  // Step 2: If only 1 property, use it by default
  if (properties.length === 1) {
    return { property: properties[0], confidence: 0.85 }
  }

  // Step 3: Use AI for ambiguous cases
  try {
    const openai = getOpenAI(userApiKey)

    const propertyList = properties
      .map((p, i) => `${i + 1}. "${p.name}"${p.address ? ` (${p.address})` : ''}${p.email_keywords?.length ? ` [keywords: ${p.email_keywords.join(', ')}]` : ''}`)
      .join('\n')

    const prompt = `Match this email to one of these properties:

Properties:
${propertyList}

Email subject: "${subject}"
Property hint found: "${propertyHint || 'none'}"
Message excerpt: "${cleanMessage.substring(0, 500)}"

Return JSON: { "propertyIndex": 1-based index or null if no match, "confidence": 0.0-1.0 }`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 100,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    if (result.propertyIndex && result.propertyIndex >= 1 && result.propertyIndex <= properties.length) {
      return {
        property: properties[result.propertyIndex - 1],
        confidence: result.confidence || 0.7,
      }
    }
  } catch (error) {
    console.error('AI property matching failed:', error)
  }

  // Return best string match if AI failed
  return stringMatch
}

/**
 * Fast string-based property matching using multiple strategies
 */
function tryStringMatch(
  hint: string | null,
  properties: Property[]
): { property: Property | null; confidence: number } {
  if (!hint) return { property: null, confidence: 0 }

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const normalizedHint = normalize(hint)

  let bestMatch: Property | null = null
  let bestScore = 0

  for (const property of properties) {
    const candidates = [
      property.name,
      property.short_name || '',
      property.address || '',
      ...(property.email_keywords || []),
    ]

    for (const candidate of candidates) {
      if (!candidate) continue
      const normalizedCandidate = normalize(candidate)

      // Exact match
      if (normalizedHint === normalizedCandidate) {
        return { property, confidence: 1.0 }
      }

      // Contains match
      if (normalizedHint.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHint)) {
        const score = Math.min(normalizedHint.length, normalizedCandidate.length) /
          Math.max(normalizedHint.length, normalizedCandidate.length)
        if (score > bestScore) {
          bestScore = score
          bestMatch = property
        }
      }

      // Word overlap score
      const hintWords = new Set(normalizedHint.split(/\s+/))
      const candidateWords = new Set(normalizedCandidate.split(/\s+/))
      const intersection = [...hintWords].filter(w => candidateWords.has(w) && w.length > 2)
      const unionSize = new Set([...hintWords, ...candidateWords]).size
      const jaccardScore = intersection.length / unionSize

      if (jaccardScore > bestScore) {
        bestScore = jaccardScore * 0.9 // Slightly penalize word overlap vs exact
        bestMatch = property
      }
    }
  }

  return { property: bestMatch, confidence: bestScore }
}
