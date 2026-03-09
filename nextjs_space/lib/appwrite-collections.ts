// Appwrite database and collection ID constants
// These map to the collections created by scripts/appwrite-setup.ts

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;

export const COLLECTION_USER_PREFERENCES = 'user_preferences';
export const COLLECTION_USER_GEAR = 'user_gear';
export const COLLECTION_DAILY_CHALLENGES = 'daily_challenges';
export const COLLECTION_CHALLENGE_SUBMISSIONS = 'challenge_submissions';
export const COLLECTION_ITINERARIES = 'itineraries';
export const COLLECTION_USER_PROGRESS = 'user_progress';
export const COLLECTION_AGENT_ACTIONS = 'agent_actions';
export const COLLECTION_PHOTO_CRITIQUES = 'photo_critiques';
export const COLLECTION_REVERSE_ANALYSES = 'reverse_analyses';
export const COLLECTION_WEEKLY_REPORTS = 'weekly_reports';
export const COLLECTION_EDITING_RECIPES = 'editing_recipes';

export const STORAGE_BUCKET_SUBMISSIONS = process.env.APPWRITE_STORAGE_BUCKET_ID!;
