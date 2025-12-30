import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-5">
              <Link href="/" className="inline-block mb-6">
                <span className="text-4xl lg:text-5xl font-bold tracking-tight display-font">
                  Foto
                </span>
              </Link>
              <p className="text-background/60 text-lg leading-relaxed max-w-md mb-8">
                Professional AI photography coaching designed to elevate your skills 
                through personalized guidance and expert insights.
              </p>
              <Link
                href="/chat"
                className="group inline-flex items-center gap-2 text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                <span>Start Coaching</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            {/* Navigation */}
            <div className="lg:col-span-3 lg:col-start-7">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-background/40 mb-6">
                Navigate
              </h3>
              <nav className="space-y-4">
                <Link
                  href="/"
                  className="block text-background/70 hover:text-background transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/dashboard"
                  className="block text-background/70 hover:text-background transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/chat"
                  className="block text-background/70 hover:text-background transition-colors"
                >
                  Coach
                </Link>
                <Link
                  href="/locations"
                  className="block text-background/70 hover:text-background transition-colors"
                >
                  Locations
                </Link>
                <Link
                  href="/about"
                  className="block text-background/70 hover:text-background transition-colors"
                >
                  About
                </Link>
              </nav>
            </div>

            {/* Created By */}
            <div className="lg:col-span-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-background/40 mb-6">
                Created By
              </h3>
              <div>
                <p className="text-xl font-semibold text-background mb-2 display-font">Seun</p>
                <p className="text-background/60 leading-relaxed">
                  Photographer specializing in street, travel, landscape, and storytelling. 
                  Melbourne-based creative.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-background/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-background/40 text-sm">
              © {currentYear} Foto. All rights reserved.
            </p>
            <p className="text-background/40 text-sm">
              Melbourne, Australia
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
