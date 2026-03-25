-- ============================================================
-- AIReply - Initial Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  business_name TEXT,
  business_type TEXT DEFAULT 'airbnb_host', -- airbnb_host, hotel, coliving, landlord, boutique_hotel
  timezone TEXT DEFAULT 'America/New_York',
  openai_api_key TEXT, -- user can bring their own key (encrypted)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GMAIL INTEGRATIONS
-- ============================================================
CREATE TABLE public.gmail_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  gmail_address TEXT NOT NULL,
  access_token TEXT NOT NULL,  -- encrypted
  refresh_token TEXT NOT NULL, -- encrypted
  token_expiry TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_history_id TEXT, -- Gmail history ID for incremental sync
  is_active BOOLEAN DEFAULT TRUE,
  sync_label TEXT DEFAULT 'INBOX', -- which Gmail label to watch
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_address)
);

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE public.properties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                    -- e.g. "Ashwood Drive", "Kemp Street ADU"
  short_name TEXT,                       -- alias used in emails, e.g. "Ashwood"
  address TEXT,
  property_type TEXT DEFAULT 'airbnb',   -- airbnb, vrbo, hotel_room, apartment, etc.
  platform TEXT DEFAULT 'airbnb',        -- booking platform
  listing_url TEXT,
  description TEXT,
  max_guests INTEGER DEFAULT 2,
  bedrooms INTEGER DEFAULT 1,
  bathrooms NUMERIC(3,1) DEFAULT 1,
  -- Email matching hints (comma-separated keywords found in Airbnb emails)
  email_keywords TEXT[],                 -- e.g. ['Ashwood', '123 Ashwood Drive', 'Ashwood Drive listing']
  ai_description TEXT,                   -- AI-generated property summary for context
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KNOWLEDGE BASE (per property)
-- ============================================================
CREATE TABLE public.knowledge_base (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,  -- NULL = applies to all properties
  category TEXT NOT NULL,  -- wifi, checkin, checkout, parking, rules, faq, emergency, amenities, local_info
  title TEXT NOT NULL,     -- e.g. "WiFi Password"
  content TEXT NOT NULL,   -- e.g. "Network: GuestWifi_5G, Password: Welcome2024!"
  tags TEXT[],             -- for search/matching, e.g. ['wifi', 'internet', 'password']
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS (parsed email threads)
-- ============================================================
CREATE TABLE public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  gmail_integration_id UUID REFERENCES public.gmail_integrations(id) ON DELETE SET NULL,

  -- Guest info (extracted by AI parser)
  guest_name TEXT,
  guest_email TEXT,

  -- Booking info (extracted if present)
  check_in_date DATE,
  check_out_date DATE,
  num_guests INTEGER,
  booking_reference TEXT,

  -- Status
  status TEXT DEFAULT 'unread',  -- unread, needs_review, replied, archived, spam
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent

  -- AI analysis
  inquiry_type TEXT[],  -- ['wifi', 'checkin', 'parking', 'maintenance', etc.]
  sentiment TEXT,       -- positive, neutral, negative, urgent

  -- Threading
  gmail_thread_id TEXT,  -- Gmail thread ID for grouping
  subject TEXT,

  -- Timestamps
  last_message_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (individual emails within a conversation)
-- ============================================================
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Email identifiers
  gmail_message_id TEXT UNIQUE,  -- prevents duplicates
  gmail_thread_id TEXT,

  -- Email content
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_raw TEXT,         -- full raw email body
  body_clean TEXT,       -- cleaned, parsed body text
  body_html TEXT,        -- HTML version if available

  -- AI extracted data
  extracted_guest_message TEXT,  -- the actual guest message (stripped of Airbnb boilerplate)
  extracted_property_hint TEXT,  -- property name/info found in email
  extraction_confidence NUMERIC(3,2),  -- 0.0 to 1.0

  -- Direction
  direction TEXT DEFAULT 'inbound',  -- inbound, outbound

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI REPLIES (generated and saved drafts)
-- ============================================================
CREATE TABLE public.ai_replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Reply content
  reply_text TEXT NOT NULL,
  reply_html TEXT,

  -- AI metadata
  model_used TEXT DEFAULT 'gpt-4o',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  confidence_score NUMERIC(3,2),  -- AI's confidence in this reply
  confidence_label TEXT,          -- high, medium, low

  -- Knowledge base entries used
  knowledge_used TEXT[],  -- titles of KB entries that were used

  -- Status
  status TEXT DEFAULT 'draft',  -- draft, copied, sent, rejected
  user_edited BOOLEAN DEFAULT FALSE,
  edited_text TEXT,  -- if user edited the reply

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL SYNC LOG (for debugging)
-- ============================================================
CREATE TABLE public.sync_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  gmail_integration_id UUID REFERENCES public.gmail_integrations(id) ON DELETE CASCADE,
  sync_type TEXT,  -- 'full', 'incremental'
  emails_fetched INTEGER DEFAULT 0,
  emails_processed INTEGER DEFAULT 0,
  errors TEXT[],
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_property_id ON public.conversations(property_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_gmail_message_id ON public.messages(gmail_message_id);
CREATE INDEX idx_knowledge_base_property_id ON public.knowledge_base(property_id);
CREATE INDEX idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX idx_properties_user_id ON public.properties(user_id);
CREATE INDEX idx_ai_replies_conversation_id ON public.ai_replies(conversation_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Critical for multi-tenant SaaS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Gmail integrations: users own their integrations
CREATE POLICY "Users manage own gmail integrations" ON public.gmail_integrations
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Properties: users own their properties
CREATE POLICY "Users manage own properties" ON public.properties
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Knowledge base: users own their knowledge base
CREATE POLICY "Users manage own knowledge base" ON public.knowledge_base
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Conversations: users own their conversations
CREATE POLICY "Users manage own conversations" ON public.conversations
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Messages: users own their messages
CREATE POLICY "Users manage own messages" ON public.messages
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI Replies: users own their replies
CREATE POLICY "Users manage own ai replies" ON public.ai_replies
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sync logs: users own their sync logs
CREATE POLICY "Users manage own sync logs" ON public.sync_logs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- TRIGGER: Update updated_at timestamps automatically
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ai_replies_updated_at BEFORE UPDATE ON public.ai_replies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_gmail_integrations_updated_at BEFORE UPDATE ON public.gmail_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
