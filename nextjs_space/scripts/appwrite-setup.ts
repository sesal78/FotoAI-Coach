/**
 * Appwrite Setup Script
 * Run once after deploying Appwrite to create all collections and storage bucket.
 *
 * Usage:
 *   yarn ts-node --require dotenv/config scripts/appwrite-setup.ts
 *
 * Prerequisites:
 * - Appwrite is running and accessible
 * - APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY are set in .env
 * - Create a database in the Appwrite Console first, then set APPWRITE_DATABASE_ID
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Client, Databases, Storage, ID, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = process.env.APPWRITE_DATABASE_ID!;

async function createCollectionSafe(collectionId: string, name: string) {
  try {
    const col = await databases.createCollection(DB_ID, collectionId, name, [
      Permission.read(Role.users()),
      Permission.write(Role.users()),
    ]);
    console.log(`✅ Created collection: ${name}`);
    return col;
  } catch (e: any) {
    if (e?.code === 409) {
      console.log(`⏭️  Collection already exists: ${name}`);
    } else {
      throw e;
    }
  }
}

async function addAttr(collectionId: string, type: 'string' | 'boolean' | 'integer' | 'datetime' | 'stringArray', key: string, options?: any) {
  try {
    if (type === 'string') await databases.createStringAttribute(DB_ID, collectionId, key, options?.size || 255, options?.required ?? false, options?.default ?? null);
    else if (type === 'boolean') await databases.createBooleanAttribute(DB_ID, collectionId, key, options?.required ?? false, options?.default ?? null);
    else if (type === 'integer') await databases.createIntegerAttribute(DB_ID, collectionId, key, options?.required ?? false, options?.min, options?.max, options?.default ?? null);
    else if (type === 'datetime') await databases.createDatetimeAttribute(DB_ID, collectionId, key, options?.required ?? false, options?.default ?? null);
    else if (type === 'stringArray') await databases.createStringAttribute(DB_ID, collectionId, key, options?.size || 255, false, undefined, true);
  } catch (e: any) {
    if (e?.code === 409) return; // attribute already exists
    if (e?.type === 'attribute_limit_exceeded') {
      console.warn(`⚠️  Attribute limit reached for ${collectionId}.${key} — skipping`);
      return;
    }
    throw e;
  }
}

async function setup() {
  console.log('🚀 Starting Appwrite setup...\n');

  // ---- user_preferences ----
  await createCollectionSafe('user_preferences', 'User Preferences');
  await addAttr('user_preferences', 'string', 'userId', { required: true });
  await addAttr('user_preferences', 'string', 'skillLevel', { default: 'intermediate' });
  await addAttr('user_preferences', 'stringArray', 'photographyInterests');
  await addAttr('user_preferences', 'stringArray', 'avoidsStyles');
  await addAttr('user_preferences', 'stringArray', 'workDays');
  await addAttr('user_preferences', 'string', 'workStartTime', { default: '09:00' });
  await addAttr('user_preferences', 'string', 'workEndTime', { default: '17:00' });
  await addAttr('user_preferences', 'string', 'lunchStartTime', { default: '12:00' });
  await addAttr('user_preferences', 'string', 'lunchEndTime', { default: '13:00' });
  await addAttr('user_preferences', 'string', 'primaryPhotoDay', { default: 'Saturday' });
  await addAttr('user_preferences', 'stringArray', 'secondaryPhotoDays');
  await addAttr('user_preferences', 'boolean', 'lunchBreakPhotography', { default: true });
  await addAttr('user_preferences', 'boolean', 'eveningPhotography', { default: true });
  await addAttr('user_preferences', 'boolean', 'wfhFlexibility', { default: true });
  await addAttr('user_preferences', 'boolean', 'adaptToWeather', { default: true });
  await addAttr('user_preferences', 'boolean', 'adaptToCalendar', { default: true });
  await addAttr('user_preferences', 'string', 'officeLocation');
  await addAttr('user_preferences', 'string', 'homeLocation');
  await addAttr('user_preferences', 'string', 'currentLocation');
  console.log('✅ user_preferences attributes done\n');

  // ---- user_gear ----
  await createCollectionSafe('user_gear', 'User Gear');
  await addAttr('user_gear', 'string', 'userId', { required: true });
  await addAttr('user_gear', 'string', 'category', { required: true });
  await addAttr('user_gear', 'string', 'brand', { required: true });
  await addAttr('user_gear', 'string', 'model', { required: true });
  await addAttr('user_gear', 'string', 'specs');
  await addAttr('user_gear', 'boolean', 'isPrimary', { default: false });
  console.log('✅ user_gear attributes done\n');

  // ---- daily_challenges ----
  await createCollectionSafe('daily_challenges', 'Daily Challenges');
  await addAttr('daily_challenges', 'string', 'userId', { required: true });
  await addAttr('daily_challenges', 'string', 'challengeType', { required: true });
  await addAttr('daily_challenges', 'string', 'challengeText', { required: true, size: 5000 });
  await addAttr('daily_challenges', 'string', 'difficulty');
  await addAttr('daily_challenges', 'string', 'category');
  await addAttr('daily_challenges', 'string', 'duration');
  await addAttr('daily_challenges', 'string', 'weatherConditions');
  await addAttr('daily_challenges', 'string', 'location');
  await addAttr('daily_challenges', 'stringArray', 'recommendedGear');
  await addAttr('daily_challenges', 'string', 'tips', { size: 2000 });
  await addAttr('daily_challenges', 'string', 'issuedDate');
  await addAttr('daily_challenges', 'string', 'status', { default: 'pending' });
  await addAttr('daily_challenges', 'string', 'completedDate');
  console.log('✅ daily_challenges attributes done\n');

  // ---- challenge_submissions ----
  await createCollectionSafe('challenge_submissions', 'Challenge Submissions');
  await addAttr('challenge_submissions', 'string', 'challengeId', { required: true });
  await addAttr('challenge_submissions', 'string', 'userId', { required: true });
  await addAttr('challenge_submissions', 'string', 'photoUrl');
  await addAttr('challenge_submissions', 'string', 'notes', { size: 2000 });
  await addAttr('challenge_submissions', 'string', 'feedback', { size: 2000 });
  await addAttr('challenge_submissions', 'integer', 'rating', { min: 1, max: 5 });
  await addAttr('challenge_submissions', 'string', 'submittedAt');
  await addAttr('challenge_submissions', 'string', 'feedbackStatus', { default: 'pending' });
  console.log('✅ challenge_submissions attributes done\n');

  // ---- itineraries ----
  await createCollectionSafe('itineraries', 'Itineraries');
  await addAttr('itineraries', 'string', 'userId', { required: true });
  await addAttr('itineraries', 'string', 'location', { required: true });
  await addAttr('itineraries', 'string', 'title');
  await addAttr('itineraries', 'string', 'description', { size: 2000 });
  await addAttr('itineraries', 'string', 'spots', { size: 10000 });
  await addAttr('itineraries', 'stringArray', 'suggestedTimes');
  await addAttr('itineraries', 'string', 'weatherConditions');
  await addAttr('itineraries', 'stringArray', 'gearRecommendations');
  await addAttr('itineraries', 'string', 'duration');
  await addAttr('itineraries', 'string', 'status', { default: 'generated' });
  await addAttr('itineraries', 'string', 'generatedDate');
  await addAttr('itineraries', 'string', 'scheduledDate');
  await addAttr('itineraries', 'string', 'completedDate');
  console.log('✅ itineraries attributes done\n');

  // ---- user_progress ----
  await createCollectionSafe('user_progress', 'User Progress');
  await addAttr('user_progress', 'string', 'userId', { required: true });
  await addAttr('user_progress', 'integer', 'totalChallengesIssued', { default: 0 });
  await addAttr('user_progress', 'integer', 'totalChallengesCompleted', { default: 0 });
  await addAttr('user_progress', 'integer', 'currentStreak', { default: 0 });
  await addAttr('user_progress', 'integer', 'longestStreak', { default: 0 });
  await addAttr('user_progress', 'integer', 'saturdayChallengesCompleted', { default: 0 });
  await addAttr('user_progress', 'integer', 'saturdayChallengesIssued', { default: 0 });
  await addAttr('user_progress', 'integer', 'lunchBreakCompleted', { default: 0 });
  await addAttr('user_progress', 'integer', 'lunchBreakIssued', { default: 0 });
  await addAttr('user_progress', 'integer', 'afterWorkCompleted', { default: 0 });
  await addAttr('user_progress', 'integer', 'afterWorkIssued', { default: 0 });
  await addAttr('user_progress', 'integer', 'wfhCompleted', { default: 0 });
  await addAttr('user_progress', 'integer', 'wfhIssued', { default: 0 });
  await addAttr('user_progress', 'stringArray', 'favoriteSubjects');
  await addAttr('user_progress', 'stringArray', 'improvementAreas');
  await addAttr('user_progress', 'string', 'lastChallengeDate');
  await addAttr('user_progress', 'string', 'lastCompletionDate');
  await addAttr('user_progress', 'string', 'lastStreakUpdate');
  console.log('✅ user_progress attributes done\n');

  // ---- agent_actions ----
  await createCollectionSafe('agent_actions', 'Agent Actions');
  await addAttr('agent_actions', 'string', 'userId', { required: true });
  await addAttr('agent_actions', 'string', 'actionType', { required: true });
  await addAttr('agent_actions', 'string', 'details', { size: 5000 });
  await addAttr('agent_actions', 'boolean', 'success', { default: true });
  await addAttr('agent_actions', 'string', 'errorMessage');
  await addAttr('agent_actions', 'string', 'executedAt');
  console.log('✅ agent_actions attributes done\n');

  // ---- photo_critiques ----
  await createCollectionSafe('photo_critiques', 'Photo Critiques');
  await addAttr('photo_critiques', 'string', 'userId', { required: true });
  await addAttr('photo_critiques', 'string', 'submissionId');
  await addAttr('photo_critiques', 'string', 'photoUrl', { required: true, size: 1000 });
  await addAttr('photo_critiques', 'integer', 'technicalScore', { min: 0, max: 100 });
  await addAttr('photo_critiques', 'integer', 'compositionScore', { min: 0, max: 100 });
  await addAttr('photo_critiques', 'integer', 'creativeScore', { min: 0, max: 100 });
  await addAttr('photo_critiques', 'integer', 'overallScore', { min: 0, max: 100 });
  await addAttr('photo_critiques', 'string', 'technicalFeedback', { size: 3000 });
  await addAttr('photo_critiques', 'string', 'compositionFeedback', { size: 3000 });
  await addAttr('photo_critiques', 'string', 'creativeFeedback', { size: 3000 });
  await addAttr('photo_critiques', 'stringArray', 'strengths');
  await addAttr('photo_critiques', 'stringArray', 'improvements');
  await addAttr('photo_critiques', 'string', 'suggestedSettings', { size: 1000 });
  await addAttr('photo_critiques', 'string', 'critiqueDate');
  console.log('✅ photo_critiques attributes done\n');

  // ---- reverse_analyses ----
  await createCollectionSafe('reverse_analyses', 'Reverse Analyses');
  await addAttr('reverse_analyses', 'string', 'userId', { required: true });
  await addAttr('reverse_analyses', 'string', 'photoUrl', { required: true, size: 1000 });
  await addAttr('reverse_analyses', 'string', 'resultJson', { size: 10000 });
  await addAttr('reverse_analyses', 'string', 'analysisDate');
  console.log('✅ reverse_analyses attributes done\n');

  // ---- Storage bucket ----
  try {
    const bucket = await storage.createBucket(
      ID.unique(),
      'challenge-submissions',
      [Permission.read(Role.users()), Permission.write(Role.users())],
      false,  // fileSecurity
      true,   // enabled
      10 * 1024 * 1024, // 10MB max file size
      ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    );
    console.log(`✅ Created storage bucket: ${bucket.$id}`);
    console.log(`\n⚠️  Set APPWRITE_STORAGE_BUCKET_ID=${bucket.$id} in your .env\n`);
  } catch (e: any) {
    if (e?.code === 409) {
      console.log('⏭️  Storage bucket already exists');
    } else {
      throw e;
    }
  }

  console.log('\n🎉 Appwrite setup complete!');
  console.log('Next steps:');
  console.log('  1. Set APPWRITE_DATABASE_ID and APPWRITE_STORAGE_BUCKET_ID in your .env');
  console.log('  2. Register your first user via POST /api/auth/register');
}

setup().catch(console.error);
