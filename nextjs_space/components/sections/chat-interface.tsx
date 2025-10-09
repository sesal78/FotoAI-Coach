
'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Camera, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function ChatInterface() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="lg:hidden"
              >
                <Link href="/" className="flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Link>
              </Button>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-slate-900 to-slate-700 rounded-lg">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Foto Photography Coach</h1>
                  <p className="text-slate-600">Your personal AI photography coach</p>
                </div>
              </div>
            </div>
            
            <Button
              asChild
              variant="outline"
              className="hidden lg:flex"
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6 }}
          className="w-full"
        >
          {/* Introduction Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <MessageCircle className="h-8 w-8" />
                  <span className="text-2xl font-bold">Welcome to Foto</span>
                </div>
                <p className="text-lg text-blue-100 max-w-3xl mx-auto">
                  Start chatting with your personal AI photography coach! Get personalized itineraries, 
                  daily challenges, and expert guidance tailored to your gear and style.
                </p>
              </div>
            </div>
          </div>

          {/* Chatbot Iframe */}
          <div className="w-full h-screen bg-white">
            <iframe
              src="https://apps.abacus.ai/chatllm/?appId=13a86b8346&hideTopBar=2"
              width="100%"
              height="800"
              frameBorder="0"
              title="Foto Photography Coach"
              className="w-full border-0"
              style={{ minHeight: '800px' }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>

      {/* Quick Tips */}
      <div className="bg-slate-50 border-t py-6">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Start Tips:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-medium text-slate-900 mb-2">📸 Tell me about your gear</h4>
                <p className="text-sm text-slate-600">
                  "I have a Fujifilm X-T5 with a 35mm lens"
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-medium text-slate-900 mb-2">🗺️ Request an itinerary</h4>
                <p className="text-sm text-slate-600">
                  "Create a street photography itinerary for Tokyo"
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-medium text-slate-900 mb-2">🎯 Get daily challenges</h4>
                <p className="text-sm text-slate-600">
                  "Give me a landscape photography challenge"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
