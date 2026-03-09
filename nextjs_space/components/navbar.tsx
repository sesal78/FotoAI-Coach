'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Menu, X, ArrowUpRight, LogOut, LayoutDashboard, MessageSquare, MapPin, TrendingUp, Settings, ChevronDown, Sun, Moon, Eye, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/critique', label: 'Critique' },
  { href: '/recreate', label: 'Recreate' },
  { href: '/chat', label: 'Coach' },
  { href: '/locations', label: 'Locations' },
  { href: '/about', label: 'About' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, status, signOut } = useAppwriteAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window?.scrollY > 10)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  async function handleSignOut() {
    await signOut()
    // Use hard navigation to avoid RSC payload fetch errors during session teardown
    window.location.href = '/'
  }

  const isAuthenticated = status === 'authenticated'
  const firstName = user?.name?.split(' ')[0] ?? ''

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-background/95 backdrop-blur-md border-b border-border'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/" className="group relative">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight display-font">
                Foto
              </span>
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems?.map((item) => (
                <Link
                  key={item?.href}
                  href={item?.href ?? '/'}
                  className={`relative px-4 py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${
                    pathname === item?.href
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item?.label}
                  {pathname === item?.href && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              )) ?? []}

              {/* Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className="ml-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              )}

              {/* Auth controls */}
              {status === 'loading' ? (
                <div className="ml-4 h-9 w-9 rounded-full bg-muted animate-pulse" />
              ) : isAuthenticated ? (
                <div className="ml-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden xl:block text-sm font-medium text-foreground">{firstName}</span>
                        <ChevronDown className="hidden xl:block h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-foreground">{user?.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/chat" className="flex items-center gap-2 cursor-pointer">
                          <MessageSquare className="h-4 w-4" />
                          Coach
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/locations" className="flex items-center gap-2 cursor-pointer">
                          <MapPin className="h-4 w-4" />
                          Locations
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/critique" className="flex items-center gap-2 cursor-pointer">
                          <Eye className="h-4 w-4" />
                          Photo Critique
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/recreate" className="flex items-center gap-2 cursor-pointer">
                          <Lightbulb className="h-4 w-4" />
                          Recreate This
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/progress" className="flex items-center gap-2 cursor-pointer">
                          <TrendingUp className="h-4 w-4" />
                          My Progress
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="ml-4 flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="group flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-semibold tracking-wide transition-all duration-300 hover:bg-primary"
                  >
                    <span>Get started</span>
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 -mr-2 text-foreground hover:text-primary transition-colors"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border shadow-2xl"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <span className="text-2xl font-bold tracking-tight display-font">Menu</span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto py-6">
                  {navItems?.map((item, index) => (
                    <motion.div
                      key={item?.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={item?.href ?? '/'}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-6 py-4 text-lg font-medium transition-colors duration-200 ${
                          pathname === item?.href
                            ? 'text-foreground bg-muted'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span>{item?.label}</span>
                        {pathname === item?.href && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </Link>
                    </motion.div>
                  )) ?? []}
                </div>

                {/* Auth CTA */}
                <div className="p-6 border-t border-border space-y-3">
                  {/* Theme toggle (mobile) */}
                  {mounted && (
                    <button
                      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                      className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-sm mb-2"
                    >
                      {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </button>
                  )}
                  {isAuthenticated ? (
                    <>
                      {/* User info */}
                      <div className="flex items-center gap-3 px-2 py-2 mb-1">
                        <Avatar className="h-10 w-10 border border-border shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </div>
                      {/* Quick links */}
                      {[
                        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                        { href: '/critique', icon: Eye, label: 'Photo Critique' },
                        { href: '/recreate', icon: Lightbulb, label: 'Recreate This' },
                        { href: '/progress', icon: TrendingUp, label: 'My Progress' },
                        { href: '/settings', icon: Settings, label: 'Settings' },
                      ].map(({ href, icon: Icon, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-sm"
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Link>
                      ))}
                      <button
                        onClick={() => { setIsOpen(false); handleSignOut(); }}
                        className="flex items-center justify-center gap-2 w-full py-3.5 border border-border text-destructive text-base font-medium tracking-wide transition-all duration-300 hover:bg-destructive/5 mt-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center w-full py-3.5 border border-border text-foreground text-base font-medium tracking-wide transition-all duration-300 hover:bg-muted"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/signup"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 w-full py-4 bg-foreground text-background text-base font-semibold tracking-wide transition-all duration-300 hover:bg-primary"
                      >
                        <span>Get started</span>
                        <ArrowUpRight className="h-5 w-5" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
