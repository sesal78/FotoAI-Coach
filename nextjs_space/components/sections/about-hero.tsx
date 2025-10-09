
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Camera, Award, Users, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

export default function AboutHero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, white 2px, transparent 2px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
              <Camera className="h-8 w-8 text-white" />
            </div>
            <span className="text-3xl font-bold">Foto</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            About Foto
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent block">
              AI Photography Coach
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl mb-8 text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Foto revolutionizes photography learning by combining advanced AI technology with deep expertise 
            in street, travel, landscape, and storytelling photography. Created by passionate photographer Seun, 
            Foto delivers personalized coaching that adapts to your unique style and goals.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <Award className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">AI-Powered</div>
            <div className="text-gray-400">Advanced coaching technology</div>
          </div>
          <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <Users className="h-12 w-12 text-purple-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">Personalized</div>
            <div className="text-gray-400">Tailored to your gear & style</div>
          </div>
          <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <Zap className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">24/7</div>
            <div className="text-gray-400">Always available coaching</div>
          </div>
          <div className="text-center bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <Camera className="h-12 w-12 text-orange-400 mx-auto mb-4" />
            <div className="text-3xl font-bold text-white mb-2">Multi-Style</div>
            <div className="text-gray-400">Street, travel, landscape & more</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
