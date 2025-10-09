
'use client'

import { useState, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { MessageCircle, Camera, Map, Target, Award, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'

const steps = [
  {
    number: '01',
    icon: MessageCircle,
    title: 'Start Chatting',
    description: 'Begin a conversation with Foto by sharing your photography interests, equipment, and goals. No setup required – just start talking!',
  },
  {
    number: '02',
    icon: Camera,
    title: 'Share Your Gear',
    description: 'Tell Foto about your camera equipment. Whether you have a Fujifilm X-T5, Ricoh GR IIIx, Nikon FE2, or Pentax ME, get tailored advice.',
  },
  {
    number: '03',
    icon: Map,
    title: 'Get Custom Itineraries',
    description: 'Receive personalized photography itineraries based on your location, interests, and available time. Every suggestion is crafted for you.',
  },
  {
    number: '04',
    icon: Target,
    title: 'Take on Challenges',
    description: 'Participate in daily photography challenges designed to push your creative boundaries and develop specific technical skills.',
  },
  {
    number: '05',
    icon: Lightbulb,
    title: 'Learn & Improve',
    description: 'Get instant feedback on your techniques, composition, and creative decisions. Learn from each shot and continuously improve.',
  },
  {
    number: '06',
    icon: Award,
    title: 'Master Your Style',
    description: 'Develop your unique photography voice across street, travel, landscape, and storytelling photography with ongoing guidance.',
  },
]

export default function HowItWorks() {
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
            How Foto Works
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Foto's AI-powered coaching process is designed to be intuitive and effective. 
            Here's how you can start improving your photography skills today.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps?.map((step, index) => {
            const IconComponent = step?.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="relative"
              >
                {/* Step Number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {step?.number}
                </div>

                <div className="bg-slate-50 rounded-2xl p-8 h-full hover:bg-slate-100 transition-all duration-300 photography-card">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl mb-6">
                    {IconComponent && <IconComponent className="h-8 w-8 text-white" />}
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    {step?.title}
                  </h3>
                  
                  <p className="text-slate-600 leading-relaxed">
                    {step?.description}
                  </p>
                </div>
              </motion.div>
            )
          }) ?? []}
        </div>
      </div>
    </section>
  )
}
