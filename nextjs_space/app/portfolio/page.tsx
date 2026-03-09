'use client';

import { useState, useRef, useCallback } from 'react';
import { useAppwriteAuth } from '@/hooks/useAppwriteAuth';
import { usePortfolioAnalyses } from '@/hooks/use-dashboard-data';
import { motion } from 'framer-motion';
import {
  Upload, Loader2, ImagePlus, X, CheckCircle2, XCircle, ArrowRight,
  BarChart3, Layers, ListOrdered, Palette, AlertTriangle, ChevronDown,
} from 'lucide-react';
import type { PortfolioAnalysis } from '@/lib/types';

export default function PortfolioPage() {
  const { user, status: authStatus } = useAppwriteAuth();
  const { data: history, refetch: refetchHistory } = usePortfolioAnalyses(user?.id);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<PortfolioAnalysis | null>(null);
  const [error, setError] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith('image/'));
    const combined = [...files, ...arr].slice(0, 20);
    setFiles(combined);
    // Generate previews
    const newPreviews: string[] = [];
    combined.forEach((f) => {
      const url = URL.createObjectURL(f);
      newPreviews.push(url);
    });
    setPreviews(newPreviews);
    setResult(null);
    setError('');
  }, [files]);

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const analyze = async () => {
    if (!user || files.length < 3) return;
    setAnalyzing(true);
    setError('');
    setProgress('Uploading photos...');

    try {
      const formData = new FormData();
      formData.append('userId', user.id);
      files.forEach((f, i) => formData.append(`photo_${i}`, f));

      setProgress(`Analyzing ${files.length} photos (this may take 30-60 seconds)...`);

      const res = await fetch('/api/portfolio', { method: 'POST', body: formData });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Analysis failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data.analysis);
      setProgress('');
      refetchHistory();
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      setProgress('');
    } finally {
      setAnalyzing(false);
    }
  };

  if (authStatus === 'loading') {
    return <div className="min-h-screen flex items-center justify-center pt-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (authStatus !== 'authenticated' || !user) {
    return <div className="min-h-screen flex items-center justify-center pt-20"><p className="text-muted-foreground">Please sign in to use Portfolio Intelligence.</p></div>;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Portfolio Intelligence</h1>
          <p className="text-muted-foreground mt-1">Upload 3-20 photos for AI-powered portfolio curation</p>
        </div>

        {/* Upload area */}
        {!result && (
          <div className="mb-8">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Drag & drop photos or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, HEIC — max 10 MB each — 3 to 20 photos</p>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </div>

            {/* Preview grid */}
            {previews.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">{files.length} photo{files.length !== 1 ? 's' : ''} selected</p>
                  <button onClick={() => { setFiles([]); setPreviews([]); }} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden group">
                      <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removeFile(i)} className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3 text-white" />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[10px] font-mono bg-black/60 text-white px-1 rounded">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analyze button */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={analyze}
                disabled={analyzing || files.length < 3}
                className="flex items-center gap-2 px-6 py-3 bg-foreground text-background font-semibold rounded-md hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze Portfolio'}
              </button>
              {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
        )}

        {/* Results */}
        {result && <AnalysisResults analysis={result} photoCount={files.length} onReset={() => { setResult(null); setFiles([]); setPreviews([]); }} />}

        {/* History */}
        {history && history.length > 0 && !result && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-foreground mb-4">Previous Analyses</h2>
            <div className="space-y-3">
              {history.map((item: any) => (
                <div key={item.id} className="rounded-lg border border-border">
                  <button
                    onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.photoCount} photos analyzed</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.analysisDate).toLocaleDateString()}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedHistory === item.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedHistory === item.id && (
                    <div className="px-4 pb-4">
                      <AnalysisResults analysis={item.analysis} photoCount={item.photoCount} compact />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisResults({ analysis, photoCount, onReset, compact }: { analysis: PortfolioAnalysis; photoCount: number; onReset?: () => void; compact?: boolean }) {
  return (
    <div className="space-y-6">
      {onReset && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Portfolio Analysis</h2>
          <button onClick={onReset} className="text-sm text-muted-foreground hover:text-foreground">Analyze new set</button>
        </div>
      )}

      {/* Style Summary */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your Style</h3>
        </div>
        <p className="text-sm text-muted-foreground">{analysis.styleSummary}</p>
      </div>

      {/* Best Selection */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-foreground">Selected for Portfolio ({analysis.bestSelection.length}/{photoCount})</h3>
        </div>
        <div className="space-y-2">
          {analysis.bestSelection.map((item) => (
            <div key={item.index} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 w-8 h-6 flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-mono">#{item.index + 1}</span>
              <span className="text-muted-foreground">{item.reason}</span>
            </div>
          ))}
        </div>
        {analysis.excludedPhotos.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Not selected</span>
            </div>
            <div className="space-y-2">
              {analysis.excludedPhotos.map((item) => (
                <div key={item.index} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 w-8 h-6 flex items-center justify-center bg-muted text-muted-foreground rounded text-xs font-mono">#{item.index + 1}</span>
                  <span className="text-muted-foreground">{item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sequencing */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListOrdered className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground">Recommended Order</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {analysis.sequencing.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs font-medium">
                #{item.index + 1} <span className="text-[10px] opacity-70">({item.role})</span>
              </span>
              {i < analysis.sequencing.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      {/* Consistency Audit */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-foreground">Consistency Audit</h3>
          </div>
          <span className={`text-sm font-bold ${analysis.consistencyAudit.consistencyScore >= 70 ? 'text-emerald-500' : analysis.consistencyAudit.consistencyScore >= 40 ? 'text-orange-500' : 'text-destructive'}`}>
            {analysis.consistencyAudit.consistencyScore}/100
          </span>
        </div>
        {analysis.consistencyAudit.variations.length > 0 && (
          <div className="space-y-1 mb-2">
            {analysis.consistencyAudit.variations.map((v, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500 mt-0.5" />
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{analysis.consistencyAudit.recommendation}</p>
      </div>

      {/* Gap Analysis */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-foreground">Gap Analysis</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-emerald-500 uppercase tracking-wider mb-1">Strengths</p>
            <ul className="space-y-1">{analysis.gapAnalysis.strengths.map((s, i) => <li key={i} className="text-muted-foreground">+ {s}</li>)}</ul>
          </div>
          <div>
            <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-1">Gaps</p>
            <ul className="space-y-1">{analysis.gapAnalysis.gaps.map((g, i) => <li key={i} className="text-muted-foreground">- {g}</li>)}</ul>
          </div>
          <div>
            <p className="text-xs font-medium text-blue-500 uppercase tracking-wider mb-1">Suggestions</p>
            <ul className="space-y-1">{analysis.gapAnalysis.suggestions.map((s, i) => <li key={i} className="text-muted-foreground">{s}</li>)}</ul>
          </div>
        </div>
      </div>

      {/* Overall Feedback */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">{analysis.overallFeedback}</p>
      </div>
    </div>
  );
}
