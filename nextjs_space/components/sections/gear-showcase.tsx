
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useInView } from 'react-intersection-observer'
import { Camera, Aperture, Timer, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

const cameras = [
  {
    name: 'Fujifilm X-T5',
    type: 'Mirrorless Digital',
    image: 'https://www.popphoto.com/uploads/2022/02/06/fujifilm-x-t5-camera-front.jpg?auto=webp',
    features: ['40.2MP APS-C Sensor', 'Film Simulation Modes', '7 FPS Burst'],
    description: 'Professional mirrorless camera perfect for street and travel photography with exceptional image quality.',
  },
  {
    name: 'Ricoh GR IIIx',
    type: 'Compact Digital',
    image: 'https://us.ricoh-imaging.com/wp-content/uploads/2024/03/grIIIx-hdf1.png',
    features: ['24.2MP APS-C Sensor', '40mm Equivalent Lens', 'Ultra Portable'],
    description: 'The ultimate street photography companion with outstanding image quality in a pocket-sized form.',
  },
  {
    name: 'Nikon FE2',
    type: '35mm Film Camera',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/NikonFE2blkfrt50f14.jpg/1200px-NikonFE2blkfrt50f14.jpg',
    features: ['1/4000s Shutter Speed', 'Titanium Shutter', 'Manual Focus'],
    description: 'Classic 35mm SLR camera beloved by photographers for its reliability and exceptional build quality.',
  },
  {
    name: 'Pentax ME',
    type: '35mm Film Camera',
    image: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Pentax_ME_M50mm.jpg',
    features: ['Compact SLR Design', 'Aperture Priority', 'K-Mount Lenses'],
    description: 'Vintage compact SLR camera known for its precision engineering and beautiful color rendition.',
  },
]

export default function GearShowcase() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Gear-Specific Coaching
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Foto provides expert guidance tailored specifically to your camera equipment, 
            helping you maximize the potential of every piece of gear in your kit.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cameras?.map((camera, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 photography-card"
            >
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="relative aspect-[4/3] w-full lg:w-48 flex-shrink-0">
                  <div className="relative w-full h-full bg-slate-100 rounded-xl overflow-hidden">
                    <Image
                      src={camera?.image ?? ''}
                      alt={camera?.name ?? ''}
                      fill
                      className="object-contain p-4"
                    />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Camera className="h-5 w-5 text-slate-600" />
                    <span className="text-sm font-medium text-slate-600">
                      {camera?.type}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    {camera?.name}
                  </h3>
                  
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    {camera?.description}
                  </p>
                  
                  <div className="space-y-2">
                    {camera?.features?.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center space-x-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </div>
                    )) ?? []}
                  </div>
                </div>
              </div>
            </motion.div>
          )) ?? []}
        </div>
      </div>
    </section>
  )
}
