# AIReply — Launch Guide
### From zero to live SaaS in an afternoon

---

## STEP 1 — GitHub Setup

### Should you use a personal or company account?

**Create a GitHub Organization.** Here's why: if you build a company, your code should belong to the company — not tied to your personal profile. You can always transfer repos, but it's cleaner to start right.

**Do this:**
1. Sign up at [github.com](https://github.com) with your personal email (or create a new one like `dev@yourdomain.com`)
2. After signing up → click your avatar (top right) → **"Your organizations"** → **"New organization"**
3. Choose the **Free** plan
4. Name it something like `aireply-hq` (this becomes `github.com/aireply-hq`)
5. Now create a **private repository** inside that org named `aireply-app`

**Push your code:**
```bash
cd aireply-app

git init
git add .
git commit -m "Initial commit — AIReply V1 MVP"

git remote add origin https://github.com/aireply-hq/aireply-app.git
git branch -M main
git push -u origin main
```

> ✅ Keep the repo **private** until you're ready to launch. No one needs to see the code.

---

## STEP 2 — Supabase Setup

### Use a business/company email, not your personal Gmail

**Why:** Your Supabase project has your database, all your users' data, billing. If you ever sell the company or bring in a co-founder, it should be owned by the company, not your personal email.

**Create a business email first:**
- Buy your domain (e.g., `aireply.io`) at [Namecheap](https://namecheap.com) — ~$12/year
- Set up Google Workspace or just use `dev@aireply.io` via [Zoho Mail](https://zoho.com/mail) (free)
- OR: use `yourname+aireply@gmail.com` as a shortcut for now (you can change it later)

**Create Supabase project:**
1. Go to [supabase.com](https://supabase.com) → Sign up with your business email
2. Click **"New Project"**
3. Set a strong database password (save it in 1Password or similar)
4. Choose region closest to most of your users (e.g., `us-east-1` for US)
5. Wait ~2 minutes for project to spin up

**Run the database schema:**
1. In Supabase dashboard → **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it in and click **Run**
5. You should see "Success. No rows returned"

**Get your keys:**
- Settings → API → copy **Project URL** and **anon public** key
- Settings → API → copy **service_role** key (keep this SECRET — never put in frontend)

---

## STEP 3 — Google Cloud Setup (Gmail OAuth)

### Why you need this

When a user clicks "Connect Gmail" in your app, Google needs to know who you are (your app) before it lets users authorize it. That's what these credentials are for.

Think of it like a business license — you register your app with Google once, and then all your users can authorize it.

**3a. Create your Google Cloud project:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with your **business email** (same one you use for Supabase)
3. Click the project dropdown at the top → **"New Project"**
4. Name: `AIReply Production` → **Create**

**Enable Gmail API:**
1. Left sidebar → **"APIs & Services"** → **"Library"**
2. Search **"Gmail API"** → click it → **"Enable"**

**Create OAuth credentials:**
1. APIs & Services → **"Credentials"** → **"+ Create Credentials"** → **"OAuth client ID"**
2. If prompted to configure consent screen first:
   - User Type: **External**
   - App name: `AIReply`
   - User support email: your email
   - Authorized domain: your domain (e.g., `aireply.io`)
   - Scopes: add `gmail.readonly`, `userinfo.email`, `userinfo.profile`
   - Test users: add your own email for testing
3. Back to Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `AIReply Web`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/gmail/callback` (for local dev)
     - `https://your-app.vercel.app/api/gmail/callback` (for production — add after Vercel deploy)
4. Click **Create** → copy **Client ID** and **Client Secret**

---

## STEP 3b — Real-Time Email Notifications (Gmail Push)

### This replaces the manual "Sync Gmail" button

Instead of users having to click a sync button, Gmail will call your app the instant a new email arrives. This is done via Google Pub/Sub.

**Set up Pub/Sub:**

1. In Google Cloud Console → left sidebar → **"Pub/Sub"** → **"Topics"** → **"Create Topic"**
2. Topic ID: `gmail-push-notifications` → **Create**
3. After creating, click the topic → **"Subscriptions"** tab → **"Create Subscription"**
4. Subscription ID: `gmail-push-sub`
5. Delivery type: **Push**
6. Endpoint URL: `https://your-app.vercel.app/api/gmail/webhook`
7. Click **Create**

**Grant Gmail publish rights to your topic:**
1. On the topic page → click **"Permissions"**
2. Click **"Add Principal"**
3. Principal: `gmail-api-push@system.gserviceaccount.com`
4. Role: **Pub/Sub Publisher**
5. Save

**Add to your environment variables:**
```
GOOGLE_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-push-notifications
```

**Set up watch renewal (Vercel Cron):**
Gmail watches expire after 7 days. Add this to a new file `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/gmail/watch",
      "schedule": "0 0 */6 * *"
    }
  ]
}
```
Also add: `CRON_SECRET=some-random-secret-string` to your environment variables.

---

## STEP 4 — OpenAI API Key (YOU pay, not your users)

### The SaaS model: you pay centrally, users pay you a subscription

Your users never see an API key. They sign up, pay you $19/month, and the AI just works. You pay OpenAI from the revenue.

**Business math:**
| Users | Avg replies/month | OpenAI cost | Your revenue ($19/mo) | Profit |
|---|---|---|---|---|
| 50 | 100 | $25 | $950 | $925 |
| 500 | 100 | $250 | $9,500 | $9,250 |
| 2,000 | 100 | $1,000 | $38,000 | $37,000 |

**Get your key:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in (use your business email)
3. Left sidebar → **"API keys"** → **"Create new secret key"**
4. Name it `AIReply Production`
5. Copy the key (starts with `sk-...`) — **you only see it once**

**Set a usage limit (important!):**
1. Settings → **"Limits"**
2. Set a monthly budget limit (e.g., $100 to start) → this prevents surprise bills
3. Set an email alert at $50

---

## STEP 5 — Environment Variables

Create `.env.local` (never commit this to git — it's already in `.gitignore`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Gmail Push Notifications (Pub/Sub)
GOOGLE_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-push-notifications

# OpenAI — YOU pay this, not your users
OPENAI_API_KEY=sk-proj-...

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Security
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_SECRET=abc123def456...
CRON_SECRET=another-random-secret
```

---

## STEP 6 — Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Test the full flow:**
1. Sign up with your email
2. Add a test property (e.g., "Test House")
3. Add a knowledge base entry (WiFi: "Network: TestWifi, Password: test123")
4. Connect Gmail → authorize with your Airbnb-connected Gmail account
5. The app will auto-set up real-time notifications
6. Send yourself a test email from another account with subject "Question about Test House" and body "What's the WiFi password?"
7. Within seconds, it should appear in your Inbox with an AI reply ready

---

## STEP 7 — Deploy to Vercel (Production)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Then in Vercel dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add all the variables from your `.env.local`
3. Change `NEXT_PUBLIC_APP_URL` to your Vercel URL
4. Change `GMAIL_REDIRECT_URI` to `https://your-app.vercel.app/api/gmail/callback`
5. Go back to Google Cloud Console → Credentials → your OAuth client → add the production redirect URI

**Redeploy after adding env vars:**
```bash
vercel --prod
```

---

## STEP 8 — Add Billing (When Ready)

When you're ready to charge users, add [Stripe](https://stripe.com):

```bash
npm install stripe @stripe/stripe-js
```

Recommended plan structure:
- **Starter** — $19/month — 1 property, 100 AI replies/month
- **Pro** — $49/month — 9 properties, unlimited AI replies
- **Business** — $99/month — unlimited properties, team members, priority support

---

## Summary Checklist

- [ ] GitHub org created, code pushed to private repo
- [ ] Supabase project created, SQL schema run
- [ ] Google Cloud: Gmail API enabled, OAuth credentials created
- [ ] Google Pub/Sub topic + subscription created for real-time webhooks
- [ ] OpenAI API key created with spending limit set
- [ ] `.env.local` configured with all values
- [ ] App running locally and tested end-to-end
- [ ] Deployed to Vercel
- [ ] Production OAuth redirect URI added to Google Cloud

---

## Questions?

The three most common issues:

1. **"redirect_uri_mismatch" from Google** — Your callback URL in `.env.local` must exactly match what you added in Google Cloud Console. Check for trailing slashes.

2. **"No Gmail integration found"** — After connecting Gmail, try clicking "Sync Gmail" once manually. The Pub/Sub webhook takes a minute to be active.

3. **AI reply not generating** — Check that your `OPENAI_API_KEY` is set correctly in Vercel environment variables and that you've redeployed after adding it.
