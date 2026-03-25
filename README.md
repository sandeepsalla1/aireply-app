
# AIReply — AI-Powered Property Messaging SaaS

Save hours every week by automatically drafting replies to Airbnb guest messages using your property-specific knowledge base.

## How It Works

1. Guest sends a message on Airbnb → you get an email
2. AIReply reads your Gmail and parses the email with AI (resilient to format changes)
3. AI matches the email to the right property using smart fuzzy matching
4. AI drafts a perfect reply using your property knowledge base
5. You review → copy → paste into Airbnb → send

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Email | Gmail API (OAuth 2.0) |
| AI | OpenAI GPT-4o |
| Hosting | Vercel (recommended) |

---

## Setup Guide

### Step 1: Clone and Install

```bash
git clone <your-repo>
cd aireply-app
npm install
```

### Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → paste and run `supabase/migrations/001_initial_schema.sql`
3. Copy your **Project URL** and **Anon Key** from Settings → API

### Step 3: Set Up Google Cloud (Gmail OAuth)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g., "AIReply")
3. Enable the **Gmail API**: APIs & Services → Library → search "Gmail API" → Enable
4. Create OAuth credentials: APIs & Services → Credentials → Create Credentials → OAuth Client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/gmail/callback` (and your production URL)
5. Copy your **Client ID** and **Client Secret**

### Step 4: Get OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Recommended: Set a usage limit to control costs

### Step 5: Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

OPENAI_API_KEY=sk-your-openai-api-key

NEXT_PUBLIC_APP_URL=http://localhost:3000
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_SECRET=your-32-character-encryption-secret
```

### Step 6: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## First-Time Setup in the App

1. **Sign up** for an account
2. **Add Properties** (Properties page) — Add each property with keywords that appear in Airbnb emails
3. **Build Knowledge Base** (Knowledge page) — Add WiFi password, check-in instructions, parking info, house rules for each property
4. **Connect Gmail** (Integrations page) — Authorize Gmail read access
5. **Sync** your inbox to pull in existing emails
6. Start replying!

---

## Deployment to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Add all environment variables in the Vercel dashboard under Settings → Environment Variables.

Update your Google OAuth redirect URI to your production URL:
`https://your-app.vercel.app/api/gmail/callback`

### Scale to 1000s of Users

The tech stack is designed to scale cost-effectively:

- **Supabase**: Free tier handles ~50,000 monthly active users. Paid plans scale to millions.
- **Vercel**: Serverless — auto-scales with zero config. Edge functions for fast response.
- **OpenAI**: Pay-per-use. ~$0.005 per reply. 10,000 replies/month = ~$50.
- **Gmail API**: Free. 1 billion API calls/day quota.

**Estimated monthly cost at 100 users with 100 emails/month each:**
- Supabase Pro: $25/month
- Vercel Pro: $20/month
- OpenAI (10,000 replies): ~$50/month
- **Total: ~$95/month** → charge users $9-19/month for strong margins

---

## Architecture Decisions

### Why Gmail Instead of Airbnb API?

Airbnb's API is not publicly available. All Airbnb hosts receive email notifications for every guest message. By reading these emails via Gmail API, we get all guest messages without needing Airbnb API access.

### Why AI Parsing Instead of Regex?

Airbnb changes their email templates periodically. Hard-coded regex patterns would break overnight. By using GPT-4o to parse emails semantically, the system continues working even when email formats change.

### Why Supabase Over AWS?

For V1 / early SaaS:
- Supabase = PostgreSQL + Auth + Storage + RLS in one managed platform
- 10x faster to build than raw AWS (RDS + Cognito + Lambda + API Gateway)
- Row Level Security ensures multi-tenant data isolation out of the box
- Easy migration path to AWS if needed later

---

## File Structure

```
aireply-app/
├── app/
│   ├── (auth)/          # Login, signup pages
│   ├── (dashboard)/     # Protected app pages
│   │   ├── inbox/       # Main inbox with AI reply
│   │   ├── properties/  # Property management
│   │   ├── knowledge/   # Knowledge base
│   │   ├── analytics/   # Usage analytics
│   │   ├── integrations/ # Gmail + integrations
│   │   └── settings/    # Account settings
│   └── api/             # API routes
│       ├── gmail/       # Gmail OAuth + sync
│       ├── properties/  # Property CRUD
│       ├── knowledge-base/ # KB CRUD
│       ├── conversations/  # Conversation API
│       └── ai/          # AI reply generation
├── components/          # Shared UI components
├── lib/
│   ├── gmail.ts         # Gmail API service
│   ├── email-parser.ts  # Smart AI email parser
│   ├── ai.ts            # OpenAI reply generator
│   └── supabase/        # Supabase clients
├── types/               # TypeScript types
└── supabase/
    └── migrations/      # Database schema
```

---

## Roadmap (V2+)

- [ ] Direct Airbnb integration (if/when API becomes available)
- [ ] WhatsApp integration for direct guest messaging
- [ ] Auto-send replies (with approval queue)
- [ ] Multi-user teams / staff accounts
- [ ] Booking calendar integration
- [ ] Guest CRM (track repeat guests)
- [ ] Sentiment alerts (urgent messages → push notification)
- [ ] Automated check-in/check-out message sequences
- [ ] Multi-language support
- [ ] Mobile app

---

## Contributing

This is a SaaS starter template. Feel free to fork and customize for your use case.

---

## License

MIT
