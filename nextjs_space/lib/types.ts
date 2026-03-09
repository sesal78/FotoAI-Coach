export type Expense = {
  id: string
  amount: number
  category: string
  description: string
  date: Date
}

export type ExpenseFormData = Omit<Expense, 'id' | 'date'> & {
  date: string
}

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transportation',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Education',
  'Other'
] as const

export type DateRange = {
  from: Date | undefined
  to: Date | undefined
}

export interface Challenge {
  id: string;
  challengeText: string;
  category: string;
  difficulty: string;
  duration: string;
  tips: string;
  recommendedGear: string[];
  weatherConditions?: string;
  location?: string;
  status: string;
  issuedDate: string;
  submissions?: any[];
  // Story-Driven fields
  shotList?: string[];
  narrativeContext?: string;
  editingDirection?: string;
  // Technical Mastery fields
  masteryArea?: string;
  technicalLevel?: number;
  successCriteria?: string;
  whatToLookFor?: string;
}

export interface UserProgress {
  totalChallengesCompleted: number;
  totalChallengesIssued: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  favoriteSubjects: string[];
}

export interface PhotoCritique {
  id: string;
  userId: string;
  submissionId?: string;
  photoUrl: string;
  technicalScore: number;
  compositionScore: number;
  creativeScore: number;
  overallScore: number;
  technicalFeedback: string;
  compositionFeedback: string;
  creativeFeedback: string;
  strengths: string[];
  improvements: string[];
  suggestedSettings: string;
  critiqueDate: string;
}

export interface ReverseEngineeringResult {
  estimatedSettings: {
    iso: string;
    aperture: string;
    shutterSpeed: string;
    focalLength: string;
    meteringMode: string;
  };
  lightingAnalysis: {
    timeOfDay: string;
    lightType: string;
    lightDirection: string;
    modifiers: string;
  };
  cameraPosition: string;
  lensType: string;
  postProcessing: string;
  shotRecipe: string[];
  difficultyToRecreate: string;
  gearNeeded: string[];
}

export interface ReverseAnalysis {
  id: string;
  userId: string;
  photoUrl: string;
  result: ReverseEngineeringResult;
  analysisDate: string;
}

export interface WeeklyInsightsData {
  weekStart: string;
  weekEnd: string;
  challengesCompletedThisWeek: number;
  challengesCompletedLastWeek: number;
  submissionsThisWeek: number;
  averageCritiqueScore: number | null;
  previousAverageCritiqueScore: number | null;
  scoreTrend: { technical: number | null; composition: number | null; creative: number | null };
  previousScoreTrend: { technical: number | null; composition: number | null; creative: number | null };
  topCategories: string[];
  challengeCompletionRate: number;
  currentStreak: number;
  longestStreak: number;
}

export interface WeeklyInsightsResult {
  summary: string;
  highlights: string[];
  skillBreakdown: string;
  recommendation: string;
  motivationalNote: string;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  stats: WeeklyInsightsData;
  insights: WeeklyInsightsResult;
  reportDate: string;
}