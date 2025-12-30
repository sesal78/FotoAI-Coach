'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Aperture, Map, Target } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ChatInterface() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="overline text-background/50 mb-3 block">AI Photography Coach</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight display-font mb-4">
              Welcome to <span className="text-primary">Foto</span>
            </h1>
            <p className="text-lg text-background/70 max-w-2xl mx-auto leading-relaxed">
              Get personalized itineraries, daily challenges, and expert guidance tailored to your gear and style.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Chatbot Container */}
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full"
        >
          {/* Chatbot Iframe */}
          <div className="w-full bg-background">
            <iframe
              src="https://apps.abacus.ai/chatllm/?appId=13a86b8346&hideTopBar=2"
              width="100%"
              height="700"
              frameBorder="0"
              title="Foto Photography Coach"
              className="w-full border-0"
              style={{ minHeight: '700px' }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>

      {/* Quick Tips */}
      <div className="bg-muted border-t border-border py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <span className="overline mb-3 block">Quick Start</span>
            <h2 className="text-2xl font-bold tracking-tight display-font mb-8">Try these prompts</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <div className="editorial-card p-6 group">
                <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary mb-4 transition-colors group-hover:bg-primary group-hover:text-white">
                  <Aperture className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Tell me about your gear</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  &ldquo;I have a Fujifilm X-T5 with a 35mm lens&rdquo;
                </p>
              </div>
              
              <div className="editorial-card p-6 group">
                <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary mb-4 transition-colors group-hover:bg-primary group-hover:text-white">
                  <Map className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Request an itinerary</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  &ldquo;Create a street photography itinerary for Melbourne&rdquo;
                </p>
              </div>
              
              <div className="editorial-card p-6 group">
                <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary mb-4 transition-colors group-hover:bg-primary group-hover:text-white">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Get daily challenges</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  &ldquo;Give me a landscape photography challenge&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
