'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Clock, TrendingUp, TrendingDown, BarChart2, Users, Zap, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOP_QUESTIONS = [
  { label: 'Parking', pct: 34 },
  { label: 'Check in Time', pct: 21 },
  { label: 'WiFi password', pct: 19 },
  { label: 'Late checkout', pct: 12 },
  { label: 'Early check-in', pct: 8 },
  { label: 'Pet policy', pct: 6 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7d')
  const [stats, setStats] = useState({
    totalMessages: 56, responseRate: 77, avgResponseMinutes: 130,
    repliesGenerated: 48, repliesCopied: 41,
  })

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      <div className="p-6 max-w-5xl">
        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
            value={stats.totalMessages.toString()}
            label="New Messages"
            change="+48% from last period"
            positive
          />
          <MetricCard
            icon={<Clock className="w-5 h-5 text-teal-500" />}
            value={`${Math.floor(stats.avgResponseMinutes / 60)}h ${stats.avgResponseMinutes % 60}m`}
            label="Avg Response Time"
            change="Down from 2h 32m"
            positive
          />
          <MetricCard
            icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            value={`${stats.responseRate}%`}
            label="Response Rate"
            change="Up from 68%"
            positive
          />
          <MetricCard
            icon={<Zap className="w-5 h-5 text-yellow-500" />}
            value={`${Math.round((stats.repliesCopied / stats.repliesGenerated) * 100)}%`}
            label="AI Reply Usage Rate"
            change="Replies copied / generated"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Top Questions */}
          <div className="col-span-1">
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Top Guest Questions</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {TOP_QUESTIONS.map(({ label, pct }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className="text-sm font-medium text-gray-900">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Property Performance */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Property Activity</h3>
                <button className="text-xs text-brand-500 hover:underline">View all</button>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Ashwood Drive', messages: 18, color: 'bg-red-200' },
                  { name: 'Kemp Street ADU', messages: 14, color: 'bg-blue-200' },
                  { name: 'Coachman Circle', messages: 11, color: 'bg-green-200' },
                  { name: 'Uptown Loft', messages: 8, color: 'bg-yellow-200' },
                ].map(({ name, messages, color }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
                    <span className="text-sm text-gray-600 flex-1 truncate">{name}</span>
                    <span className="text-sm font-medium text-gray-900">{messages}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Message Volume Chart (simplified) */}
          <div className="col-span-2">
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Message Volume</h3>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <div className="w-2 h-2 bg-brand-500 rounded" />
                  Messages per day
                </span>
              </div>
              <SimpleBarChart />
            </div>

            {/* AI Performance */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4">
              <h3 className="font-semibold text-gray-900 mb-4">AI Reply Performance</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Replies Generated', value: stats.repliesGenerated, color: 'text-blue-600 bg-blue-50' },
                  { label: 'Replies Copied', value: stats.repliesCopied, color: 'text-green-600 bg-green-50' },
                  { label: 'High Confidence', value: Math.round(stats.repliesGenerated * 0.68), color: 'text-teal-600 bg-teal-50' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={cn('p-4 rounded-xl text-center', color.split(' ')[1])}>
                    <div className={cn('text-2xl font-bold', color.split(' ')[0])}>{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-brand-50 rounded-xl text-sm text-brand-700">
                <strong>Time saved estimate:</strong> ~{Math.round(stats.repliesCopied * 4)} minutes
                ({stats.repliesCopied} replies × ~4 min saved each)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, value, label, change, positive }: {
  icon: React.ReactNode
  value: string
  label: string
  change: string
  positive?: boolean
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className={cn('text-xs flex items-center gap-1', positive ? 'text-green-600' : 'text-gray-400')}>
        {positive && <TrendingUp className="w-3 h-3" />}
        {change}
      </div>
    </div>
  )
}

function SimpleBarChart() {
  const days = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']
  const values = [4, 7, 5, 8, 11, 6, 3, 9, 6, 8, 10, 7, 4, 12]
  const max = Math.max(...values)

  return (
    <div className="flex items-end gap-1.5 h-32">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-brand-200 hover:bg-brand-400 rounded-t transition-colors"
            style={{ height: `${(v / max) * 100}%` }}
          />
          {i % 2 === 0 && (
            <span className="text-xs text-gray-300">{days[i]}</span>
          )}
        </div>
      ))}
    </div>
  )
}
