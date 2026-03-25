import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AIReply — AI-Powered Property Messaging',
  description: 'Automatically draft replies to guest inquiries using your property knowledge base.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
