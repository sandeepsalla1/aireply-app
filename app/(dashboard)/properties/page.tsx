'use client'

import { useState, useEffect } from 'react'
import { Property } from '@/types/database'
import { Building2, Plus, MapPin, Users, BedDouble, X, Loader2, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROPERTY_TYPES = ['airbnb', 'vrbo', 'hotel_room', 'apartment', 'house', 'condo', 'coliving', 'other']

const defaultForm = {
  name: '', short_name: '', address: '', property_type: 'airbnb',
  platform: 'airbnb', description: '', max_guests: 2, bedrooms: 1,
  bathrooms: 1, listing_url: '', email_keywords: '' as string,
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...defaultForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    setLoading(true)
    const res = await fetch('/api/properties')
    const data = await res.json()
    setProperties(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setShowForm(true)
    setError(null)
  }

  const openEdit = (property: Property) => {
    setEditingId(property.id)
    setForm({
      name: property.name,
      short_name: property.short_name || '',
      address: property.address || '',
      property_type: property.property_type,
      platform: property.platform,
      description: property.description || '',
      max_guests: property.max_guests,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      listing_url: property.listing_url || '',
      email_keywords: (property.email_keywords || []).join(', '),
    })
    setShowForm(true)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      email_keywords: form.email_keywords
        ? form.email_keywords.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    }

    const url = editingId ? `/api/properties/${editingId}` : '/api/properties'
    const method = editingId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      await fetchProperties()
      setShowForm(false)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this property? It won\'t be deleted, just hidden.')) return
    await fetch(`/api/properties/${id}`, { method: 'DELETE' })
    setProperties(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-500">{properties.length} propert{properties.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-2">No properties yet</h3>
            <p className="text-sm text-gray-400 mb-6">Add your first property to get started. This is how AIReply knows which property a guest message is about.</p>
            <button onClick={openCreate} className="bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
              Add your first property
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                onEdit={() => openEdit(property)}
                onDelete={() => handleDelete(property.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Property' : 'Add Property'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ashwood Drive"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Name / Alias</label>
                  <input
                    type="text"
                    value={form.short_name}
                    onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                    placeholder="e.g. Ashwood"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="123 Ashwood Drive, Austin TX 78701"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Type</label>
                  <select
                    value={form.property_type}
                    onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none bg-white"
                  >
                    {PROPERTY_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
                  <select
                    value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none bg-white"
                  >
                    <option value="airbnb">Airbnb</option>
                    <option value="vrbo">VRBO</option>
                    <option value="booking">Booking.com</option>
                    <option value="direct">Direct Booking</option>
                    <option value="multiple">Multiple Platforms</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Guests</label>
                  <input type="number" min={1} value={form.max_guests}
                    onChange={e => setForm(f => ({ ...f, max_guests: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bedrooms</label>
                  <input type="number" min={0} step={1} value={form.bedrooms}
                    onChange={e => setForm(f => ({ ...f, bedrooms: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bathrooms</label>
                  <input type="number" min={0} step={0.5} value={form.bathrooms}
                    onChange={e => setForm(f => ({ ...f, bathrooms: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Keywords
                  <span className="text-gray-400 font-normal ml-1">(comma-separated, helps AI match emails to this property)</span>
                </label>
                <input
                  type="text"
                  value={form.email_keywords}
                  onChange={e => setForm(f => ({ ...f, email_keywords: e.target.value }))}
                  placeholder="e.g. Ashwood, 123 Ashwood Drive, Ashwood listing"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the property..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Listing URL</label>
                <input
                  type="url"
                  value={form.listing_url}
                  onChange={e => setForm(f => ({ ...f, listing_url: e.target.value }))}
                  placeholder="https://airbnb.com/rooms/..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Add Property'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
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

function PropertyCard({ property, onEdit, onDelete }: {
  property: Property
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:border-brand-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{property.name}</h3>
            <span className="text-xs text-gray-400 capitalize">{property.platform}</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {property.address && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="truncate">{property.address}</span>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {property.max_guests} guests
        </div>
        <div className="flex items-center gap-1">
          <BedDouble className="w-3 h-3" />
          {property.bedrooms} bed
        </div>
      </div>

      {property.email_keywords && property.email_keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {property.email_keywords.slice(0, 3).map(kw => (
            <span key={kw} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{kw}</span>
          ))}
        </div>
      )}

      {property.listing_url && (
        <a href={property.listing_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-brand-500 mt-3 hover:underline">
          <ExternalLink className="w-3 h-3" />
          View listing
        </a>
      )}
    </div>
  )
}
