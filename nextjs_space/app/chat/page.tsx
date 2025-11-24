'use client'

import ChatInterface from '@/components/sections/chat-interface'
import { useEffect } from 'react'
import Script from 'next/script'

export default function ChatPage() {
  useEffect(() => {
    // Ensure email button script runs after page load
    const initEmailButton = () => {
      if (typeof window !== 'undefined' && (window as any).initEmailChallengeButton) {
        (window as any).initEmailChallengeButton()
      }
    }

    // Try to initialize immediately
    initEmailButton()

    // Also try after a short delay in case script is still loading
    const timer = setTimeout(initEmailButton, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <Script src="/email-challenge.js?v=2024112403" strategy="afterInteractive" />
      <div className="min-h-screen pt-16">
        <ChatInterface />
      </div>
    </>
  )
}
