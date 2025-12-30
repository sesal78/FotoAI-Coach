'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Aperture, Calendar, Target } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-[100svh] flex items-center overflow-hidden">
      {/* Background Image with Editorial Overlay */}
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

      {/* Content Container */}
      <div className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Main Content - Left/Center */}
            <div className="lg:col-span-8 text-white">
              {/* Overline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mb-6"
              >
                <span className="overline text-white/70">AI-Powered Photography Coaching</span>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6 display-font"
              >
                Master Your
                <br />
                <span className="text-primary">Craft</span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-lg sm:text-xl text-white/80 max-w-xl mb-10 leading-relaxed"
              >
                Personalized itineraries, daily challenges, and expert guidance 
                tailored to your gear and creative vision.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link
                  href="/chat"
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-semibold tracking-wide transition-all duration-300 hover:bg-primary/90"
                >
                  <span>Start Coaching</span>
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 border-2 border-white/30 text-white font-semibold tracking-wide transition-all duration-300 hover:border-white hover:bg-white/10"
                >
                  <span>How It Works</span>
                </Link>
              </motion.div>
            </div>

            {/* Feature Pills - Right Side (Desktop) */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 40 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="lg:col-span-4 hidden lg:flex flex-col gap-4"
            >
              <FeaturePill 
                icon={Aperture} 
                title="Gear-Specific" 
                description="Tailored to your Fujifilm, Ricoh, Nikon & Pentax"
              />
              <FeaturePill 
                icon={Calendar} 
                title="Custom Itineraries" 
                description="Location-based photo walk planning"
              />
              <FeaturePill 
                icon={Target} 
                title="Daily Challenges" 
                description="Push your creative boundaries"
              />
            </motion.div>
          </div>

          {/* Mobile Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="lg:hidden mt-12 flex flex-wrap gap-3"
          >
            <div className="glass-effect px-4 py-2 text-white text-sm font-medium flex items-center gap-2">
              <Aperture className="h-4 w-4" />
              <span>Gear-Specific</span>
            </div>
            <div className="glass-effect px-4 py-2 text-white text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Itineraries</span>
            </div>
            <div className="glass-effect px-4 py-2 text-white text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>Challenges</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
      >
        <div className="flex flex-col items-center gap-2 text-white/50">
          <span className="text-xs font-medium tracking-widest uppercase">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </motion.div>
    </section>
  )
}

function FeaturePill({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="glass-effect p-5 transition-all duration-300 hover:bg-white/15">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-primary/20 rounded">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-white font-semibold mb-1">{title}</h3>
          <p className="text-white/60 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}
