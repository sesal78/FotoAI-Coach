'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Clock,
  MapPin,
  Cloud,
  RefreshCw,
  LayoutDashboard,
  Zap,
  ClipboardPaste,
  Camera,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
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

const CHALLENGE_TYPES = [
  { value: 'WEEKEND_DEEP_DIVE', label: 'Weekend Deep Dive', emoji: '🌅', description: '2-4 hours' },
  { value: 'LUNCH_BREAK', label: 'Lunch Break', emoji: '🥪', description: '30-45 min' },
  { value: 'AFTER_WORK', label: 'After Work', emoji: '🌆', description: '1-2 hours' },
  { value: 'WFH_MICRO', label: 'WFH Micro', emoji: '🏠', description: '15-20 min' },
]

export default function ChatPage() {
  const { user, status } = useAppwriteAuth()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loadingChallenge, setLoadingChallenge] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [challengeType, setChallengeType] = useState('WEEKEND_DEEP_DIVE')
  const [pastedText, setPastedText] = useState('')
  const [activeTab, setActiveTab] = useState<'generate' | 'paste'>('generate')

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
    } catch {
      // silent
    } finally {
      setLoadingChallenge(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (status === 'authenticated') loadChallenge()
  }, [status, loadChallenge])

  async function generateChallenge() {
    if (!user?.id) return
    setGenerating(true)
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, challengeType, forceGenerate: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setChallenge(data.challenge)
        toast.success('Challenge generated and saved!')
      } else {
        toast.error(data.error || 'Failed to generate challenge')
      }
    } catch {
      toast.error('Failed to generate challenge')
    } finally {
      setGenerating(false)
    }
  }

  async function savePastedChallenge() {
    if (!user?.id || !pastedText.trim()) return
    setSaving(true)
    try {
      // Try to extract CHALLENGE_SYNC_DATA JSON block from pasted text
      let challengeData: any = null
      const jsonBlockMatch = pastedText.match(/CHALLENGE_SYNC_DATA\s*\n?\s*(\{[\s\S]*?\})/i)
      if (jsonBlockMatch) {
        try { challengeData = JSON.parse(jsonBlockMatch[1]) } catch { /* fall through */ }
      }
      // Fallback: try to parse the whole paste as JSON
      if (!challengeData) {
        try { challengeData = JSON.parse(pastedText.trim()) } catch { /* fall through */ }
      }
      // Fallback: treat as plain text challenge description
      if (!challengeData) {
        challengeData = { challengeText: pastedText.trim() }
      }

      const res = await fetch('/api/challenges/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          challengeText: challengeData.challengeText || challengeData.challenge_text || pastedText.trim(),
          category: challengeData.category || 'GENERAL',
          difficulty: challengeData.difficulty || 'INTERMEDIATE',
          duration: challengeData.duration || '1-2 hours',
          location: challengeData.location || null,
          recommendedGear: challengeData.recommendedGear || challengeData.recommended_gear || [],
          tips: challengeData.tips || null,
          weatherConditions: challengeData.weatherConditions || challengeData.weather_conditions || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPastedText('')
        await loadChallenge()
        toast.success('Challenge saved to your dashboard!')
      } else {
        toast.error(data.error || 'Failed to save challenge')
      }
    } catch {
      toast.error('Failed to save challenge')
    } finally {
      setSaving(false)
    }
  }

  const iframeSrc = `https://apps.abacus.ai/chatllm/?appId=13a86b8346&hideTopBar=2${user?.id ? `&userId=${encodeURIComponent(user.id)}` : ''}`

  return (
    <div className="min-h-screen pt-16 bg-background">
      {/* Page header */}
      <div className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <span className="overline text-background/50 mb-2 block">AI Photography Coach</span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">
            Welcome to <span className="text-primary">Foto</span> Coach
          </h1>
          <p className="text-background/70 mt-2 max-w-xl">
            Chat with your AI coach, generate personalised challenges, and track your progress.
          </p>
        </div>
      </div>

      {/* Main layout: sidebar + chatbot */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left: Challenge panel ── */}
          <aside className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">

            {/* Current challenge */}
            <div className="editorial-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold tracking-wide">Current Challenge</span>
                </div>
                {challenge && (
                  <button
                    onClick={loadChallenge}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="p-4">
                {loadingChallenge ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
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
                    <p className="text-sm leading-relaxed text-foreground">{challenge.challengeText}</p>
                    {challenge.tips && (
                      <div className="bg-accent/40 border border-accent/60 p-3 flex gap-2 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 text-accent-foreground shrink-0 mt-0.5" />
                        <span className="text-foreground leading-relaxed">{challenge.tips}</span>
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
                      <Button size="sm" className="w-full h-9 text-xs bg-foreground text-background hover:bg-primary mt-1">
                        <LayoutDashboard className="h-3 w-3 mr-1.5" />
                        Submit on Dashboard
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No active challenge.<br />Generate one below.
                  </div>
                )}
              </div>
            </div>

            {/* Generate / Save tabs */}
            {status === 'authenticated' && (
              <div className="editorial-card overflow-hidden">
                {/* Tab switcher */}
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setActiveTab('generate')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                      activeTab === 'generate'
                        ? 'text-foreground border-b-2 border-primary -mb-px'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Generate
                  </button>
                  <button
                    onClick={() => setActiveTab('paste')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                      activeTab === 'paste'
                        ? 'text-foreground border-b-2 border-primary -mb-px'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Save from Chat
                  </button>
                </div>

                {/* Generate tab */}
                {activeTab === 'generate' && (
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Generate a personalised challenge based on your profile — saved instantly to your dashboard.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {CHALLENGE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setChallengeType(t.value)}
                          className={`p-2.5 border text-left text-xs transition-colors ${
                            challengeType === t.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <div className="font-medium">{t.emoji} {t.label}</div>
                          <div className="opacity-70 mt-0.5">{t.description}</div>
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={generateChallenge}
                      disabled={generating}
                      className="w-full h-9 text-xs bg-foreground text-background hover:bg-primary"
                    >
                      {generating ? (
                        <>
                          <div className="h-3 w-3 border-2 border-background border-t-transparent rounded-full animate-spin mr-1.5" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3 mr-1.5" />
                          Generate &amp; Save
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Save from chat tab */}
                {activeTab === 'paste' && (
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Got a challenge from the AI coach? Paste the full response here and it will be saved to your dashboard with your account.
                    </p>
                    <Textarea
                      placeholder="Paste the challenge text or the CHALLENGE_SYNC_DATA block from the coach chat..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={6}
                      className="text-xs resize-none"
                    />
                    <Button
                      onClick={savePastedChallenge}
                      disabled={saving || !pastedText.trim()}
                      className="w-full h-9 text-xs bg-foreground text-background hover:bg-primary"
                    >
                      {saving ? (
                        <>
                          <div className="h-3 w-3 border-2 border-background border-t-transparent rounded-full animate-spin mr-1.5" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1.5" />
                          Save to Dashboard
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Dashboard CTA */}
            <div className="text-center py-2">
              <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                View Dashboard &amp; submit challenges →
              </Link>
            </div>
          </aside>

          {/* ── Right: Chatbot ── */}
          <div className="flex-1 min-w-0">
            <div className="editorial-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold tracking-wide">AI Coach</span>
                <span className="text-xs text-muted-foreground ml-1">— powered by Abacus.AI</span>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <iframe
                  src={iframeSrc}
                  width="100%"
                  height="680"
                  frameBorder="0"
                  title="Foto Photography Coach"
                  className="w-full border-0"
                  style={{ minHeight: '680px' }}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                  loading="lazy"
                />
              </motion.div>
            </div>

            {/* Quick prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { icon: Camera, label: 'Share your gear', prompt: 'Tell me about your camera and lenses' },
                { icon: MapPin, label: 'Request itinerary', prompt: 'Create a street photography itinerary' },
                { icon: Zap, label: 'Get a challenge', prompt: 'Give me a photography challenge' },
              ].map(({ icon: Icon, label, prompt }) => (
                <div key={label} className="editorial-card p-4 group cursor-default">
                  <Icon className="h-4 w-4 text-primary mb-2" />
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{prompt}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
