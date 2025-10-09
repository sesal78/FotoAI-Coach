
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Camera, MessageCircle, Calendar, Target, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full">
          <Image
            src="https://lickd.co/wp-content/uploads/2023/09/best-DSLR-cameras-for-YouTube.jpeg"
            alt="Professional photography equipment"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm">
              <Camera className="h-8 w-8 text-white" />
            </div>
            <span className="text-3xl font-bold">Foto</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Your Personal
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent block">
              AI Photography Coach
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto leading-relaxed">
            Get personalized photography itineraries, daily challenges, and expert guidance tailored 
            to your gear, style, and creative vision.
          </p>

          {/* Feature Highlights */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            <div className="flex items-center space-x-2 glass-effect rounded-full px-4 py-2">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Personalized Coaching</span>
            </div>
            <div className="flex items-center space-x-2 glass-effect rounded-full px-4 py-2">
              <Calendar className="h-5 w-5" />
              <span className="text-sm font-medium">Custom Itineraries</span>
            </div>
            <div className="flex items-center space-x-2 glass-effect rounded-full px-4 py-2">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Daily Challenges</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300"
            >
              <Link href="/chat" className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5" />
                <span>Start Coaching Now</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-2 border-white text-white hover:bg-white hover:text-slate-900 px-8 py-3 text-lg font-semibold backdrop-blur-sm"
            >
              <Link href="/about">Learn How It Works</Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
      >
        <div className="animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
