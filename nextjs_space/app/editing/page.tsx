'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth';
import { useEditingRecipes } from '@/hooks/fotoai/editing';
import { createFotoaiEditingRecipe, type FotoaiEditingRecipe } from '@/lib/fotoai/client-ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { EditingRecipe } from '@/lib/types';
import {
  ArrowLeft,
  Camera,
  Upload,
  SlidersHorizontal,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

function AssessmentBadge({ assessment }: { assessment: string }) {
  if (assessment === 'appropriate') {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Appropriate
      </Badge>
    );
  }
  if (assessment === 'overdone') {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        Overdone
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
      <MinusCircle className="h-3 w-3 mr-1" />
      Underdone
    </Badge>
  );
}

function RecipeDisplay({ recipe, originalPreview, editedPreview }: {
  recipe: EditingRecipe;
  originalPreview?: string;
  editedPreview?: string;
}) {
  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      {originalPreview && editedPreview && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Original</p>
            <div className="relative aspect-[4/3] bg-muted overflow-hidden border border-border">
              <Image src={originalPreview} alt="Original" fill className="object-contain" sizes="400px" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Edited</p>
            <div className="relative aspect-[4/3] bg-muted overflow-hidden border border-border">
              <Image src={editedPreview} alt="Edited" fill className="object-contain" sizes="400px" />
            </div>
          </div>
        </div>
      )}

      {/* Editing approach & overall */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">{recipe.difficultyLevel}</Badge>
          <span className="text-sm font-medium">{recipe.editingApproach}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{recipe.overallAssessment}</p>
      </div>

      {/* Adjustments detected */}
      {recipe.adjustmentsDetected.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4" />
            Adjustments Detected
          </h3>
          <div className="space-y-2">
            {recipe.adjustmentsDetected.map((adj, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-28">{adj.slider}</span>
                  <span className="text-sm text-muted-foreground">
                    {adj.direction} <span className="font-mono font-medium text-foreground">{adj.estimatedAmount}</span>
                  </span>
                </div>
                <AssessmentBadge assessment={adj.assessment} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Over-editing warnings */}
      {recipe.overEditingWarnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Over-Editing Warnings
          </h3>
          <div className="space-y-2">
            {recipe.overEditingWarnings.map((warning, i) => (
              <div key={i} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-400">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested improvements */}
      {recipe.suggestedImprovements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Suggested Improvements
          </h3>
          <div className="space-y-2">
            {recipe.suggestedImprovements.map((sug, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{sug.slider}</span>
                  <ArrowRight className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-mono font-medium text-amber-800 dark:text-amber-300">{sug.value}</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400">{sug.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ analysis }: { analysis: FotoaiEditingRecipe }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="editorial-card overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold display-font">{analysis.recipe.editingApproach}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(analysis.analysisDate).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{analysis.recipe.difficultyLevel}</Badge>
            <Badge variant="secondary" className="text-xs">
              {analysis.recipe.adjustmentsDetected.length} adjustments
            </Badge>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3">{analysis.recipe.overallAssessment}</p>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
        >
          {expanded ? 'Hide' : 'Show'} full recipe
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            <RecipeDisplay
              recipe={analysis.recipe}
              originalPreview={analysis.originalPhotoUrl ?? undefined}
              editedPreview={analysis.editedPhotoUrl ?? undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditingPage() {
  const { status } = useAppwriteAuth();
  const { data: recipes = [], isLoading: recipesLoading, refetch } = useEditingRecipes(status === 'authenticated');
  const [originalPhoto, setOriginalPhoto] = useState<File | null>(null);
  const [editedPhoto, setEditedPhoto] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [editedPreview, setEditedPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [latestResult, setLatestResult] = useState<FotoaiEditingRecipe | null>(null);

  function handleFile(type: 'original' | 'edited', file: File | null) {
    if (type === 'original') {
      setOriginalPhoto(file);
      setLatestResult(null);
    } else {
      setEditedPhoto(file);
      setLatestResult(null);
    }

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'original') setOriginalPreview(reader.result as string);
        else setEditedPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      if (type === 'original') setOriginalPreview(null);
      else setEditedPreview(null);
    }
  }

  async function handleAnalyse() {
    if (!originalPhoto || !editedPhoto || status !== 'authenticated') return;

    setAnalysing(true);
    try {
      const result = await createFotoaiEditingRecipe(originalPhoto, editedPhoto);
      setLatestResult(result);
      toast.success('Editing recipe generated!');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to generate editing recipe');
    } finally {
      setAnalysing(false);
    }
  }

  function handleClear() {
    setOriginalPhoto(null);
    setEditedPhoto(null);
    setOriginalPreview(null);
    setEditedPreview(null);
    setLatestResult(null);
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
              <SlidersHorizontal className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">
              Editing Lab
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Upload your original and edited photos. AI analyses your edits slider-by-slider and teaches you how to improve.
          </p>
        </div>

        {/* Upload Section */}
        <div className="editorial-card p-6 lg:p-8 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Compare Your Edits</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Original upload */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Original Photo</p>
              <label
                htmlFor="original-upload"
                className={`relative flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer h-48 ${
                  originalPreview ? 'border-primary' : 'border-border hover:border-primary/50'
                }`}
              >
                {originalPreview ? (
                  <Image src={originalPreview} alt="Original" fill className="object-contain p-2" sizes="400px" />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Upload original</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Before editing</p>
                  </div>
                )}
                <Input
                  id="original-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFile('original', e.target.files?.[0] || null)}
                />
              </label>
              {originalPhoto && (
                <p className="text-xs text-muted-foreground mt-1.5 truncate">
                  {originalPhoto.name} ({(originalPhoto.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Edited upload */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Edited Photo</p>
              <label
                htmlFor="edited-upload"
                className={`relative flex flex-col items-center justify-center border-2 border-dashed transition-colors cursor-pointer h-48 ${
                  editedPreview ? 'border-primary' : 'border-border hover:border-primary/50'
                }`}
              >
                {editedPreview ? (
                  <Image src={editedPreview} alt="Edited" fill className="object-contain p-2" sizes="400px" />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Upload edited</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">After editing</p>
                  </div>
                )}
                <Input
                  id="edited-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFile('edited', e.target.files?.[0] || null)}
                />
              </label>
              {editedPhoto && (
                <p className="text-xs text-muted-foreground mt-1.5 truncate">
                  {editedPhoto.name} ({(editedPhoto.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyse}
              disabled={!originalPhoto || !editedPhoto || analysing}
              className="h-12 px-8 bg-foreground text-background hover:bg-primary font-semibold tracking-wide"
            >
              {analysing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Analysing edits...
                </span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Recipe
                </>
              )}
            </Button>
            {(originalPhoto || editedPhoto) && (
              <Button variant="ghost" onClick={handleClear} className="text-sm">
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Latest Result */}
        {latestResult && (
          <div className="editorial-card p-6 lg:p-8 mb-8">
            <h2 className="text-xl font-semibold display-font mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your Editing Recipe
            </h2>
            <RecipeDisplay
              recipe={latestResult.recipe}
              originalPreview={originalPreview || undefined}
              editedPreview={editedPreview || undefined}
            />
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="text-xl font-semibold display-font mb-4">Recipe History</h2>
          {recipesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
            </div>
          ) : recipes.length > 0 ? (
            <div className="space-y-4">
              {recipes
                .filter((r) => r.id !== latestResult?.id)
                .map((analysis) => (
                  <HistoryCard key={analysis.id} analysis={analysis} />
                ))}
            </div>
          ) : !latestResult ? (
            <div className="editorial-card p-8 text-center">
              <SlidersHorizontal className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                No editing recipes yet. Upload an original and edited photo above to get your first AI analysis.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
