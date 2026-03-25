import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import crypto from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================
// Date Utilities
// ============================================================
export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'h:mm a')
}

// ============================================================
// Encryption Utilities (for storing Gmail tokens)
// ============================================================
const ALGORITHM = 'aes-256-gcm'
const SECRET = process.env.ENCRYPTION_SECRET || 'fallback-dev-secret-change-me!!'

function getKey(): Buffer {
  return crypto.scryptSync(SECRET, 'salt', 32)
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ============================================================
// String Utilities
// ============================================================
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen - 3) + '...'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============================================================
// Email Utilities
// ============================================================
export function extractEmailAddress(str: string): string | null {
  const match = str.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

export function extractName(fromHeader: string): string {
  // Parse "Name <email>" format
  const match = fromHeader.match(/^(.+?)\s*</)
  if (match) return match[1].replace(/"/g, '').trim()
  return fromHeader.split('@')[0]
}

// ============================================================
// Color Utilities
// ============================================================
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    unread: 'bg-blue-100 text-blue-800',
    needs_review: 'bg-yellow-100 text-yellow-800',
    replied: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
    spam: 'bg-red-100 text-red-800',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: 'text-gray-400',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-600',
  }
  return map[priority] || 'text-gray-400'
}

export function confidenceColor(label: string): string {
  const map: Record<string, string> = {
    high: 'text-green-600',
    medium: 'text-yellow-600',
    low: 'text-red-500',
  }
  return map[label] || 'text-gray-500'
}
