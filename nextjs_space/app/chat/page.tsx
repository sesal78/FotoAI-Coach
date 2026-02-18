'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Clock,
  MapPin,
  Cloud,
  RefreshCw,
  LayoutDashboard,
  Camera,
  MessageSquare,
  AlertCircle,
  Send,
  Aperture,
  Map,
  Target,
} from 'lucide-react'

interface Challenge {
  id: string
  challengeText: string
  category: string
  difficulty: string
  duration: string
  tips?: string
  recommendedGear: string[]
  weatherConditions?: string
  location?: string
  status: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_PROMPTS = [
  { icon: Aperture, text: 'Give me a street photography challenge for today' },
  { icon: Map, text: 'Create a photo tour itinerary for Melbourne CBD' },
  { icon: Target, text: 'I have a Fujifilm X-T5 — what should I practise?' },
]

export default function ChatPage() {
  const { user, status } = useAppwriteAuth()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loadingChallenge, setLoadingChallenge] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadChallenge = useCallback(async () => {
    if (!user?.id) return
    setLoadingChallenge(true)
    try {
      const res = await fetch(
        `/api/challenges?userId=${user.id}&status=pending&limit=1`,
        { cache: 'no-store' }
      )
      if (!res.ok) return
      const data = await res.json()
      setChallenge(data.challenges?.[0] ?? null)
    } catch { /* silent */ } finally {
      setLoadingChallenge(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (status === 'authenticated') loadChallenge()
  }, [status, loadChallenge])

  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || sending) return

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    // Add a temporary loading message
    setMessages([...newMessages, { role: 'assistant', content: '...' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()

      if (!res.ok) {
        const errMsg = data?.error || 'Sorry, something went wrong. Please try again.'
        setMessages([...newMessages, { role: 'assistant', content: errMsg }])
        return
      }

      setMessages([...newMessages, { role: 'assistant', content: data.message }])

      // If a challenge was auto-saved, update the panel
      if (data.challenge) {
        setChallenge(data.challenge)
        toast.success('Challenge saved to your dashboard!', {
          description: 'Head to Dashboard to submit it when you\'re done.',
          action: { label: 'Dashboard', onClick: () => window.location.href = '/dashboard' },
        })
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen pt-16 bg-background">
      {/* Header */}
      <div className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <span className="overline text-background/50 mb-2 block">AI Photography Coach</span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">
            Welcome to <span className="text-primary">Foto</span> Coach
          </h1>
          <p className="text-background/70 mt-2 max-w-xl text-sm">
            Chat with your AI coach for personalised challenges, itineraries, and technique advice.
            Challenges are saved to your dashboard automatically.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left: Challenge panel ── */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4">
            <div className="editorial-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold tracking-wide">Active Challenge</span>
                </div>
                {challenge && (
                  <button onClick={loadChallenge} title="Refresh" className="text-muted-foreground hover:text-foreground">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="p-4">
                {loadingChallenge ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                ) : challenge ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className="bg-primary text-white text-xs">{challenge.category}</Badge>
                      <Badge variant="secondary" className="text-xs">{challenge.difficulty}</Badge>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />{challenge.duration}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed">{challenge.challengeText}</p>
                    {challenge.tips && (
                      <div className="bg-accent/40 border border-accent/60 p-2.5 flex gap-2 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 text-accent-foreground shrink-0 mt-0.5" />
                        <span>{challenge.tips}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {challenge.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{challenge.location}
                        </span>
                      )}
                      {challenge.weatherConditions && (
                        <span className="flex items-center gap-1">
                          <Cloud className="h-3 w-3" />{challenge.weatherConditions}
                        </span>
                      )}
                    </div>
                    <Link href="/dashboard">
                      <Button size="sm" className="w-full h-8 text-xs bg-foreground text-background hover:bg-primary">
                        <LayoutDashboard className="h-3 w-3 mr-1.5" />
                        Submit on Dashboard
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    <Camera className="h-7 w-7 mx-auto mb-2 opacity-25" />
                    <p>No active challenge.</p>
                    <p className="text-xs mt-1">Ask the coach to generate one!</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center">
              <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                View Dashboard &amp; submit →
              </Link>
            </div>
          </aside>

          {/* ── Right: Custom chat ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="editorial-card overflow-hidden flex flex-col" style={{ height: '680px' }}>
              {/* Chat header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Foto AI Coach</span>
                <span className="ml-auto text-xs text-muted-foreground">challenges auto-save ✓</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-8">
                    <div>
                      <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">Your AI Photography Coach</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Ask for a challenge, itinerary, or technique advice. Challenges are saved to your dashboard automatically.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-lg">
                      {SUGGESTED_PROMPTS.map(({ icon: Icon, text }) => (
                        <button
                          key={text}
                          onClick={() => sendMessage(text)}
                          className="text-left p-3 border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-xs text-muted-foreground group"
                        >
                          <Icon className="h-3.5 w-3.5 text-primary mb-1.5 group-hover:text-primary" />
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-foreground border border-border'
                        }`}
                      >
                        {msg.content === '...' ? (
                          <span className="flex gap-1 items-center text-muted-foreground">
                            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                          </span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask for a challenge, itinerary, or technique tip… (Enter to send)"
                    rows={1}
                    className="flex-1 resize-none min-h-[40px] max-h-32 text-sm py-2.5"
                    disabled={sending}
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={sending || !input.trim()}
                    size="sm"
                    className="h-10 w-10 p-0 bg-foreground text-background hover:bg-primary shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  Shift+Enter for new line · Enter to send
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
