'use client'

import { useInView } from 'react-intersection-observer'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function CallToAction() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  })

  return (
    <section className="py-24 lg:py-32 bg-muted overflow-hidden" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Large decorative number */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: inView ? 0.05 : 0, scale: inView ? 1 : 0.8 }}
            transition={{ duration: 1 }}
            className="absolute -top-20 -left-10 text-[20rem] font-bold display-font text-foreground select-none pointer-events-none hidden lg:block"
          >
            →
          </motion.div>
          
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 20 }}
              transition={{ duration: 0.6 }}
              className="overline mb-4 block"
            >
              Ready to Begin?
            </motion.span>
            
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6 display-font"
            >
              Start your photography
              <br />
              journey <span className="text-primary">today</span>
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg text-muted-foreground leading-relaxed mb-10"
            >
              Get personalized coaching, daily challenges, and expert guidance 
              tailored specifically to your gear and creative goals.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                href="/chat"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-foreground text-background font-semibold tracking-wide transition-all duration-300 hover:bg-primary"
              >
                <span>Start Free Coaching</span>
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-3 px-8 py-4 border-2 border-foreground/20 text-foreground font-semibold tracking-wide transition-all duration-300 hover:border-foreground hover:bg-foreground/5"
              >
                <span>View Dashboard</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
