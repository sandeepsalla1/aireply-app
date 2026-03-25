'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save, Zap } from 'lucide-react'

const BUSINESS_TYPES = [
  { value: 'airbnb_host', label: 'Airbnb Host' },
  { value: 'vrbo_host', label: 'VRBO Host' },
  { value: 'hotel', label: 'Hotel / Motel' },
  { value: 'boutique_hotel', label: 'Boutique Hotel' },
  { value: 'coliving', label: 'Co-living / PadSplit' },
  { value: 'landlord', label: 'Landlord / Property Manager' },
  { value: 'other', label: 'Other' },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({
      full_name: profile.full_name,
      business_name: profile.business_name,
      business_type: profile.business_type,
      timezone: profile.timezone,
      // Note: openai_api_key is NOT stored per user — operator pays centrally
    }).eq('id', user.id)

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Profile</h2>
            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={profile?.full_name || ''}
                  onChange={e => setProfile((p: any) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Business / Company Name</label>
                <input
                  type="text"
                  value={profile?.business_name || ''}
                  onChange={e => setProfile((p: any) => ({ ...p, business_name: e.target.value }))}
                  placeholder="e.g. Smith Properties LLC"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Type</label>
                  <select
                    value={profile?.business_type || 'airbnb_host'}
                    onChange={e => setProfile((p: any) => ({ ...p, business_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none bg-white"
                  >
                    {BUSINESS_TYPES.map(bt => (
                      <option key={bt.value} value={bt.value}>{bt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                  <select
                    value={profile?.timezone || 'America/New_York'}
                    onChange={e => setProfile((p: any) => ({ ...p, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none bg-white"
                  >
                    <option value="America/New_York">Eastern (ET)</option>
                    <option value="America/Chicago">Central (CT)</option>
                    <option value="America/Denver">Mountain (MT)</option>
                    <option value="America/Los_Angeles">Pacific (PT)</option>
                    <option value="America/Phoenix">Arizona (MST)</option>
                    <option value="Pacific/Honolulu">Hawaii (HST)</option>
                    <option value="America/Anchorage">Alaska (AKT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Australia/Sydney">Sydney (AEDT)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>
          </section>

          {/* AI — included in subscription, no user action needed */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">AI</h2>
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-5 flex items-start gap-4">
              <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-brand-900 text-sm mb-1">AI is included in your plan</p>
                <p className="text-sm text-brand-700 leading-relaxed">
                  Reply generation is powered by GPT-4o and is fully included — no API key needed.
                  There&apos;s no usage limit on your current plan.
                </p>
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
