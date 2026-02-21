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
}

export interface UserProgress {
  totalChallengesCompleted: number;
  totalChallengesIssued: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  favoriteSubjects: string[];
}