import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { QueryProvider } from '@/components/query-provider'
import { Toaster } from 'sonner'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'

export const metadata: Metadata = {
  title: 'Foto — AI Photography Coach',
  description: 'Professional AI photography coaching platform by Seun. Get personalized photography itineraries, daily challenges, and expert guidance for street, travel, landscape, and storytelling photography.',
  keywords: 'photography coach, AI photography, photography training, street photography, landscape photography, travel photography, Fujifilm, Ricoh, Nikon, Pentax',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              {/* Subtle grain texture overlay */}
              <div className="grain-overlay" aria-hidden="true" />

              <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster
                position="bottom-right"
                theme="system"
                toastOptions={{
                  style: {
                    fontFamily: 'DM Sans, sans-serif',
                  }
                }}
              />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
