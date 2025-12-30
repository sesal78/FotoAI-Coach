'use client'

import { useInView } from 'react-intersection-observer'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const styles = [
  {
    name: 'Street',
    description: 'Capture candid moments and urban stories',
    image: 'https://images.unsplash.com/photo-1476973422084-e0fa66ff9456?w=800&q=80',
  },
  {
    name: 'Landscape',
    description: 'Master natural light and vast compositions',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  },
  {
    name: 'Travel',
    description: 'Document adventures and cultural narratives',
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
  },
  {
    name: 'Storytelling',
    description: 'Weave visual narratives that resonate',
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80',
  },
]

export default function PhotographyStyles() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 lg:py-32 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        {/* Header */}
        <div className="max-w-3xl mb-16 lg:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 20 }}
            transition={{ duration: 0.6 }}
          >
            <span className="overline mb-4 block">Photography Styles</span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6 display-font"
          >
            Develop your
            <br />
            <span className="text-primary">unique vision</span>
          </motion.h2>
        </div>

        {/* Styles Grid - Asymmetric Masonry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {styles?.map((style, index) => {
            const isLarge = index === 0 || index === 3
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 40 }}
                transition={{ duration: 0.8, delay: index * 0.15 }}
                className={`group relative overflow-hidden ${
                  isLarge ? 'md:row-span-2' : ''
                }`}
              >
                <Link href="/chat" className="block">
                  {/* Image */}
                  <div className={`relative overflow-hidden bg-muted ${
                    isLarge ? 'aspect-[3/4]' : 'aspect-[16/10]'
                  }`}>
                    <Image
                      src={style?.image}
                      alt={style?.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                    
                    {/* Content Overlay */}
                    <div className="absolute inset-0 p-6 lg:p-8 flex flex-col justify-end">
                      <div className="flex items-end justify-between">
                        <div>
                          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2 display-font">
                            {style?.name}
                          </h3>
                          <p className="text-white/70 max-w-xs">
                            {style?.description}
                          </p>
                        </div>
                        
                        {/* Arrow */}
                        <div className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm transition-all duration-300 group-hover:bg-primary">
                          <ArrowUpRight className="h-5 w-5 text-white transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          }) ?? []}
        </div>
      </div>
    </section>
  )
}
