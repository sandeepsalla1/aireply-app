'use client'

import { useState, useEffect, useCallback } from 'react'
import { Conversation } from '@/types/database'
import { timeAgo, formatTime, cn, statusColor, confidenceColor, initials, truncate } from '@/lib/utils'
import {
  RefreshCw, Filter, Search, Copy, RotateCcw, CheckCircle,
  ChevronRight, Inbox, Zap, AlertCircle, MessageSquare, Send,
  Building2, Clock, Users, Tag, Loader2, CheckCheck
} from 'lucide-react'

const STATUS_TABS = [
  { id: 'unread', label: 'Unread' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'replied', label: 'Replied' },
  { id: 'all', label: 'All' },
]

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [activeTab, setActiveTab] = useState('unread')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState({ unread: 0, aiReady: 0, maintenance: 0, responseRate: 92 })

  const fetchConversations = useCallback(async (status = activeTab) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status, limit: '50' })
      const res = await fetch(`/api/conversations?${params}`)
      const data = await res.json()
      setConversations(data || [])

      // Compute stats
      const unread = data.filter((c: Conversation) => c.status === 'unread').length
      const aiReady = data.filter((c: Conversation) => (c as any).latest_reply?.status === 'draft').length
      const maintenance = data.filter((c: Conversation) =>
        c.inquiry_type?.includes('maintenance')
      ).length
      setStats(s => ({ ...s, unread, aiReady, maintenance }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchConversations(activeTab)
  }, [activeTab])

  useEffect(() => {
    if (selectedConv) {
      const latest = (selectedConv as any).latest_reply
      setReplyText(latest?.reply_text || '')
      setCopied(false)
    }
  }, [selectedConv])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await fetchConversations()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSyncing(false)
    }
  }

  const handleGenerateReply = async () => {
    if (!selectedConv) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConv.id }),
      })
      const data = await res.json()
      if (data.replyText) {
        setReplyText(data.replyText)
        // Update conversation in list
        setConversations(prev =>
          prev.map(c => c.id === selectedConv.id
            ? { ...c, latest_reply: data } as any
            : c
          )
        )
        setSelectedConv(prev => prev
          ? { ...prev, latest_reply: { ...data, status: 'draft' } } as any
          : prev
        )
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyReply = async () => {
    if (!replyText) return
    await navigator.clipboard.writeText(replyText)
    setCopied(true)

    // Mark as copied in DB
    const reply = (selectedConv as any)?.latest_reply
    if (reply?.id) {
      await fetch('/api/ai/generate-reply', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId: reply.id, status: 'copied' }),
      })
      // Update status in list
      setConversations(prev =>
        prev.map(c => c.id === selectedConv?.id
          ? { ...c, status: 'replied' } as any
          : c
        )
      )
    }

    setTimeout(() => setCopied(false), 3000)
  }

  const handleMarkDone = async () => {
    if (!selectedConv) return
    await fetch(`/api/conversations/${selectedConv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'replied' }),
    })
    setConversations(prev => prev.filter(c => c.id !== selectedConv.id))
    setSelectedConv(null)
  }

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.guest_name?.toLowerCase().includes(q) ||
      c.subject?.toLowerCase().includes(q) ||
      (c as any).property?.name?.toLowerCase().includes(q)
    )
  })

  const latestReply = selectedConv ? (selectedConv as any).latest_reply : null
  const latestMessage = selectedConv ? (selectedConv as any).latest_message : null

  return (
    <div className="flex flex-col h-full">
      {/* Header stats bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-gray-900">Today&apos;s Overview</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync Gmail'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={<MessageSquare className="w-5 h-5 text-blue-500" />} value={stats.unread} label="New Messages" />
          <StatCard icon={<Zap className="w-5 h-5 text-teal-500" />} value={stats.aiReady} label="AI Replies Ready" color="text-teal-600" />
          <StatCard icon={<AlertCircle className="w-5 h-5 text-red-400" />} value={stats.maintenance} label="Maintenance Issues" color="text-red-500" />
          <StatCard icon={<Users className="w-5 h-5 text-teal-500" />} value={`${stats.responseRate}%`} label="Response Rate" color="text-teal-600" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center px-3 pt-3 border-b border-gray-100 pb-0">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'text-xs font-medium px-2 pb-2 border-b-2 transition-colors mr-3 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Inbox className="w-8 h-8 mb-2" />
                <p className="text-sm">No messages</p>
                <button onClick={handleSync} className="mt-3 text-xs text-brand-500 hover:underline">
                  Sync Gmail
                </button>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  isSelected={selectedConv?.id === conv.id}
                  onClick={() => setSelectedConv(conv)}
                />
              ))
            )}
          </div>
        </div>

        {/* Message detail + AI reply */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center">
                      {initials(selectedConv.guest_name || 'G')}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{selectedConv.guest_name || 'Guest'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {(selectedConv as any).property?.name || 'Unknown property'}
                        <span className="text-gray-300 mx-0.5">·</span>
                        <Clock className="w-3 h-3" />
                        {selectedConv.last_message_at ? formatTime(selectedConv.last_message_at) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
                {selectedConv.inquiry_type && selectedConv.inquiry_type.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {selectedConv.inquiry_type.slice(0, 3).map(type => (
                      <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                        {type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Guest message */}
              <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0 max-h-64 overflow-y-auto">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Guest Message</div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {latestMessage?.extracted_guest_message || latestMessage?.body_clean || selectedConv.subject || 'No message content'}
                  </p>
                </div>
                {latestMessage?.extraction_confidence && (
                  <p className="text-xs text-gray-400 mt-2">
                    AI extraction confidence: {Math.round(latestMessage.extraction_confidence * 100)}%
                  </p>
                )}
              </div>

              {/* AI Reply Section */}
              <div className="flex-1 flex flex-col px-6 py-5 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">AI Suggested Reply</span>
                    {latestReply && (
                      <span className={cn(
                        'text-xs font-medium',
                        confidenceColor(latestReply.confidence_label || 'medium')
                      )}>
                        {latestReply.confidence_label === 'high' ? 'High confidence' :
                          latestReply.confidence_label === 'medium' ? 'Medium confidence' : 'Low confidence'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reply text area */}
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={latestReply ? '' : "Click 'Generate Reply' to create an AI-drafted reply..."}
                  className="flex-1 w-full text-sm text-gray-700 leading-relaxed resize-none outline-none bg-transparent"
                />

                {/* Knowledge used */}
                {latestReply?.knowledge_used?.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                    <Tag className="w-3 h-3" />
                    Knowledge used: {latestReply.knowledge_used.join(' · ')}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleCopyReply}
                    disabled={!replyText || copied}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Reply'}
                  </button>

                  <button
                    onClick={handleGenerateReply}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {generating
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RotateCcw className="w-4 h-4" />}
                    {generating ? 'Generating…' : replyText ? 'Regenerate' : 'Generate Reply'}
                  </button>

                  <button
                    onClick={handleMarkDone}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors ml-auto"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Mark Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, color = 'text-gray-900' }: {
  icon: React.ReactNode
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className={cn('text-2xl font-bold', color)}>{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function ConversationRow({ conv, isSelected, onClick }: {
  conv: Conversation
  isSelected: boolean
  onClick: () => void
}) {
  const latestReply = (conv as any).latest_reply
  const latestMessage = (conv as any).latest_message
  const property = (conv as any).property

  const preview = latestMessage?.extracted_guest_message || latestMessage?.body_clean || conv.subject || ''

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors',
        isSelected && 'bg-brand-50 border-l-2 border-l-brand-500'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-semibold flex-shrink-0">
            {initials(conv.guest_name || 'G')}
          </div>
          {conv.status === 'unread' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-gray-900 text-sm truncate">{conv.guest_name || 'Guest'}</span>
            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
              {conv.last_message_at ? timeAgo(conv.last_message_at) : ''}
            </span>
          </div>
          {property && (
            <div className="text-xs text-gray-500 mb-1">{property.name}</div>
          )}
          <p className="text-xs text-gray-400 truncate leading-relaxed">
            {truncate(preview, 80)}
          </p>
        </div>
      </div>
    </button>
  )
}
