import { pgTable, foreignKey, unique, pgPolicy, check, uuid, text, boolean, timestamp, index, integer, bigint, jsonb, date, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { authUsers } from "drizzle-orm/supabase"

// auth.users belongs to Supabase Auth; pull leaves it out (schemaFilter: public).
// Not exported, so drizzle-kit generate never tries to create it.
const users = authUsers



export const fotoaiUserPreferences = pgTable("fotoai_user_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	skillLevel: text("skill_level").default('intermediate').notNull(),
	photographyInterests: text("photography_interests").array().default([]).notNull(),
	avoidsStyles: text("avoids_styles").array().default([]).notNull(),
	workDays: text("work_days").array().default([]).notNull(),
	workStartTime: text("work_start_time").default('09:00').notNull(),
	workEndTime: text("work_end_time").default('17:00').notNull(),
	lunchStartTime: text("lunch_start_time").default('12:00').notNull(),
	lunchEndTime: text("lunch_end_time").default('13:00').notNull(),
	primaryPhotoDay: text("primary_photo_day").default('Saturday').notNull(),
	secondaryPhotoDays: text("secondary_photo_days").array().default([]).notNull(),
	lunchBreakPhotography: boolean("lunch_break_photography").default(true).notNull(),
	eveningPhotography: boolean("evening_photography").default(true).notNull(),
	wfhFlexibility: boolean("wfh_flexibility").default(true).notNull(),
	adaptToWeather: boolean("adapt_to_weather").default(true).notNull(),
	adaptToCalendar: boolean("adapt_to_calendar").default(true).notNull(),
	officeLocation: text("office_location"),
	homeLocation: text("home_location"),
	currentLocation: text("current_location"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_user_preferences_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_user_preferences_user_id_key").on(table.userId),
	unique("fotoai_user_preferences_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_user_preferences_skill_level_check", sql`skill_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'professional'::text])`),
]).enableRLS();

export const fotoaiUserGear = pgTable("fotoai_user_gear", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	category: text().notNull(),
	brand: text().notNull(),
	model: text().notNull(),
	specs: text(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_user_gear_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_user_gear_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_user_gear_legacy_appwrite_id_key").on(table.legacyAppwriteId),
]).enableRLS();

export const fotoaiDailyChallenges = pgTable("fotoai_daily_challenges", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	challengeType: text("challenge_type").notNull(),
	challengeText: text("challenge_text").notNull(),
	difficulty: text(),
	category: text(),
	duration: text(),
	weatherConditions: text("weather_conditions"),
	location: text(),
	recommendedGear: text("recommended_gear").array().default([]).notNull(),
	tips: text(),
	issuedDate: timestamp("issued_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: text().default('pending').notNull(),
	completedDate: timestamp("completed_date", { withTimezone: true, mode: 'string' }),
	shotList: text("shot_list").array().default([]).notNull(),
	narrativeContext: text("narrative_context"),
	editingDirection: text("editing_direction"),
	masteryArea: text("mastery_area"),
	technicalLevel: integer("technical_level"),
	successCriteria: text("success_criteria"),
	whatToLookFor: text("what_to_look_for"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_daily_challenges_user_issued_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.issuedDate.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_daily_challenges_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_daily_challenges_id_user_key").on(table.id, table.userId),
	unique("fotoai_daily_challenges_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_daily_challenges_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'skipped'::text, 'completed'::text])`),
	check("fotoai_daily_challenges_technical_level_check", sql`(technical_level >= 1) AND (technical_level <= 5)`),
]).enableRLS();

export const fotoaiChallengeSubmissions = pgTable("fotoai_challenge_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	challengeId: uuid("challenge_id").notNull(),
	photoObjectKey: text("photo_object_key"),
	photoMime: text("photo_mime"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	photoBytes: bigint("photo_bytes", { mode: "number" }),
	notes: text().default('').notNull(),
	feedback: text(),
	rating: integer(),
	feedbackStatus: text("feedback_status").default('pending').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_challenge_submissions_challenge_idx").using("btree", table.challengeId.asc().nullsLast().op("uuid_ops")),
	index("fotoai_challenge_submissions_user_submitted_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.submittedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId, table.challengeId],
			foreignColumns: [fotoaiDailyChallenges.id, fotoaiDailyChallenges.userId],
			name: "fotoai_challenge_submissions_challenge_owner_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_challenge_submissions_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_challenge_submissions_id_user_key").on(table.id, table.userId),
	unique("fotoai_challenge_submissions_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_challenge_submissions_check", sql`(photo_object_key IS NULL) OR ((photo_object_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]+\\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$'::text) AND (split_part(photo_object_key, '/'::text, 1) = (user_id)::text))`),
	check("fotoai_challenge_submissions_feedback_status_check", sql`feedback_status = ANY (ARRAY['pending'::text, 'ready'::text])`),
	check("fotoai_challenge_submissions_photo_bytes_check", sql`(photo_bytes IS NULL) OR ((photo_bytes >= 1) AND (photo_bytes <= 52428800))`),
	check("fotoai_challenge_submissions_rating_check", sql`(rating IS NULL) OR ((rating >= 1) AND (rating <= 5))`),
]).enableRLS();

export const fotoaiItineraries = pgTable("fotoai_itineraries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	location: text().notNull(),
	title: text(),
	description: text(),
	spots: jsonb().default([]).notNull(),
	suggestedTimes: text("suggested_times").array().default([]).notNull(),
	weatherConditions: text("weather_conditions"),
	gearRecommendations: text("gear_recommendations").array().default([]).notNull(),
	duration: text(),
	status: text().default('generated').notNull(),
	generatedDate: timestamp("generated_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	scheduledDate: timestamp("scheduled_date", { withTimezone: true, mode: 'string' }),
	completedDate: timestamp("completed_date", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_itineraries_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_itineraries_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_itineraries_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_itineraries_status_check", sql`status = ANY (ARRAY['generated'::text, 'scheduled'::text, 'completed'::text])`),
]).enableRLS();

export const fotoaiUserProgress = pgTable("fotoai_user_progress", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	totalChallengesIssued: integer("total_challenges_issued").default(0).notNull(),
	totalChallengesCompleted: integer("total_challenges_completed").default(0).notNull(),
	currentStreak: integer("current_streak").default(0).notNull(),
	longestStreak: integer("longest_streak").default(0).notNull(),
	saturdayChallengesCompleted: integer("saturday_challenges_completed").default(0).notNull(),
	saturdayChallengesIssued: integer("saturday_challenges_issued").default(0).notNull(),
	lunchBreakCompleted: integer("lunch_break_completed").default(0).notNull(),
	lunchBreakIssued: integer("lunch_break_issued").default(0).notNull(),
	afterWorkCompleted: integer("after_work_completed").default(0).notNull(),
	afterWorkIssued: integer("after_work_issued").default(0).notNull(),
	wfhCompleted: integer("wfh_completed").default(0).notNull(),
	wfhIssued: integer("wfh_issued").default(0).notNull(),
	favoriteSubjects: text("favorite_subjects").array().default([]).notNull(),
	improvementAreas: text("improvement_areas").array().default([]).notNull(),
	lastChallengeDate: timestamp("last_challenge_date", { withTimezone: true, mode: 'string' }),
	lastCompletionDate: timestamp("last_completion_date", { withTimezone: true, mode: 'string' }),
	lastStreakUpdate: timestamp("last_streak_update", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_user_progress_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_user_progress_user_id_key").on(table.userId),
	unique("fotoai_user_progress_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_user_progress_after_work_completed_check", sql`after_work_completed >= 0`),
	check("fotoai_user_progress_after_work_issued_check", sql`after_work_issued >= 0`),
	check("fotoai_user_progress_current_streak_check", sql`current_streak >= 0`),
	check("fotoai_user_progress_longest_streak_check", sql`longest_streak >= 0`),
	check("fotoai_user_progress_lunch_break_completed_check", sql`lunch_break_completed >= 0`),
	check("fotoai_user_progress_lunch_break_issued_check", sql`lunch_break_issued >= 0`),
	check("fotoai_user_progress_saturday_challenges_completed_check", sql`saturday_challenges_completed >= 0`),
	check("fotoai_user_progress_saturday_challenges_issued_check", sql`saturday_challenges_issued >= 0`),
	check("fotoai_user_progress_total_challenges_completed_check", sql`total_challenges_completed >= 0`),
	check("fotoai_user_progress_total_challenges_issued_check", sql`total_challenges_issued >= 0`),
	check("fotoai_user_progress_wfh_completed_check", sql`wfh_completed >= 0`),
	check("fotoai_user_progress_wfh_issued_check", sql`wfh_issued >= 0`),
]).enableRLS();

export const fotoaiAgentActions = pgTable("fotoai_agent_actions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	actionType: text("action_type").notNull(),
	details: jsonb().default({}).notNull(),
	success: boolean().default(true).notNull(),
	errorMessage: text("error_message"),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_agent_actions_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.executedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_agent_actions_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_agent_actions_legacy_appwrite_id_key").on(table.legacyAppwriteId),
]).enableRLS();

export const fotoaiPhotoCritiques = pgTable("fotoai_photo_critiques", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	submissionId: uuid("submission_id"),
	photoObjectKey: text("photo_object_key").notNull(),
	technicalScore: integer("technical_score"),
	compositionScore: integer("composition_score"),
	creativeScore: integer("creative_score"),
	overallScore: integer("overall_score"),
	technicalFeedback: text("technical_feedback"),
	compositionFeedback: text("composition_feedback"),
	creativeFeedback: text("creative_feedback"),
	strengths: text().array().default([]).notNull(),
	improvements: text().array().default([]).notNull(),
	suggestedSettings: text("suggested_settings"),
	critiqueDate: timestamp("critique_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_photo_critiques_submission_idx").using("btree", table.submissionId.asc().nullsLast().op("uuid_ops")),
	index("fotoai_photo_critiques_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.critiqueDate.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId, table.submissionId],
			foreignColumns: [fotoaiChallengeSubmissions.id, fotoaiChallengeSubmissions.userId],
			name: "fotoai_photo_critiques_submission_owner_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_photo_critiques_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_photo_critiques_id_user_key").on(table.id, table.userId),
	unique("fotoai_photo_critiques_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_photo_critiques_check", sql`split_part(photo_object_key, '/'::text, 1) = (user_id)::text`),
	check("fotoai_photo_critiques_composition_score_check", sql`(composition_score >= 0) AND (composition_score <= 100)`),
	check("fotoai_photo_critiques_creative_score_check", sql`(creative_score >= 0) AND (creative_score <= 100)`),
	check("fotoai_photo_critiques_overall_score_check", sql`(overall_score >= 0) AND (overall_score <= 100)`),
	check("fotoai_photo_critiques_technical_score_check", sql`(technical_score >= 0) AND (technical_score <= 100)`),
]).enableRLS();

export const fotoaiReverseAnalyses = pgTable("fotoai_reverse_analyses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	photoObjectKey: text("photo_object_key").notNull(),
	result: jsonb().default({}).notNull(),
	analysisDate: timestamp("analysis_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_reverse_analyses_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.analysisDate.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_reverse_analyses_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_reverse_analyses_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_reverse_analyses_check", sql`split_part(photo_object_key, '/'::text, 1) = (user_id)::text`),
]).enableRLS();

export const fotoaiEditingRecipes = pgTable("fotoai_editing_recipes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	originalPhotoObjectKey: text("original_photo_object_key"),
	editedPhotoObjectKey: text("edited_photo_object_key"),
	recipe: jsonb().default({}).notNull(),
	analysisDate: timestamp("analysis_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_editing_recipes_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.analysisDate.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_editing_recipes_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_editing_recipes_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_editing_recipes_check", sql`(original_photo_object_key IS NULL) OR (split_part(original_photo_object_key, '/'::text, 1) = (user_id)::text)`),
	check("fotoai_editing_recipes_check1", sql`(edited_photo_object_key IS NULL) OR (split_part(edited_photo_object_key, '/'::text, 1) = (user_id)::text)`),
]).enableRLS();

export const fotoaiWeeklyReports = pgTable("fotoai_weekly_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	weekStart: date("week_start").notNull(),
	weekEnd: date("week_end").notNull(),
	stats: jsonb().default({}).notNull(),
	insights: jsonb().default({}).notNull(),
	reportDate: timestamp("report_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_weekly_reports_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_weekly_reports_user_week_key").on(table.userId, table.weekStart),
	unique("fotoai_weekly_reports_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_weekly_reports_check", sql`week_end >= week_start`),
]).enableRLS();

export const fotoaiPortfolioAnalyses = pgTable("fotoai_portfolio_analyses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	photoCount: integer("photo_count").notNull(),
	analysis: jsonb().default({}).notNull(),
	analysisDate: timestamp("analysis_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_portfolio_analyses_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.analysisDate.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_portfolio_analyses_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_portfolio_analyses_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_portfolio_analyses_photo_count_check", sql`photo_count > 0`),
]).enableRLS();

export const fotoaiUserSkills = pgTable("fotoai_user_skills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	skillId: text("skill_id").notNull(),
	currentXp: integer("current_xp").default(0).notNull(),
	status: text().default('available').notNull(),
	lastXpDate: timestamp("last_xp_date", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_user_skills_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_user_skills_user_skill_key").on(table.userId, table.skillId),
	unique("fotoai_user_skills_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_user_skills_current_xp_check", sql`current_xp >= 0`),
	check("fotoai_user_skills_status_check", sql`status = ANY (ARRAY['locked'::text, 'available'::text, 'learned'::text, 'practiced'::text, 'mastered'::text])`),
]).enableRLS();

export const fotoaiXpEvents = pgTable("fotoai_xp_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	legacyAppwriteId: text("legacy_appwrite_id"),
	skillId: text("skill_id").notNull(),
	xpAmount: integer("xp_amount").notNull(),
	sourceKind: text("source_kind").notNull(),
	sourceId: uuid("source_id"),
	awardedAt: timestamp("awarded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("fotoai_xp_events_dedupe_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.skillId.asc().nullsLast().op("text_ops"), table.sourceKind.asc().nullsLast().op("text_ops"), table.sourceId.asc().nullsLast().op("text_ops")).where(sql`(source_id IS NOT NULL)`),
	index("fotoai_xp_events_user_awarded_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.awardedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_xp_events_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_xp_events_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_xp_events_source_kind_check", sql`source_kind = ANY (ARRAY['challenge_complete'::text, 'submission'::text, 'critique_bonus'::text])`),
	check("fotoai_xp_events_xp_amount_check", sql`xp_amount > 0`),
]).enableRLS();
