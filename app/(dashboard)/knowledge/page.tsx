'use client'

import { useState, useEffect } from 'react'
import { KnowledgeBase, Property } from '@/types/database'
import { BookOpen, Plus, X, Loader2, Edit2, Trash2, Tag, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { id: 'wifi', label: 'WiFi' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'checkout', label: 'Check-out' },
  { id: 'parking', label: 'Parking' },
  { id: 'rules', label: 'House Rules' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'local_info', label: 'Local Info' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'faq', label: 'FAQ' },
]

const CATEGORY_COLORS: Record<string, string> = {
  wifi: 'bg-blue-100 text-blue-700',
  checkin: 'bg-green-100 text-green-700',
  checkout: 'bg-orange-100 text-orange-700',
  parking: 'bg-purple-100 text-purple-700',
  rules: 'bg-red-100 text-red-700',
  amenities: 'bg-teal-100 text-teal-700',
  local_info: 'bg-yellow-100 text-yellow-700',
  emergency: 'bg-red-100 text-red-700',
  maintenance: 'bg-gray-100 text-gray-700',
  faq: 'bg-indigo-100 text-indigo-700',
}

const defaultForm = {
  property_id: '', category: 'wifi', title: '', content: '', tags: '',
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeBase[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [filterPropertyId, setFilterPropertyId] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProperties()
    fetchEntries()
  }, [])

  const fetchProperties = async () => {
    const res = await fetch('/api/properties')
    const data = await res.json()
    setProperties(data || [])
  }

  const fetchEntries = async () => {
    setLoading(true)
    const res = await fetch('/api/knowledge-base')
    const data = await res.json()
    setEntries(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setShowForm(true)
    setError(null)
  }

  const openEdit = (entry: KnowledgeBase) => {
    setEditingId(entry.id)
    setForm({
      property_id: entry.property_id || '',
      category: entry.category,
      title: entry.title,
      content: entry.content,
      tags: (entry.tags || []).join(', '),
    })
    setShowForm(true)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      property_id: form.property_id || null,
      category: form.category,
      title: form.title,
      content: form.content,
      tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    }

    const url = editingId ? `/api/knowledge-base/${editingId}` : '/api/knowledge-base'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      await fetchEntries()
      setShowForm(false)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this knowledge base entry?')) return
    await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const filteredEntries = entries.filter(e => {
    if (filterPropertyId !== 'all' && e.property_id !== (filterPropertyId === 'global' ? null : filterPropertyId)) return false
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    return true
  })

  // Group by category
  const grouped = filteredEntries.reduce((acc, entry) => {
    const cat = entry.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(entry)
    return acc
  }, {} as Record<string, KnowledgeBase[]>)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-500">{entries.length} entries · the heart of your AI assistant</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <select
          value={filterPropertyId}
          onChange={e => setFilterPropertyId(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        >
          <option value="all">All properties</option>
          <option value="global">Global (all properties)</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{filteredEntries.length} entries</span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-2">No knowledge base entries yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
              Add information about your properties — WiFi passwords, check-in instructions, parking info, house rules.
              The AI uses this to draft accurate replies to guest questions.
            </p>
            <button onClick={openCreate} className="bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
              Add your first entry
            </button>

            {/* Quick-start templates */}
            <div className="mt-8 max-w-lg mx-auto">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Quick-start templates</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { category: 'wifi', title: 'WiFi Password', content: 'Network: GuestWifi\nPassword: WelcomeHome2024' },
                  { category: 'checkin', title: 'Check-in Instructions', content: 'Check-in is from 3:00 PM. Lock code is 4823.' },
                  { category: 'parking', title: 'Parking Info', content: 'Free parking in the driveway. Street parking also available.' },
                  { category: 'checkout', title: 'Check-out Instructions', content: 'Check-out is by 11:00 AM. Leave keys on the kitchen counter.' },
                ].map(template => (
                  <button
                    key={template.title}
                    onClick={() => {
                      setForm(f => ({ ...f, ...template, tags: '' }))
                      setShowForm(true)
                    }}
                    className="text-left p-3 border border-dashed border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  >
                    <div className={cn('inline-block text-xs px-2 py-0.5 rounded-full mb-1.5', CATEGORY_COLORS[template.category])}>
                      {template.category}
                    </div>
                    <div className="text-sm font-medium text-gray-700">{template.title}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  <span className={cn('px-2 py-0.5 rounded-full', CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700')}>
                    {CATEGORIES.find(c => c.id === category)?.label || category}
                  </span>
                  <span className="text-gray-300">{items.length}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(entry => (
                    <KnowledgeCard
                      key={entry.id}
                      entry={entry}
                      properties={properties}
                      onEdit={() => openEdit(entry)}
                      onDelete={() => handleDelete(entry.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold">{editingId ? 'Edit Entry' : 'Add Knowledge Base Entry'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Property</label>
                  <select
                    value={form.property_id}
                    onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none bg-white"
                  >
                    <option value="">All properties (global)</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none bg-white"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. WiFi Password, Parking Instructions"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Content *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Add the information the AI should use when answering guest questions..."
                  required
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tags <span className="text-gray-400 font-normal">(comma-separated, helps AI find this entry)</span>
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. wifi, internet, password, network"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Add Entry'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function KnowledgeCard({ entry, properties, onEdit, onDelete }: {
  entry: KnowledgeBase
  properties: Property[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const property = properties.find(p => p.id === entry.property_id)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-700')}>
              {CATEGORIES.find(c => c.id === entry.category)?.label || entry.category}
            </span>
            {property ? (
              <span className="text-xs text-gray-400">{property.name}</span>
            ) : (
              <span className="text-xs text-gray-400 italic">All properties</span>
            )}
          </div>
          <h4 className="font-semibold text-gray-900 text-sm">{entry.title}</h4>
        </div>
        <div className="flex gap-1 ml-2 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      <div className="mt-2">
        <p className={cn('text-sm text-gray-600 whitespace-pre-wrap', !expanded && 'line-clamp-2')}>
          {entry.content}
        </p>
        {entry.content.length > 100 && (
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-brand-500 mt-1 hover:underline">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {entry.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-50 text-gray-400 text-xs rounded">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}
