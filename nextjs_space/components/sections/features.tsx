
'use client'

import { useState, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { Camera, Map, Target, BookOpen, Users, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Map,
    title: 'Personalized Itineraries',
    description: 'Get custom photography itineraries tailored to your location, gear, and interests. Never miss a perfect shot opportunity.',
  },
  {
    icon: Target,
    title: 'Daily Challenges',
    description: 'Receive daily shooting challenges designed to push your creative boundaries and develop specific skills.',
  },
  {
    icon: Camera,
    title: 'Gear-Specific Guidance',
    description: 'Expert advice tailored to your specific cameras: Fujifilm X-T5, Ricoh GR IIIx, Nikon FE2, and Pentax ME.',
  },
  {
    icon: BookOpen,
    title: 'Style Development',
    description: 'Master street, travel, landscape, and storytelling photography with specialized coaching for each style.',
  },
  {
    icon: Zap,
    title: 'Instant Feedback',
    description: 'Get immediate, actionable feedback on your photography techniques and creative decisions.',
  },
  {
    icon: Users,
    title: 'Community Learning',
    description: 'Connect with other photographers and learn from shared experiences and challenges.',
  },
]

export default function Features() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Why Choose Foto?
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Foto combines advanced AI technology with deep photography expertise to provide 
            personalized coaching that adapts to your unique style and goals.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features?.map((feature, index) => {
            const IconComponent = feature?.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="bg-slate-50 rounded-2xl p-8 hover:bg-slate-100 transition-all duration-300 photography-card group"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-slate-900 to-slate-700 rounded-xl mb-4 group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
                  {IconComponent && <IconComponent className="h-6 w-6 text-white" />}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {feature?.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature?.description}
                </p>
              </motion.div>
            )
          }) ?? []}
        </div>
      </div>
    </section>
  )
}
