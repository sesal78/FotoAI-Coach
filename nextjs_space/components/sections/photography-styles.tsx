
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useInView } from 'react-intersection-observer'
import { MapPin, Building, Mountain, Heart } from 'lucide-react'
import { motion } from 'framer-motion'

const styles = [
  {
    title: 'Street Photography',
    icon: Building,
    image: 'https://images.unsplash.com/photo-1753755858061-a56378b78107?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: 'Capture authentic moments and urban life with expert techniques for candid street photography.',
  },
  {
    title: 'Travel Photography',
    icon: MapPin,
    image: 'https://www.travelandleisure.com/thmb/YhlLO01i9ZVBivhoa61fRc6eTxg=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/torres-del-paine-national-park-chile-MOSTBEAUTIFUL0921-4dfe4d2e67aa4f28ace7cf7cd21f4c8c.jpg',
    description: 'Document your journeys with compelling travel photography that tells stories and captures destinations.',
  },
  {
    title: 'Landscape Photography',
    icon: Mountain,
    image: 'https://i0.wp.com/digital-photography-school.com/wp-content/uploads/2023/11/wide-angle-landscape-photography-11.jpg?resize=1500%2C999&ssl=1',
    description: 'Master the art of landscape photography with composition, lighting, and technical expertise.',
  },
  {
    title: 'Storytelling Photography',
    icon: Heart,
    image: 'https://static.vecteezy.com/system/resources/previews/067/763/170/non_2x/creative-macro-closeup-of-camera-lens-with-abstract-reflections-and-textures-artisticgraphy-detail-modern-tech-concept-vibrant-colors-and-sharp-focus-for-design-inspiration-photo.jpg',
    description: 'Learn to create powerful narratives through photography that connects with viewers emotionally.',
  },
]

export default function PhotographyStyles() {
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
            Master Every Photography Style
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            From urban streets to majestic landscapes, Foto provides specialized coaching 
            for each photography style you're passionate about exploring.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {styles?.map((style, index) => {
            const IconComponent = style?.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 photography-card"
              >
                <div className="relative aspect-video w-full">
                  <Image
                    src={style?.image ?? ''}
                    alt={style?.title ?? ''}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                      {IconComponent && <IconComponent className="h-5 w-5" />}
                    </div>
                    <h3 className="text-xl font-bold">{style?.title}</h3>
                  </div>
                  <p className="text-gray-200 text-sm leading-relaxed">
                    {style?.description}
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
