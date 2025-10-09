
import Link from 'next/link'
import { Camera, Mail, Github, Twitter } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-slate-700 to-slate-500">
                <Camera className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Foto</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Professional AI photography coaching platform designed to elevate your photography skills
              through personalized guidance and expert insights.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href="/"
                className="block text-slate-400 hover:text-white transition-colors duration-200"
              >
                Home
              </Link>
              <Link
                href="/chat"
                className="block text-slate-400 hover:text-white transition-colors duration-200"
              >
                Photography Coach
              </Link>
              <Link
                href="/about"
                className="block text-slate-400 hover:text-white transition-colors duration-200"
              >
                About & How It Works
              </Link>
            </div>
          </div>

          {/* Created By */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Created By</h3>
            <div className="text-slate-400 text-sm">
              <p className="mb-2">
                <span className="font-medium text-white">Seun</span>
              </p>
              <p className="leading-relaxed">
                Passionate photographer specializing in street, travel, landscape, and storytelling photography.
                Creator of the Foto AI coaching platform.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-slate-400 text-sm">
              © {currentYear} Foto Photography Coach. Created with passion for photography.
            </div>
            <div className="text-slate-400 text-sm">
              Empowering photographers worldwide
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
