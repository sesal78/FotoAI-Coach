
import { Metadata } from 'next'
import AboutHero from '@/components/sections/about-hero'
import HowItWorks from '@/components/sections/how-it-works'
import SeunProfile from '@/components/sections/seun-profile'
import CoachingApproach from '@/components/sections/coaching-approach'

export const metadata: Metadata = {
  title: 'About - Foto AI Photography Coach',
  description: 'Learn about Foto AI photography coaching platform, how it works, and meet Seun - the passionate photographer behind the innovative coaching approach.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-16">
      <AboutHero />
      <HowItWorks />
      <SeunProfile />
      <CoachingApproach />
    </div>
  )
}
