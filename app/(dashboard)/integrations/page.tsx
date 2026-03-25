'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Mail, RefreshCw, AlertCircle, Loader2, ExternalLink, Plug, Clock } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

export default function IntegrationsPage() {
  const [integration, setIntegration] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)

  useEffect(() => {
    fetchIntegration()
    // Check URL params for success/error from OAuth callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'gmail_connected') {
      setSyncResult({ success: true, message: `Gmail connected: ${params.get('email')}` })
      window.history.replaceState({}, '', '/integrations')
      fetchIntegration()
    } else if (params.get('error')) {
      setSyncResult({ error: params.get('error') })
      window.history.replaceState({}, '', '/integrations')
    }
  }, [])

  const fetchIntegration = async () => {
    setLoading(true)
    try {
      // Fetch from profile (we'll check if gmail integration exists)
      const res = await fetch('/api/gmail/status')
      if (res.ok) {
        const data = await res.json()
        setIntegration(data)
      }
    } catch {
      // No integration yet
    }
    setLoading(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      fetchIntegration()
    } catch {
      setSyncResult({ error: 'Sync failed' })
    }
    setSyncing(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500">Connect the tools you use to manage guest communication.</p>
      </div>

      <div className="p-6 max-w-3xl">
        {/* Message Sources */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Message Sources</h2>
          <div className="grid grid-cols-2 gap-4">

            {/* Gmail - Primary */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 col-span-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Gmail</h3>
                    <p className="text-sm text-gray-500">Reads Airbnb email notifications from your inbox</p>
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : integration?.gmail ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Connected
                    </span>
                  </div>
                ) : (
                  <a
                    href="/api/gmail/connect"
                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    Connect Gmail
                  </a>
                )}
              </div>

              {integration?.gmail && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 font-medium">{integration.gmail.gmail_address}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last synced: {integration.gmail.last_synced_at ? timeAgo(integration.gmail.last_synced_at) : 'Never'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                        {syncing ? 'Syncing…' : 'Sync now'}
                      </button>
                      <a href="/api/gmail/connect" className="text-sm text-brand-500 hover:underline">
                        Reconnect
                      </a>
                    </div>
                  </div>

                  {syncResult && (
                    <div className={cn(
                      'mt-3 px-3 py-2 rounded-lg text-sm',
                      syncResult.success || syncResult.emailsProcessed !== undefined
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    )}>
                      {syncResult.error
                        ? `Error: ${syncResult.error}`
                        : syncResult.message
                          ? syncResult.message
                          : `Synced ${syncResult.emailsProcessed || 0} new messages`
                      }
                    </div>
                  )}
                </div>
              )}

              {!integration?.gmail && !loading && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
                  <p className="font-medium mb-1">How Gmail integration works:</p>
                  <ol className="space-y-1 text-blue-600 list-decimal list-inside">
                    <li>Connect your Gmail account (the one you use for Airbnb)</li>
                    <li>AIReply reads incoming Airbnb notification emails</li>
                    <li>AI extracts guest messages and matches them to your properties</li>
                    <li>AI drafts a reply — you copy it and paste into Airbnb</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Airbnb Direct */}
            <IntegrationCard
              icon={<div className="text-lg">🏠</div>}
              name="Airbnb (Direct API)"
              description="Direct integration (no email needed)"
              status="coming_soon"
            />

            {/* VRBO */}
            <IntegrationCard
              icon={<div className="text-lg">🏖</div>}
              name="VRBO"
              description="Connect your VRBO account"
              status="waitlist"
            />

            {/* Booking.com */}
            <IntegrationCard
              icon={<div className="text-lg">🌐</div>}
              name="Booking.com"
              description="Connect your Booking.com property"
              status="waitlist"
            />

            {/* WhatsApp */}
            <IntegrationCard
              icon={<div className="text-lg">💬</div>}
              name="WhatsApp"
              description="Reply to guests via WhatsApp"
              status="connect"
            />
          </div>
        </section>

        {/* AI Assistants */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">AI Assistants</h2>
          <div className="grid grid-cols-2 gap-4">
            <IntegrationCard
              icon={<div className="text-lg">🤖</div>}
              name="OpenAI GPT-4o"
              description="Powers your AI reply generation"
              status="active"
              badge="Active"
            />
            <IntegrationCard
              icon={<div className="text-lg">💜</div>}
              name="Claude (Anthropic)"
              description="Alternative AI model option"
              status="connect"
            />
          </div>
        </section>

        {/* Setup Guide */}
        <section className="mt-8">
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Setup Checklist</h3>
            <div className="space-y-3">
              {[
                { label: 'Create your account', done: true },
                { label: 'Add at least one property', done: false },
                { label: 'Add knowledge base entries', done: false },
                { label: 'Connect Gmail', done: !!integration?.gmail },
                { label: 'Add OpenAI API key (optional — uses shared key by default)', done: false },
                { label: 'Sync your first emails', done: !!integration?.gmail?.last_synced_at },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  )}
                  <span className={cn(done ? 'text-gray-400 line-through' : 'text-gray-700')}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function IntegrationCard({
  icon, name, description, status, badge
}: {
  icon: React.ReactNode
  name: string
  description: string
  status: 'connected' | 'connect' | 'coming_soon' | 'waitlist' | 'active'
  badge?: string
}) {
  const statusConfig = {
    connected: { label: 'Connected', className: 'text-green-600 bg-green-50' },
    connect: { label: 'Connect', className: 'text-gray-700 border border-gray-200 hover:bg-gray-50 cursor-pointer' },
    coming_soon: { label: 'Coming Soon', className: 'text-gray-400 bg-gray-50' },
    waitlist: { label: 'Join Waitlist', className: 'text-brand-600 bg-brand-50 hover:bg-brand-100 cursor-pointer' },
    active: { label: badge || 'Active', className: 'text-green-600 bg-green-50' },
  }

  const config = statusConfig[status]

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-medium text-gray-900 text-sm">{name}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
      </div>
      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-lg flex-shrink-0', config.className)}>
        {config.label}
      </span>
    </div>
  )
}
