'use client'

import ChatInterface from '@/components/sections/chat-interface'
import { useEffect, useState, useCallback } from 'react'
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Clock,
  MapPin,
  Cloud,
  RefreshCw,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  Zap,
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
  { value: 'WEEKEND_DEEP_DIVE', label: 'Weekend Deep Dive', emoji: '🌅' },
  { value: 'LUNCH_BREAK', label: 'Lunch Break', emoji: '🥪' },
  { value: 'AFTER_WORK', label: 'After Work', emoji: '🌆' },
  { value: 'WFH_MICRO', label: 'WFH Micro', emoji: '🏠' },
]

export default function ChatPage() {
  const { user, status } = useAppwriteAuth()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loadingChallenge, setLoadingChallenge] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [challengeType, setChallengeType] = useState('WEEKEND_DEEP_DIVE')
  const [panelExpanded, setPanelExpanded] = useState(true)

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
      // silent — panel just shows empty state
    } finally {
      setLoadingChallenge(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (status === 'authenticated') {
      loadChallenge()
    }
  }, [status, loadChallenge])

  async function generateChallenge() {
    if (!user?.id) return
    setGenerating(true)
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          challengeType,
          forceGenerate: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setChallenge(data.challenge)
        setPanelExpanded(true)
        toast.success('Challenge generated and saved to your dashboard!')
      } else {
        toast.error(data.error || 'Failed to generate challenge')
      }
    } catch {
      toast.error('Failed to generate challenge')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Challenge Panel */}
      {status === 'authenticated' && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Panel header — always visible */}
            <div
              className="flex items-center justify-between py-3 cursor-pointer select-none"
              onClick={() => setPanelExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold tracking-wide">
                  {challenge ? 'Active Challenge' : 'No Active Challenge'}
                </span>
                {challenge && (
                  <Badge variant="secondary" className="text-xs">
                    {challenge.category}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {challenge && (
                  <Link href="/dashboard" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      Submit
                    </Button>
                  </Link>
                )}
                {panelExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Panel body — collapsible */}
            {panelExpanded && (
              <div className="pb-5 space-y-4">
                {loadingChallenge ? (
                  <div className="h-16 flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading challenge...
                  </div>
                ) : challenge ? (
                  /* Current challenge card */
                  <div className="bg-background border border-border p-4 space-y-3">
                    <p className="text-sm leading-relaxed text-foreground">
                      {challenge.challengeText}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {challenge.duration}
                      </span>
                      {challenge.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {challenge.location}
                        </span>
                      )}
                      {challenge.weatherConditions && (
                        <span className="flex items-center gap-1">
                          <Cloud className="h-3 w-3" />
                          {challenge.weatherConditions}
                        </span>
                      )}
                    </div>
                    {challenge.tips && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-2">
                        <span className="font-medium text-foreground">Tip: </span>
                        {challenge.tips}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Link href="/dashboard" className="flex-1">
                        <Button size="sm" className="w-full h-8 text-xs bg-foreground text-background hover:bg-primary">
                          <LayoutDashboard className="h-3 w-3 mr-1.5" />
                          Go to Dashboard to Submit
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={generateChallenge}
                        disabled={generating}
                        className="h-8 text-xs"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
                        New
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Empty state — generate new */
                  <div className="bg-background border border-dashed border-border p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No active challenge. Generate one to save it to your dashboard.
                    </p>
                    {/* Challenge type pills */}
                    <div className="flex flex-wrap gap-2">
                      {CHALLENGE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setChallengeType(t.value)}
                          className={`text-xs px-3 py-1.5 border transition-colors ${
                            challengeType === t.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={generateChallenge}
                      disabled={generating}
                      className="h-8 text-xs bg-foreground text-background hover:bg-primary"
                    >
                      {generating ? (
                        <>
                          <div className="h-3 w-3 border-2 border-background border-t-transparent rounded-full animate-spin mr-1.5" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3 mr-1.5" />
                          Generate &amp; Save Challenge
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ChatInterface />
    </div>
  )
}
