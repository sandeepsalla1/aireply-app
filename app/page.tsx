import Link from 'next/link'
import { MessageSquare, Zap, Building2, Brain, CheckCircle, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">AIReply</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link href="/signup" className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          AI-powered for property managers
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Stop copy-pasting.<br />
          <span className="text-brand-500">Let AI draft your guest replies.</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Connect your Gmail, add your property knowledge base, and AIReply automatically drafts
          perfect responses to every Airbnb guest message. Copy, paste, done.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup" className="bg-brand-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-600 transition-colors flex items-center gap-2">
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login" className="text-gray-600 px-6 py-3 rounded-xl font-medium border border-gray-200 hover:border-gray-300 transition-colors">
            Sign in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: MessageSquare, step: '1', title: 'Guest messages you on Airbnb', desc: 'You get an email notification from Airbnb' },
              { icon: Brain, step: '2', title: 'AIReply reads & parses it', desc: 'AI extracts the guest\'s question and identifies the property' },
              { icon: Building2, step: '3', title: 'Pulls from your knowledge base', desc: 'Finds the relevant info from your property-specific knowledge base' },
              { icon: CheckCircle, step: '4', title: 'You copy & paste the reply', desc: 'Review the AI draft, copy it, paste into Airbnb. Done in seconds.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-brand-600" />
                </div>
                <div className="text-xs font-bold text-brand-500 mb-2">STEP {step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Built for property managers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Smart email parsing', desc: 'AI-powered parsing that works even when Airbnb changes their email format. No brittle regex that breaks overnight.' },
            { title: 'Property knowledge base', desc: 'Store WiFi passwords, check-in instructions, parking info, house rules — per property. AI uses this to draft accurate replies.' },
            { title: 'Multi-property inbox', desc: 'All guest messages in one place. See which property each message is for, automatically.' },
            { title: 'Confidence scoring', desc: 'Every AI reply comes with a confidence score. High confidence = the AI knows the answer. Low = you should review more carefully.' },
            { title: 'Works for everyone', desc: 'Airbnb hosts, VRBO hosts, boutique hotel operators, co-living managers, landlords — if you get guest emails, AIReply helps.' },
            { title: 'Your data stays yours', desc: 'We never auto-send messages. You always review and copy manually. Full control.' },
          ].map(({ title, desc }) => (
            <div key={title} className="p-6 rounded-xl border border-gray-100 hover:border-brand-200 transition-colors">
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500 py-16">
        <div className="max-w-3xl mx-auto text-center px-6">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to save hours every week?</h2>
          <p className="text-brand-100 mb-8">Join property managers who&apos;ve stopped typing the same answers over and over.</p>
          <Link href="/signup" className="bg-white text-brand-600 px-8 py-3 rounded-xl font-semibold hover:bg-brand-50 transition-colors inline-flex items-center gap-2">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-brand-500 rounded flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-gray-600">AIReply</span>
          </div>
          <p>© 2024 AIReply. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
