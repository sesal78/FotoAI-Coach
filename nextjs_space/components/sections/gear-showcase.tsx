'use client'

import { useInView } from 'react-intersection-observer'
import Image from 'next/image'
import { motion } from 'framer-motion'

const gear = [
  {
    name: 'Fujifilm X-T5',
    type: 'Digital Mirrorless',
    description: '40MP sensor, incredible color science',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
  },
  {
    name: 'Ricoh GR IIIx',
    type: 'Compact',
    description: 'Street photography legend, 40mm equiv.',
    image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80',
  },
  {
    name: 'Nikon FE2',
    type: 'Film SLR',
    description: 'Classic mechanical reliability',
    image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?w=600&q=80',
  },
  {
    name: 'Pentax ME',
    type: 'Film SLR',
    description: 'Compact, lightweight film body',
    image: 'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=600&q=80',
  },
]

export default function GearShowcase() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 lg:py-32 bg-foreground text-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 mb-16 lg:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
            transition={{ duration: 0.8 }}
          >
            <span className="overline text-background/50 mb-4 block">Your Gear</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight display-font">
              Coaching tailored to
              <br />
              <span className="text-primary">your equipment</span>
            </h2>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex items-end"
          >
            <p className="text-lg text-background/60 leading-relaxed">
              Every piece of advice, challenge, and itinerary is customized 
              for the specific capabilities of your camera bodies and lenses.
            </p>
          </motion.div>
        </div>

        {/* Gear Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {gear?.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 40 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="group"
            >
              {/* Image */}
              <div className="relative aspect-[4/5] mb-5 overflow-hidden bg-background/10">
                <Image
                  src={item?.image}
                  alt={item?.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
                
                {/* Type Badge */}
                <div className="absolute top-4 left-4">
                  <span className="inline-block px-3 py-1 bg-background/90 text-foreground text-xs font-semibold tracking-wide">
                    {item?.type}
                  </span>
                </div>
              </div>
              
              {/* Content */}
              <h3 className="text-xl font-semibold text-background mb-1 display-font group-hover:text-primary transition-colors">
                {item?.name}
              </h3>
              <p className="text-background/50 text-sm">
                {item?.description}
              </p>
            </motion.div>
          )) ?? []}
        </div>
      </div>
    </section>
  )
}
