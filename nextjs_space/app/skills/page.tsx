'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSkillTree } from '@/hooks/fotoai/skills';
import { motion } from 'framer-motion';
import {
  Triangle, Gauge, Layers, Thermometer, Crosshair, CircleDot, Timer, Zap,
  SquareAsterisk, CopyMinus, SunMoon, MoveHorizontal, ZapOff, Combine, Cable,
  Grid3x3, ArrowUpRight, Frame, FlipHorizontal, Square, LayoutList, Shell,
  TrendingUp, Minus, Repeat, Slash,
  FileImage, Sun, Crop, Palette, Sparkles, Eraser, PaintBucket, Copy,
  Lock, Star, Award, Trophy, Loader2,
} from 'lucide-react';
import type { SkillTreeResponse } from '@/lib/types';
import type { SkillCategory } from '@/lib/skills';

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Triangle, Gauge, Layers, Thermometer, Crosshair, CircleDot, Timer, Zap,
  SquareAsterisk, CopyMinus, SunMoon, MoveHorizontal, ZapOff, Combine, Cable,
  Grid3x3, ArrowUpRight, Frame, FlipHorizontal, Square, LayoutList, Shell,
  TrendingUp, Minus, Repeat, Slash,
  FileImage, Sun, Crop, Palette, Sparkles, Eraser, PaintBucket, Copy,
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical Skills',
  composition: 'Composition',
  post_processing: 'Post-Processing',
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  technical: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-500', ring: 'ring-blue-500/30' },
  composition: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-500', ring: 'ring-emerald-500/30' },
  post_processing: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-500', ring: 'ring-purple-500/30' },
};

const STATUS_STYLES: Record<string, { opacity: string; badge: string; badgeIcon: React.ComponentType<{ className?: string }> }> = {
  locked: { opacity: 'opacity-40', badge: 'bg-muted text-muted-foreground', badgeIcon: Lock },
  available: { opacity: 'opacity-70', badge: 'bg-muted text-foreground', badgeIcon: Star },
  learned: { opacity: 'opacity-100', badge: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400', badgeIcon: Star },
  practiced: { opacity: 'opacity-100', badge: 'bg-orange-500/20 text-orange-600 dark:text-orange-400', badgeIcon: Award },
  mastered: { opacity: 'opacity-100', badge: 'bg-primary/20 text-primary', badgeIcon: Trophy },
};

type SkillItem = SkillTreeResponse['skills'][number];

function SkillNode({ skill, categoryColor }: { skill: SkillItem; categoryColor: typeof CATEGORY_COLORS['technical'] }) {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = ICON_MAP[skill.icon] || Star;
  const statusStyle = STATUS_STYLES[skill.status] || STATUS_STYLES.locked;
  const StatusIcon = statusStyle.badgeIcon;

  // XP progress within current tier
  let progressPercent = 0;
  let currentThreshold = 0;
  let nextThreshold = skill.xpToLearn;

  if (skill.status === 'learned') {
    currentThreshold = skill.xpToLearn;
    nextThreshold = skill.xpToPractice;
  } else if (skill.status === 'practiced') {
    currentThreshold = skill.xpToPractice;
    nextThreshold = skill.xpToMaster;
  } else if (skill.status === 'mastered') {
    progressPercent = 100;
    currentThreshold = skill.xpToMaster;
    nextThreshold = skill.xpToMaster;
  }

  if (skill.status !== 'mastered' && nextThreshold > currentThreshold) {
    progressPercent = Math.min(100, Math.round(
      ((skill.currentXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    ));
    if (progressPercent < 0) progressPercent = 0;
  }

  return (
    <motion.div
      layout
      className={`relative rounded-lg border ${categoryColor.border} ${statusStyle.opacity} transition-all duration-200 cursor-pointer hover:shadow-md`}
      onClick={() => setExpanded(!expanded)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`shrink-0 p-2 rounded-md ${categoryColor.bg}`}>
            <IconComponent className={`h-5 w-5 ${categoryColor.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">{skill.name}</h3>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${statusStyle.badge}`}>
                <StatusIcon className="h-3 w-3" />
                {skill.status}
              </span>
            </div>
            {/* XP bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>{skill.currentXP} XP</span>
                <span>{skill.status === 'mastered' ? 'MAX' : `${nextThreshold} XP`}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${skill.status === 'mastered' ? 'bg-primary' : categoryColor.text.replace('text-', 'bg-')}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border"
          >
            <p className="text-xs text-muted-foreground mb-2">{skill.description}</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-muted">Tier {skill.tier}</span>
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                Learn: {skill.xpToLearn} XP
              </span>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                Practice: {skill.xpToPractice} XP
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Master: {skill.xpToMaster} XP
              </span>
            </div>
            {skill.prerequisites.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Requires: {skill.prerequisites.join(', ')}
              </p>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function CategorySection({ category, skills }: { category: string; skills: SkillItem[] }) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.technical;
  const tiers = [1, 2, 3] as const;

  const totalXP = skills.reduce((sum, s) => sum + s.currentXP, 0);
  const masteredCount = skills.filter((s) => s.status === 'mastered').length;
  const learnedCount = skills.filter((s) => ['learned', 'practiced', 'mastered'].includes(s.status)).length;

  return (
    <div className="space-y-4">
      {/* Category header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${color.text}`}>
          {CATEGORY_LABELS[category] || category}
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{learnedCount}/{skills.length} unlocked</span>
          <span>{masteredCount} mastered</span>
          <span className="font-medium">{totalXP.toLocaleString()} XP</span>
        </div>
      </div>

      {/* Tier groups */}
      {tiers.map((tier) => {
        const tierSkills = skills.filter((s) => s.tier === tier);
        if (tierSkills.length === 0) return null;

        return (
          <div key={tier}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Tier {tier} {tier === 1 ? '— Foundations' : tier === 2 ? '— Intermediate' : '— Advanced'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tierSkills.map((skill) => (
                <SkillNode key={skill.id} skill={skill} categoryColor={color} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SkillsPage() {
  const { user, status: authStatus } = useAuth();
  const { data: tree, isLoading } = useSkillTree(authStatus === 'authenticated');
  const [activeTab, setActiveTab] = useState<'all' | SkillCategory>('all');

  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authStatus !== 'authenticated' || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-muted-foreground">Please sign in to view your skill tree.</p>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-muted-foreground">Unable to load skill tree.</p>
      </div>
    );
  }

  const categories: Array<'all' | SkillCategory> = ['all', 'technical', 'composition', 'post_processing'];

  const filteredSkills = activeTab === 'all'
    ? tree.skills
    : tree.skills.filter((s) => s.category === activeTab);

  const groupedByCategory = new Map<string, SkillItem[]>();
  for (const skill of filteredSkills) {
    const existing = groupedByCategory.get(skill.category) || [];
    existing.push(skill);
    groupedByCategory.set(skill.category, existing);
  }

  // Overall stats
  const totalMastered = tree.skills.filter((s) => s.status === 'mastered').length;
  const totalLearned = tree.skills.filter((s) => ['learned', 'practiced', 'mastered'].includes(s.status)).length;

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Skill Tree</h1>
          <p className="text-muted-foreground mt-1">Master photography skills through practice</p>
        </div>

        {/* Level & XP overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Level</p>
            <p className="text-3xl font-bold text-foreground mt-1">{tree.level}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total XP</p>
            <p className="text-3xl font-bold text-foreground mt-1">{tree.totalXP.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Skills Unlocked</p>
            <p className="text-3xl font-bold text-foreground mt-1">{totalLearned}/{tree.skills.length}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Mastered</p>
            <p className="text-3xl font-bold text-primary mt-1">{totalMastered}</p>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="mb-8 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Level {tree.level} Progress</span>
            <span className="text-muted-foreground">{tree.levelProgress}%</span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${tree.levelProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {tree.totalXP.toLocaleString()} / {tree.xpForNextLevel.toLocaleString()} XP to Level {tree.level + 1}
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === cat
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? 'All Skills' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Skill tree content */}
        <div className="space-y-8">
          {Array.from(groupedByCategory.entries()).map(([category, skills]) => (
            <CategorySection key={category} category={category} skills={skills} />
          ))}
        </div>
      </div>
    </div>
  );
}
