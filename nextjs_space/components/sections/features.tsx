'use client'

import { useInView } from 'react-intersection-observer'
import { Map, Target, Camera, BookOpen, Zap, Users, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

const features = [
  {
    icon: Map,
    number: '01',
    title: 'Personalized Itineraries',
    description: 'Custom photography itineraries tailored to your location, gear, and interests. Never miss a perfect shot.',
  },
  {
    icon: Target,
    number: '02',
    title: 'Daily Challenges',
    description: 'Receive shooting challenges designed to push your creative boundaries and develop specific skills.',
  },
  {
    icon: Camera,
    number: '03',
    title: 'Gear-Specific Guidance',
    description: 'Expert advice for Fujifilm X-T5, Ricoh GR IIIx, Nikon FE2, and Pentax ME — your exact gear.',
  },
  {
    icon: BookOpen,
    number: '04',
    title: 'Style Development',
    description: 'Master street, travel, landscape, and storytelling photography with specialized coaching.',
  },
  {
    icon: Zap,
    number: '05',
    title: 'Instant Feedback',
    description: 'Get immediate, actionable feedback on your techniques and creative decisions.',
  },
  {
    icon: Users,
    number: '06',
    title: 'Community Learning',
    description: 'Connect with photographers and learn from shared experiences and challenges.',
  },
]

export default function Features() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 lg:py-32 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16 lg:mb-24" ref={ref}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 20 }}
            transition={{ duration: 0.6 }}
          >
            <span className="overline mb-4 block">Why Foto</span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6 display-font"
          >
            Everything you need to
            <br />
            <span className="text-primary">elevate your photography</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Combining advanced AI with deep photography expertise to provide 
            personalized coaching that adapts to your unique style.
          </motion.p>
        </div>

        {/* Features Grid - Asymmetric */}
        <div className="feature-asymmetric">
          {features?.map((feature, index) => {
            const IconComponent = feature?.icon
            const isEven = index % 2 === 1
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40, x: isEven ? 20 : -20 }}
                animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 40, x: inView ? 0 : (isEven ? 20 : -20) }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="editorial-card p-8 lg:p-10 group"
              >
                <div className="flex items-start gap-6">
                  {/* Number */}
                  <span className="text-5xl lg:text-6xl font-light text-border/80 display-font select-none">
                    {feature?.number}
                  </span>
                  
                  <div className="flex-1">
                    {/* Icon */}
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary mb-4 transition-all duration-300 group-hover:bg-primary group-hover:text-white">
                      {IconComponent && <IconComponent className="h-6 w-6" />}
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl lg:text-2xl font-semibold text-foreground mb-3 display-font">
                      {feature?.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature?.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          }) ?? []}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 lg:mt-24 text-center"
        >
          <Link
            href="/chat"
            className="group inline-flex items-center gap-3 text-foreground font-semibold hover:text-primary transition-colors"
          >
            <span className="text-lg">Start your coaching journey</span>
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
