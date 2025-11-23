import { Metadata } from 'next'
import Script from 'next/script'
import ChatInterface from '@/components/sections/chat-interface'

export const metadata: Metadata = {
  title: 'Photography Coach - Foto AI',
  description: 'Chat with Foto, your personal AI photography coach. Get personalized itineraries, daily challenges, and expert guidance tailored to your gear and style.',
}

export default function ChatPage() {
  return (
    <>
      <div className="min-h-screen pt-16">
        <ChatInterface />
      </div>
      
      {/* Challenge Sync Integration */}
      <Script 
        src="/challenge-sync.js" 
        strategy="afterInteractive"
      />
    </>
  )
}
