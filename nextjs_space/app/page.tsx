
import Hero from '@/components/sections/hero'
import Features from '@/components/sections/features'
import GearShowcase from '@/components/sections/gear-showcase'
import PhotographyStyles from '@/components/sections/photography-styles'
import CallToAction from '@/components/sections/call-to-action'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Features />
      <GearShowcase />
      <PhotographyStyles />
      <CallToAction />
    </div>
  )
}
