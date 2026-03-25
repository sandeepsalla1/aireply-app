import { google } from 'googleapis'
import { decrypt, encrypt } from './utils'
import { createServiceClient } from './supabase/server'

// ============================================================
// Gmail OAuth Configuration
// ============================================================
export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )
}

// Scopes needed for Gmail read access
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    state,
    prompt: 'consent', // Always ask for consent to get refresh_token
  })
}

// ============================================================
// Token Management
// ============================================================
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function getAuthenticatedClient(userId: string) {
  const supabase = createServiceClient()

  const { data: integration, error } = await supabase
    .from('gmail_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !integration) {
    throw new Error('No Gmail integration found. Please connect your Gmail account.')
  }

  const oauth2Client = getOAuthClient()

  // Decrypt stored tokens
  const accessToken = decrypt(integration.access_token)
  const refreshToken = decrypt(integration.refresh_token)

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : undefined,
  })

  // Auto-refresh if token expired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from('gmail_integrations')
        .update({
          access_token: encrypt(tokens.access_token),
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        })
        .eq('id', integration.id)
    }
  })

  return { oauth2Client, integration }
}

// ============================================================
// Gmail Message Fetching
// ============================================================
export interface RawGmailMessage {
  id: string
  threadId: string
  subject: string
  fromEmail: string
  fromName: string
  toEmail: string
  bodyText: string
  bodyHtml: string
  receivedAt: Date
  labelIds: string[]
}

/**
 * Fetch emails from Gmail
 * Smart query that targets property-management related emails from multiple platforms
 */
export async function fetchEmails(
  userId: string,
  options: {
    maxResults?: number
    query?: string
    pageToken?: string
    afterHistoryId?: string
  } = {}
): Promise<{ messages: RawGmailMessage[]; nextPageToken?: string; historyId?: string }> {
  const { oauth2Client, integration } = await getAuthenticatedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  // Smart query: catch emails from Airbnb, VRBO, Booking.com, and direct guests
  const defaultQuery = [
    'from:automated@airbnb.com OR',
    'from:noreply@airbnb.com OR',
    'from:express@airbnb.com OR',
    'from:airbnb.com OR',
    'subject:"reservation" OR',
    'subject:"booking" OR',
    'subject:"guest message" OR',
    'subject:"new message" OR',
    'subject:"inquiry"',
  ].join(' ')

  const query = options.query || defaultQuery

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: options.maxResults || 50,
    q: query,
    pageToken: options.pageToken,
  })

  const messageIds = listResponse.data.messages || []
  const messages: RawGmailMessage[] = []

  // Batch fetch message details
  const batchSize = 10
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize)
    const detailPromises = batch.map(({ id }) =>
      gmail.users.messages.get({
        userId: 'me',
        id: id!,
        format: 'full',
      })
    )
    const details = await Promise.allSettled(detailPromises)

    for (const result of details) {
      if (result.status === 'fulfilled') {
        const parsed = parseGmailMessage(result.value.data)
        if (parsed) messages.push(parsed)
      }
    }
  }

  return {
    messages,
    nextPageToken: listResponse.data.nextPageToken || undefined,
    historyId: listResponse.data.messages?.[0] ? undefined : undefined,
  }
}

/**
 * Parse raw Gmail API message into our structured format
 */
function parseGmailMessage(msg: any): RawGmailMessage | null {
  if (!msg?.payload) return null

  const headers = msg.payload.headers || []
  const getHeader = (name: string): string =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const subject = getHeader('Subject')
  const from = getHeader('From')
  const to = getHeader('To')
  const date = getHeader('Date')

  // Parse from header: "John Smith <john@example.com>" or just "john@example.com"
  const fromNameMatch = from.match(/^"?([^"<]+)"?\s*</)
  const fromEmailMatch = from.match(/<([^>]+)>/) || from.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/)

  const fromName = fromNameMatch ? fromNameMatch[1].trim() : ''
  const fromEmail = fromEmailMatch ? (fromEmailMatch[1] || fromEmailMatch[0]) : from

  // Extract body
  const { bodyText, bodyHtml } = extractBody(msg.payload)

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject,
    fromEmail,
    fromName,
    toEmail: to,
    bodyText,
    bodyHtml,
    receivedAt: new Date(parseInt(msg.internalDate)),
    labelIds: msg.labelIds || [],
  }
}

/**
 * Recursively extract body text and HTML from Gmail message parts
 */
function extractBody(payload: any): { bodyText: string; bodyHtml: string } {
  let bodyText = ''
  let bodyHtml = ''

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    bodyText = Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    bodyHtml = Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  } else if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractBody(part)
      if (result.bodyText) bodyText += result.bodyText
      if (result.bodyHtml) bodyHtml += result.bodyHtml
    }
  }

  // If no plain text, strip HTML tags
  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return { bodyText, bodyHtml }
}

/**
 * Incremental sync using Gmail History API (much more efficient)
 * Only fetches changes since the last sync
 */
export async function fetchEmailsSinceHistoryId(
  userId: string,
  historyId: string
): Promise<{ addedMessages: string[]; newHistoryId: string }> {
  const { oauth2Client } = await getAuthenticatedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const history = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: historyId,
    historyTypes: ['messageAdded'],
  })

  const addedMessages: string[] = []
  for (const record of history.data.history || []) {
    for (const msg of record.messagesAdded || []) {
      if (msg.message?.id) {
        addedMessages.push(msg.message.id)
      }
    }
  }

  return {
    addedMessages,
    newHistoryId: history.data.historyId || historyId,
  }
}
