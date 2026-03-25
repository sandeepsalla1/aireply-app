export type BusinessType = 'airbnb_host' | 'hotel' | 'coliving' | 'landlord' | 'boutique_hotel' | 'vrbo_host' | 'other'
export type ConversationStatus = 'unread' | 'needs_review' | 'replied' | 'archived' | 'spam'
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type MessageDirection = 'inbound' | 'outbound'
export type ReplyStatus = 'draft' | 'copied' | 'sent' | 'rejected'
export type ConfidenceLabel = 'high' | 'medium' | 'low'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  business_name: string | null
  business_type: BusinessType
  timezone: string
  openai_api_key: string | null
  created_at: string
  updated_at: string
}

export interface GmailIntegration {
  id: string
  user_id: string
  gmail_address: string
  access_token: string
  refresh_token: string
  token_expiry: string | null
  last_synced_at: string | null
  last_history_id: string | null
  is_active: boolean
  sync_label: string
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  user_id: string
  name: string
  short_name: string | null
  address: string | null
  property_type: string
  platform: string
  listing_url: string | null
  description: string | null
  max_guests: number
  bedrooms: number
  bathrooms: number
  email_keywords: string[] | null
  ai_description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  user_id: string
  property_id: string | null
  category: string
  title: string
  content: string
  tags: string[] | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  property_id: string | null
  gmail_integration_id: string | null
  guest_name: string | null
  guest_email: string | null
  check_in_date: string | null
  check_out_date: string | null
  num_guests: number | null
  booking_reference: string | null
  status: ConversationStatus
  priority: ConversationPriority
  inquiry_type: string[] | null
  sentiment: string | null
  gmail_thread_id: string | null
  subject: string | null
  last_message_at: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  property?: Property
  messages?: Message[]
  latest_message?: Message
  latest_reply?: AiReply
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  gmail_message_id: string | null
  gmail_thread_id: string | null
  from_email: string
  from_name: string | null
  to_email: string | null
  subject: string | null
  body_raw: string | null
  body_clean: string | null
  body_html: string | null
  extracted_guest_message: string | null
  extracted_property_hint: string | null
  extraction_confidence: number | null
  direction: MessageDirection
  received_at: string
  created_at: string
}

export interface AiReply {
  id: string
  conversation_id: string
  message_id: string | null
  user_id: string
  reply_text: string
  reply_html: string | null
  model_used: string
  prompt_tokens: number | null
  completion_tokens: number | null
  confidence_score: number | null
  confidence_label: ConfidenceLabel | null
  knowledge_used: string[] | null
  status: ReplyStatus
  user_edited: boolean
  edited_text: string | null
  created_at: string
  updated_at: string
}

export interface SyncLog {
  id: string
  user_id: string
  gmail_integration_id: string | null
  sync_type: string | null
  emails_fetched: number
  emails_processed: number
  errors: string[] | null
  started_at: string
  completed_at: string | null
}

// ============================================================
// API Request/Response Types
// ============================================================
export interface ParsedEmailData {
  guestName: string | null
  guestEmail: string | null
  propertyHint: string | null
  cleanMessage: string
  checkInDate: string | null
  checkOutDate: string | null
  numGuests: number | null
  bookingReference: string | null
  inquiryTypes: string[]
  sentiment: string
  confidence: number
}

export interface GenerateReplyRequest {
  conversationId: string
  messageId: string
  propertyId?: string
}

export interface GenerateReplyResponse {
  replyText: string
  confidenceScore: number
  confidenceLabel: ConfidenceLabel
  knowledgeUsed: string[]
  modelUsed: string
}

export interface DashboardStats {
  totalUnread: number
  aiRepliesReady: number
  maintenanceIssues: number
  responseRate: number
  avgResponseTimeMinutes: number
}
