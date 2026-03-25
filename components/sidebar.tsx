'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Inbox, Building2, BookOpen,
  BarChart2, Plug, Settings, LogOut, ChevronDown
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/properties', icon: Building2, label: 'Properties' },
  { href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/integrations', icon: Plug, label: 'Integrations' },
]

interface SidebarProps {
  user: any
  profile: any
}

export default function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Host'
  const avatarInitials = initials(displayName)

  return (
    <div className="w-60 flex-shrink-0 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <Link href="/inbox" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-[15px]">AI Inbox Assistant</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-gray-500')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-2">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-brand-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          )}
        >
          <Settings className="w-4 h-4 flex-shrink-0 text-gray-500" />
          Settings
        </Link>
      </div>

      {/* User Profile */}
      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              avatarInitials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{displayName}</div>
            <div className="text-xs text-gray-500 truncate">{profile?.business_type?.replace(/_/g, ' ') || 'Host'}</div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
