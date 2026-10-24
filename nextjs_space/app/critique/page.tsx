'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { usePhotoCritiques } from '@/hooks/fotoai/critiques';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { FotoaiClientError } from '@/lib/fotoai/client';
import { createFotoaiCritique, type FotoaiCritique } from '@/lib/fotoai/client-features';
import {
  ArrowLeft,
  Camera,
  Upload,
  Eye,
  Target,
  Palette,
  Wrench,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

function ScoreRing({ score, label, icon: Icon }: { score: number; label: string; icon: React.ElementType }) {
  const color =
    score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : score >= 40 ? 'text-orange-500' : 'text-red-500';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="34" fill="none" stroke="currentColor"
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 213.6} 213.6`}
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    </div>
  );
}

function CritiqueCard({ critique }: { critique: FotoaiCritique }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="editorial-card overflow-hidden">
      <div className="p-6 lg:p-8">
        {/* Header: scores + photo thumbnail */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Photo thumbnail */}
          <div className="relative w-full sm:w-40 h-40 bg-muted flex-shrink-0 overflow-hidden">
            {critique.photoUrl && critique.photoUrl !== 'upload-failed' ? (
              <Image
                src={critique.photoUrl}
                alt="Critiqued photo"
                fill
                className="object-cover"
                sizes="160px"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Camera className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold display-font">Photo Critique</h3>
                <p className="text-xs text-muted-foreground">
                  {new Date(critique.critiqueDate).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold display-number">{critique.overallScore}</div>
                <p className="text-xs text-muted-foreground">Overall</p>
              </div>
            </div>

            <div className="flex justify-around">
              <ScoreRing score={critique.technicalScore} label="Technical" icon={Wrench} />
              <ScoreRing score={critique.compositionScore} label="Composition" icon={Target} />
              <ScoreRing score={critique.creativeScore} label="Creative" icon={Palette} />
            </div>
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" /> Strengths
            </h4>
            <ul className="space-y-1">
              {critique.strengths.map((s, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">+</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3 w-3 text-orange-500" /> To Improve
            </h4>
            <ul className="space-y-1">
              {critique.improvements.map((s, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">!</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Expand / collapse detailed feedback */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary font-medium mt-4 hover:underline"
        >
          {expanded ? 'Hide' : 'Show'} detailed feedback
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                <Wrench className="h-3 w-3" /> Technical Analysis
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{critique.technicalFeedback}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                <Target className="h-3 w-3" /> Composition Analysis
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{critique.compositionFeedback}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                <Palette className="h-3 w-3" /> Creative Analysis
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{critique.creativeFeedback}</p>
            </div>
            {critique.suggestedSettings && (
              <div className="bg-accent/50 border border-accent p-3">
                <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                  <Camera className="h-3 w-3" /> Suggested Settings
                </h4>
                <p className="text-sm text-muted-foreground">{critique.suggestedSettings}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CritiquePage() {
  const { status } = useAuth();
  const { data: critiques = [], isLoading: critiquesLoading, refetch } = usePhotoCritiques(status === 'authenticated');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [latestCritique, setLatestCritique] = useState<FotoaiCritique | null>(null);

  function handleFileChange(file: File | null) {
    setPhoto(file);
    setLatestCritique(null);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  async function handleAnalyse() {
    if (!photo || status !== 'authenticated') return;

    setAnalysing(true);
    try {
      const critique = await createFotoaiCritique({ photo });
      setLatestCritique(critique);
      toast.success('Photo analysed!');
      refetch();
    } catch (error) {
      toast.error(error instanceof FotoaiClientError ? error.message : 'Failed to analyse photo');
    } finally {
      setAnalysing(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">
              Photo Critique
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Upload any photo and get AI-powered feedback on technical quality, composition, and creative impact.
          </p>
        </div>

        {/* Upload Section */}
        <div className="editorial-card p-6 lg:p-8 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Analyse a Photo</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Upload area */}
            <div className="flex-1">
              <label
                htmlFor="critique-upload"
                className={`relative flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer h-48 ${
                  preview ? 'border-primary' : 'border-border hover:border-primary/50'
                }`}
              >
                {preview ? (
                  <Image src={preview} alt="Preview" fill className="object-contain p-2" sizes="400px" />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      JPEG, PNG, WebP, HEIC (max 10 MB)
                    </p>
                  </div>
                )}
                <Input
                  id="critique-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
              {photo && (
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {photo.name} ({(photo.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Action */}
            <div className="flex flex-col justify-end gap-3 sm:w-48">
              <Button
                onClick={handleAnalyse}
                disabled={!photo || analysing}
                className="h-12 bg-foreground text-background hover:bg-primary font-semibold tracking-wide"
              >
                {analysing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    Analysing...
                  </span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyse
                  </>
                )}
              </Button>
              {photo && (
                <Button
                  variant="ghost"
                  onClick={() => { setPhoto(null); setPreview(null); setLatestCritique(null); }}
                  className="text-sm"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Latest Critique Result */}
        {latestCritique && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold display-font mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Latest Result
            </h2>
            <CritiqueCard critique={latestCritique} />
          </div>
        )}

        {/* Critique History */}
        <div>
          <h2 className="text-xl font-semibold display-font mb-4">Critique History</h2>
          {critiquesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
            </div>
          ) : critiques.length > 0 ? (
            <div className="space-y-4">
              {critiques
                .filter((c) => c.id !== latestCritique?.id)
                .map((critique) => (
                  <CritiqueCard key={critique.id} critique={critique} />
                ))}
            </div>
          ) : !latestCritique ? (
            <div className="editorial-card p-8 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                No critiques yet. Upload a photo above to get your first AI analysis.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
