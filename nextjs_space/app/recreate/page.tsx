'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useReverseAnalyses } from '@/hooks/fotoai/reverse';
import { createFotoaiReverseAnalysis, type FotoaiReverseAnalysis } from '@/lib/fotoai/client-ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ReverseEngineeringResult } from '@/lib/types';
import {
  ArrowLeft,
  Camera,
  Upload,
  Sun,
  Aperture,
  Focus,
  Move,
  Paintbrush,
  ListOrdered,
  Wrench,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Crosshair,
  Lightbulb,
} from 'lucide-react';

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const config: Record<string, { label: string; className: string }> = {
    beginner: { label: 'Beginner', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    intermediate: { label: 'Intermediate', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    advanced: { label: 'Advanced', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  };
  const c = config[difficulty] || config.intermediate;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function SettingsGrid({ settings }: { settings: ReverseEngineeringResult['estimatedSettings'] }) {
  const items = [
    { label: 'ISO', value: settings.iso, icon: Camera },
    { label: 'Aperture', value: settings.aperture, icon: Aperture },
    { label: 'Shutter', value: settings.shutterSpeed, icon: Focus },
    { label: 'Focal Length', value: settings.focalLength, icon: Crosshair },
    { label: 'Metering', value: settings.meteringMode, icon: Move },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-accent/50 border border-accent p-3 text-center">
          <Icon className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

function LightingSection({ lighting }: { lighting: ReverseEngineeringResult['lightingAnalysis'] }) {
  const items = [
    { label: 'Time of Day', value: lighting.timeOfDay },
    { label: 'Light Type', value: lighting.lightType },
    { label: 'Direction', value: lighting.lightDirection },
    { label: 'Modifiers', value: lighting.modifiers },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-sm text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

function AnalysisCard({ analysis, defaultExpanded }: { analysis: FotoaiReverseAnalysis; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const r = analysis.result;

  return (
    <div className="editorial-card overflow-hidden">
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Photo thumbnail */}
          <div className="relative w-full sm:w-40 h-40 bg-muted flex-shrink-0 overflow-hidden">
            {analysis.photoUrl && analysis.photoUrl !== 'upload-failed' ? (
              <Image
                src={analysis.photoUrl}
                alt="Inspiration photo"
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

          {/* Summary */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold display-font">Shot Analysis</h3>
                <p className="text-xs text-muted-foreground">
                  {new Date(analysis.analysisDate).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>
              </div>
              <DifficultyBadge difficulty={r.difficultyToRecreate} />
            </div>

            {/* Quick settings overview */}
            <SettingsGrid settings={r.estimatedSettings} />
          </div>
        </div>

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary font-medium mt-4 hover:underline"
        >
          {expanded ? 'Hide' : 'Show'} full breakdown
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="mt-4 space-y-6 border-t border-border pt-4">
            {/* Lighting */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Sun className="h-4 w-4 text-yellow-500" /> Lighting Analysis
              </h4>
              <LightingSection lighting={r.lightingAnalysis} />
            </div>

            {/* Camera Position */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Move className="h-4 w-4 text-blue-500" /> Camera Position
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.cameraPosition}</p>
            </div>

            {/* Lens Type */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Crosshair className="h-4 w-4 text-purple-500" /> Lens Analysis
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.lensType}</p>
            </div>

            {/* Post-Processing */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Paintbrush className="h-4 w-4 text-pink-500" /> Post-Processing
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.postProcessing}</p>
            </div>

            {/* Shot Recipe */}
            <div className="bg-accent/50 border border-accent p-4">
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <ListOrdered className="h-4 w-4 text-green-500" /> Shot Recipe
              </h4>
              <ol className="space-y-2">
                {r.shotRecipe.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-foreground leading-relaxed pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Gear Needed */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Wrench className="h-4 w-4 text-orange-500" /> Gear Needed
              </h4>
              <div className="flex flex-wrap gap-2">
                {r.gearNeeded.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecreatePage() {
  const { status } = useAuth();
  const { data: analyses = [], isLoading: analysesLoading, refetch } = useReverseAnalyses(status === 'authenticated');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<FotoaiReverseAnalysis | null>(null);

  function handleFileChange(file: File | null) {
    setPhoto(file);
    setLatestAnalysis(null);
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
      const analysis = await createFotoaiReverseAnalysis(photo);
      setLatestAnalysis(analysis);
      toast.success('Photo analysed — here\'s how to recreate it!');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to analyse photo');
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
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">
              Recreate This
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Upload any photo you admire and get a complete breakdown of how it was shot — camera settings, lighting, positioning, and step-by-step instructions to recreate it.
          </p>
        </div>

        {/* Upload Section */}
        <div className="editorial-card p-6 lg:p-8 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Upload Inspiration Photo</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Upload area */}
            <div className="flex-1">
              <label
                htmlFor="recreate-upload"
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
                      Upload a photo you want to recreate
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      From Instagram, magazines, web — any inspiration
                    </p>
                  </div>
                )}
                <Input
                  id="recreate-upload"
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
                    Reverse Engineer
                  </>
                )}
              </Button>
              {photo && (
                <Button
                  variant="ghost"
                  onClick={() => { setPhoto(null); setPreview(null); setLatestAnalysis(null); }}
                  className="text-sm"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Latest Analysis Result */}
        {latestAnalysis && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold display-font mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              How to Recreate This Shot
            </h2>
            <AnalysisCard analysis={latestAnalysis} defaultExpanded />
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="text-xl font-semibold display-font mb-4">Analysis History</h2>
          {analysesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
            </div>
          ) : analyses.length > 0 ? (
            <div className="space-y-4">
              {analyses
                .filter((a) => a.id !== latestAnalysis?.id)
                .map((analysis) => (
                  <AnalysisCard key={analysis.id} analysis={analysis} />
                ))}
            </div>
          ) : !latestAnalysis ? (
            <div className="editorial-card p-8 text-center">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                No analyses yet. Upload an inspiration photo above to reverse-engineer your first shot.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
