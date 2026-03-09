
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useInView } from 'react-intersection-observer'
import { 
  Brain, 
  Users, 
  Zap, 
  Target, 
  MessageCircle, 
  ArrowRight,
  CheckCircle 
} from 'lucide-react'
import { motion } from 'framer-motion'

const approaches = [
  {
    icon: Brain,
    title: 'AI-Powered Intelligence',
    description: 'Advanced machine learning algorithms analyze your photography style, preferences, and equipment to provide highly personalized recommendations.',
  },
  {
    icon: Users,
    title: 'Human-Centered Design',
    description: 'Built by photographers for photographers, ensuring that every feature addresses real-world photography challenges and learning needs.',
  },
  {
    icon: Zap,
    title: 'Instant Adaptation',
    description: 'Foto learns from every interaction, continuously adapting its coaching style to match your evolving skills and preferences.',
  },
  {
    icon: Target,
    title: 'Goal-Oriented Learning',
    description: 'Whether you want to master street photography or improve landscape techniques, Foto creates structured learning paths to achieve your goals.',
  },
]

const benefits = [
  'Personalized coaching based on your specific camera equipment',
  'Custom photography itineraries for any location',
  'Daily challenges to develop technical and creative skills',
  'Instant feedback on composition and technique',
  'Learning paths for multiple photography styles',
  'Available 24/7 whenever inspiration strikes',
]

export default function CoachingApproach() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-20 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Coaching Philosophy */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            The Foto Coaching Philosophy
          </h2>
          <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Foto believes that great photography comes from understanding both the technical craft and the creative vision. 
            Our AI-powered coaching approach combines personalized technical guidance with creative inspiration, 
            helping you develop your unique photographic voice while mastering the fundamentals.
          </p>
        </motion.div>

        {/* Approach Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {approaches?.map((approach, index) => {
            const IconComponent = approach?.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="bg-muted rounded-2xl p-8 hover:bg-muted/80 transition-all duration-300 photography-card"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl mb-6">
                  {IconComponent && <IconComponent className="h-7 w-7 text-white" />}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">
                  {approach?.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {approach?.description}
                </p>
              </motion.div>
            )
          }) ?? []}
        </div>

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, white 2px, transparent 2px)`,
              backgroundSize: '40px 40px'
            }} />
          </div>

          <div className="relative z-10">
            <div className="text-center mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                What You'll Get with Foto
              </h3>
              <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                Every feature is designed to accelerate your photography learning journey 
                and help you capture the images you've always envisioned.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {benefits?.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : -20 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                  className="flex items-start space-x-3"
                >
                  <CheckCircle className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-200 leading-relaxed">{benefit}</span>
                </motion.div>
              )) ?? []}
            </div>

            {/* Final CTA */}
            <div className="text-center">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-4 text-xl font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <Link href="/chat" className="flex items-center space-x-3">
                  <MessageCircle className="h-6 w-6" />
                  <span>Experience Foto Coaching</span>
                  <ArrowRight className="h-6 w-6" />
                </Link>
              </Button>
              <p className="text-gray-400 mt-4">
                Start your personalized photography journey today
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
