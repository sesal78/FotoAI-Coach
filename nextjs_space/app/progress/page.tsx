'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useUserProgress, useRecentChallenges } from '@/hooks/use-dashboard-data';
import { useWeeklyInsights } from '@/hooks/fotoai/insights';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Flame,
  TrendingUp,
  Target,
  BarChart3,
  Lightbulb,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const HEX_COLORS = ['#e65100', '#1565c0', '#7b1fa2', '#2e7d32', '#ef6c00'];

const TOOLTIP_STYLE = {
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0',
  fontSize: '12px',
} as const;

export default function ProgressPage() {
  const { status } = useAuth();
  const hasFotoaiSession = status === 'authenticated';
  const { data: progress, isLoading: progressLoading } = useUserProgress(hasFotoaiSession);
  const { data: recentData } = useRecentChallenges(50, hasFotoaiSession);
  const { data: weeklyInsights, isLoading: insightsLoading } = useWeeklyInsights(hasFotoaiSession, 5);
  const [showOlderReports, setShowOlderReports] = useState(false);
  const allChallenges = recentData?.challenges ?? [];
  const latestReport = weeklyInsights?.[0] ?? null;
  const olderReports = weeklyInsights?.slice(1) ?? [];

  // Derive chart data from challenges
  const categoryData = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    allChallenges.forEach((c) => {
      const cat = c.category || 'Unknown';
      if (!counts[cat]) counts[cat] = { total: 0, completed: 0 };
      counts[cat].total++;
      if (c.status === 'completed') counts[cat].completed++;
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [allChallenges]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    allChallenges.forEach((c) => {
      const s = c.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allChallenges]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string, { completed: number; issued: number }> = {};
    const now = new Date();
    // Last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      weeks[label] = { completed: 0, issued: 0 };
    }

    allChallenges.forEach((c) => {
      const d = new Date(c.issuedDate);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      if (weeks[label]) {
        weeks[label].issued++;
        if (c.status === 'completed') weeks[label].completed++;
      }
    });

    return Object.entries(weeks).map(([week, data]) => ({ week, ...data }));
  }, [allChallenges]);

  if (status === 'loading' || progressLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight display-font">
            My Progress
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your photography journey and growth over time.
          </p>
        </div>

        {/* Weekly Insights */}
        {insightsLoading ? (
          <div className="editorial-card p-6 lg:p-8 mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold display-font">Weekly Insights</h2>
            </div>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </div>
        ) : latestReport ? (
          <div className="editorial-card p-6 lg:p-8 mb-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold display-font">Weekly Insights</h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {latestReport.weekStart} — {latestReport.weekEnd}
              </div>
            </div>

            {/* Summary */}
            <p className="text-[15px] leading-relaxed mb-5">
              {latestReport.insights.summary}
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {latestReport.stats.challengesCompletedThisWeek}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Completed
                  {latestReport.stats.challengesCompletedLastWeek > 0 && (
                    <span className={latestReport.stats.challengesCompletedThisWeek >= latestReport.stats.challengesCompletedLastWeek ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {' '}({latestReport.stats.challengesCompletedThisWeek >= latestReport.stats.challengesCompletedLastWeek ? '+' : ''}
                      {latestReport.stats.challengesCompletedThisWeek - latestReport.stats.challengesCompletedLastWeek} vs last)
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-500">{latestReport.stats.currentStreak}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Day Streak</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-500">
                  {latestReport.stats.averageCritiqueScore !== null ? latestReport.stats.averageCritiqueScore : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Avg Score</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{latestReport.stats.challengeCompletionRate}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">Completion</div>
              </div>
            </div>

            {/* Highlights */}
            {latestReport.insights.highlights.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Highlights</h3>
                <ul className="space-y-1.5">
                  {latestReport.insights.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skill breakdown */}
            {latestReport.insights.skillBreakdown && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skill Progress</h3>
                <p className="text-sm">{latestReport.insights.skillBreakdown}</p>
              </div>
            )}

            {/* Recommendation */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Next Week</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">{latestReport.insights.recommendation}</p>
                </div>
              </div>
            </div>

            {/* Motivational note */}
            <p className="text-sm text-muted-foreground italic text-center">{latestReport.insights.motivationalNote}</p>

            {/* Older reports toggle */}
            {olderReports.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <button
                  onClick={() => setShowOlderReports(!showOlderReports)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
                >
                  {showOlderReports ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showOlderReports ? 'Hide' : 'Show'} previous reports ({olderReports.length})
                </button>

                {showOlderReports && (
                  <div className="mt-4 space-y-4">
                    {olderReports.map((report) => (
                      <div key={report.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{report.weekStart} — {report.weekEnd}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{report.stats.challengesCompletedThisWeek} completed</span>
                            {report.stats.averageCritiqueScore !== null && (
                              <span>Avg: {report.stats.averageCritiqueScore}/100</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{report.insights.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="editorial-card p-6 lg:p-8 mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold display-font">Weekly Insights</h2>
            </div>
            <div className="text-center py-6 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Your first weekly insights report will appear here after the next weekly summary is generated.</p>
              <p className="text-xs mt-1">Reports are generated every Sunday.</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
          <div className="editorial-card p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="overline">Completed</span>
            </div>
            <div className="display-number text-3xl lg:text-4xl">
              {progress?.totalChallengesCompleted ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              of {progress?.totalChallengesIssued ?? 0} issued
            </p>
          </div>

          <div className="editorial-card p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="overline">Current Streak</span>
            </div>
            <div className="display-number text-3xl lg:text-4xl">
              {progress?.currentStreak ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Best: {progress?.longestStreak ?? 0} days
            </p>
          </div>

          <div className="editorial-card p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="overline">Completion Rate</span>
            </div>
            <div className="display-number text-3xl lg:text-4xl">
              {progress?.completionRate ?? 0}%
            </div>
            <Progress value={progress?.completionRate ?? 0} className="mt-3 h-1.5" />
          </div>

          <div className="editorial-card p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="overline">Top Styles</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(progress?.favoriteSubjects ?? []).length > 0 ? (
                progress!.favoriteSubjects.slice(0, 3).map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Complete challenges to discover
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Weekly Activity */}
          <div className="editorial-card p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold display-font">Weekly Activity</h2>
            </div>
            {weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyData} barGap={2}>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="issued" fill={HEX_COLORS[1]} name="Issued" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="completed" fill={HEX_COLORS[0]} name="Completed" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                No data yet — generate some challenges!
              </div>
            )}
          </div>

          {/* Challenge Status Breakdown */}
          <div className="editorial-card p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold display-font">Status Breakdown</h2>
            </div>
            {statusData.length > 0 ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={HEX_COLORS[i % HEX_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {statusData.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: HEX_COLORS[i % HEX_COLORS.length] }}
                        />
                        <span className="capitalize">{item.name}</span>
                      </div>
                      <span className="font-mono font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No challenges yet
              </div>
            )}
          </div>
        </div>

        {/* Category Performance */}
        <div className="editorial-card p-6 lg:p-8 mb-10">
          <div className="flex items-center gap-2 mb-6">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold display-font">Category Performance</h2>
          </div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="vertical" barGap={2}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="total" fill={HEX_COLORS[1]} name="Total" radius={[0, 2, 2, 0]} />
                <Bar dataKey="completed" fill={HEX_COLORS[0]} name="Completed" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
