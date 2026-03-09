
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useInView } from 'react-intersection-observer'
import { Camera, MapPin, Award, Heart } from 'lucide-react'
import { motion } from 'framer-motion'

const achievements = [
  {
    icon: Camera,
    title: '10+ Years Experience',
    description: 'Professional photography expertise across multiple genres and styles',
  },
  {
    icon: MapPin,
    title: 'Global Perspective',
    description: 'Extensive travel and street photography experience worldwide',
  },
  {
    icon: Award,
    title: 'Technical Mastery',
    description: 'Expert knowledge of both digital and film photography techniques',
  },
  {
    icon: Heart,
    title: 'Passionate Teacher',
    description: 'Dedicated to helping fellow photographers reach their creative potential',
  },
]

export default function SeunProfile() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-20 bg-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Profile Image */}
          <motion.div
            ref={ref}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : -30 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-square max-w-lg mx-auto bg-muted/60 rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="https://cdn.abacus.ai/images/19b74211-58c9-42c0-a465-b5ef550b40a0.png"
                alt="Seun - Professional Photographer and Foto Creator"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          </motion.div>

          {/* Profile Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Meet Seun
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
                  Photography Expert & Foto Creator
                </span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Seun is a passionate photographer with over a decade of experience in street, travel, 
                landscape, and storytelling photography. With expertise in both digital and film photography, 
                Seun has traveled the world capturing authentic moments and teaching others the art of visual storytelling.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                As the creator of Foto, Seun combines extensive photography knowledge with cutting-edge AI technology 
                to provide personalized coaching that adapts to each photographer's unique journey and equipment setup.
              </p>
            </div>

            {/* Equipment Expertise */}
            <div className="bg-background rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-4">Equipment Expertise</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="font-medium text-foreground/80">Digital Cameras</div>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Fujifilm X-T5</li>
                    <li>• Ricoh GR IIIx</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-foreground/80">Film Cameras</div>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Nikon FE2</li>
                    <li>• Pentax ME</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16"
        >
          <h3 className="text-2xl font-bold text-foreground mb-8 text-center">
            What Makes Seun's Approach Unique
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements?.map((achievement, index) => {
              const IconComponent = achievement?.icon
              return (
                <div
                  key={index}
                  className="text-center bg-background rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 photography-card"
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl mb-4 mx-auto">
                    {IconComponent && <IconComponent className="h-6 w-6 text-white" />}
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">
                    {achievement?.title}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {achievement?.description}
                  </p>
                </div>
              )
            }) ?? []}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
