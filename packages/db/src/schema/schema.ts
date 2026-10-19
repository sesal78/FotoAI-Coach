import { pgTable, pgPolicy, check, text, numeric, foreignKey, boolean, jsonb, integer, index, uniqueIndex, unique, uuid, doublePrecision, timestamp, date, bigint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { authUsers } from "drizzle-orm/supabase"

// auth.users belongs to Supabase Auth; pull leaves it out (schemaFilter: public).
// Not exported, so drizzle-kit generate never tries to create it.
const users = authUsers



export const fotoaiGearLenses = pgTable("fotoai_gear_lenses", {
	id: text().primaryKey().notNull(),
	make: text().notNull(),
	model: text().notNull(),
	mount: text(),
	focalMinMm: numeric("focal_min_mm").notNull(),
	focalMaxMm: numeric("focal_max_mm").notNull(),
	maxApertureWide: numeric("max_aperture_wide").notNull(),
	maxApertureTele: numeric("max_aperture_tele").notNull(),
	minAperture: numeric("min_aperture").notNull(),
	sources: text().array().notNull(),
}, (table) => [
	check("fotoai_gear_lenses_check", sql`focal_max_mm >= focal_min_mm`),
	check("fotoai_gear_lenses_check1", sql`max_aperture_tele >= max_aperture_wide`),
	check("fotoai_gear_lenses_check2", sql`min_aperture > max_aperture_tele`),
	check("fotoai_gear_lenses_focal_min_mm_check", sql`focal_min_mm > (0)::numeric`),
	check("fotoai_gear_lenses_max_aperture_wide_check", sql`max_aperture_wide > (0)::numeric`),
	check("fotoai_gear_lenses_sources_check", sql`cardinality(sources) > 0`),
]).enableRLS();

export const fotoaiGearBodies = pgTable("fotoai_gear_bodies", {
	id: text().primaryKey().notNull(),
	make: text().notNull(),
	model: text().notNull(),
	type: text().notNull(),
	mount: text(),
	modes: text().array().notNull(),
	shutterSlowestS: numeric("shutter_slowest_s"),
	shutterFastestS: numeric("shutter_fastest_s").notNull(),
	bulb: boolean(),
	shutterApertureLimits: jsonb("shutter_aperture_limits"),
	flashSyncS: numeric("flash_sync_s"),
	isoMin: integer("iso_min"),
	isoMax: integer("iso_max"),
	metering: text(),
	fixedLensId: text("fixed_lens_id"),
	sources: text().array().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.fixedLensId],
			foreignColumns: [fotoaiGearLenses.id],
			name: "fotoai_gear_bodies_fixed_lens_id_fkey"
		}),
	check("fotoai_gear_bodies_check", sql`(shutter_slowest_s IS NULL) OR (shutter_slowest_s > shutter_fastest_s)`),
	check("fotoai_gear_bodies_check1", sql`((iso_min IS NULL) = (iso_max IS NULL)) AND ((iso_min IS NULL) OR (iso_min <= iso_max))`),
	check("fotoai_gear_bodies_modes_check", sql`(cardinality(modes) > 0) AND (modes <@ ARRAY['P'::text, 'A'::text, 'S'::text, 'M'::text])`),
	check("fotoai_gear_bodies_shutter_fastest_s_check", sql`shutter_fastest_s > (0)::numeric`),
	check("fotoai_gear_bodies_sources_check", sql`cardinality(sources) > 0`),
	check("fotoai_gear_bodies_type_check", sql`type = ANY (ARRAY['digital'::text, 'film'::text])`),
]).enableRLS();

export const fotoaiPlaces = pgTable("fotoai_places", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	source: text().notNull(),
	placeId: text("place_id"),
	name: text(),
	lat: doublePrecision(),
	lng: doublePrecision(),
	notes: text(),
	favourite: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_places_user_created_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	uniqueIndex("fotoai_places_user_place_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.placeId.asc().nullsLast().op("text_ops")).where(sql`(place_id IS NOT NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_places_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_places_id_user_key").on(table.id, table.userId),
	check("fotoai_places_lat_check", sql`(lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)`),
	check("fotoai_places_lng_check", sql`(lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)`),
	check("fotoai_places_notes_check", sql`char_length(notes) <= 2000`),
	check("fotoai_places_source_check", sql`source = ANY (ARRAY['google'::text, 'user'::text])`),
	check("fotoai_places_source_shape_check", sql`((source = 'google'::text) AND (place_id IS NOT NULL) AND (name IS NULL) AND (lat IS NULL) AND (lng IS NULL)) OR ((source = 'user'::text) AND (place_id IS NULL) AND (name IS NOT NULL) AND ((char_length(name) >= 1) AND (char_length(name) <= 80)) AND (lat IS NOT NULL) AND (lng IS NOT NULL))`),
]).enableRLS();

export const fotoaiShootPlans = pgTable("fotoai_shoot_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	placeSource: text("place_source").notNull(),
	placeId: text("place_id"),
	spotId: uuid("spot_id"),
	planDate: date("plan_date").notNull(),
	timezone: text().notNull(),
	title: text().notNull(),
	summary: text().notNull(),
	loadout: jsonb().notNull(),
	notes: text().array().default([]).notNull(),
	promptId: text("prompt_id").notNull(),
	promptVersion: integer("prompt_version").notNull(),
	model: text().notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_shoot_plans_user_created_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId, table.spotId],
			foreignColumns: [fotoaiPlaces.id, fotoaiPlaces.userId],
			name: "fotoai_shoot_plans_spot_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_shoot_plans_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_shoot_plans_id_user_key").on(table.id, table.userId),
	check("fotoai_shoot_plans_place_check", sql`((place_source = 'google'::text) AND (place_id IS NOT NULL)) OR ((place_source = 'user'::text) AND (place_id IS NULL))`),
	check("fotoai_shoot_plans_place_source_check", sql`place_source = ANY (ARRAY['google'::text, 'user'::text])`),
	check("fotoai_shoot_plans_prompt_version_check", sql`prompt_version > 0`),
	check("fotoai_shoot_plans_status_check", sql`status = ANY (ARRAY['active'::text, 'done'::text, 'archived'::text])`),
	check("fotoai_shoot_plans_summary_check", sql`char_length(summary) <= 400`),
	check("fotoai_shoot_plans_timezone_check", sql`(char_length(timezone) >= 1) AND (char_length(timezone) <= 64)`),
	check("fotoai_shoot_plans_title_check", sql`(char_length(title) >= 1) AND (char_length(title) <= 80)`),
]).enableRLS();

export const fotoaiPlanSteps = pgTable("fotoai_plan_steps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	planId: uuid("plan_id").notNull(),
	userId: uuid("user_id").notNull(),
	position: integer().notNull(),
	title: text().notNull(),
	instruction: text().notNull(),
	tip: text(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	settings: jsonb().notNull(),
	status: text().default('todo').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.planId, table.userId],
			foreignColumns: [fotoaiShootPlans.id, fotoaiShootPlans.userId],
			name: "fotoai_plan_steps_plan_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_plan_steps_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_plan_steps_id_user_key").on(table.id, table.userId),
	unique("fotoai_plan_steps_plan_position_key").on(table.planId, table.position),
	check("fotoai_plan_steps_instruction_check", sql`(char_length(instruction) >= 1) AND (char_length(instruction) <= 600)`),
	check("fotoai_plan_steps_position_check", sql`("position" >= 1) AND ("position" <= 20)`),
	check("fotoai_plan_steps_status_check", sql`status = ANY (ARRAY['todo'::text, 'done'::text, 'skipped'::text])`),
	check("fotoai_plan_steps_tip_check", sql`char_length(tip) <= 200`),
	check("fotoai_plan_steps_title_check", sql`(char_length(title) >= 1) AND (char_length(title) <= 80)`),
]).enableRLS();

export const fotoaiFilmRolls = pgTable("fotoai_film_rolls", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	stockId: text("stock_id"),
	stockName: text("stock_name").notNull(),
	boxIso: integer("box_iso").notNull(),
	ratedIso: integer("rated_iso").notNull(),
	exposures: integer().notNull(),
	bodyGearId: uuid("body_gear_id"),
	status: text().default('loaded').notNull(),
	loadedAt: timestamp("loaded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_film_rolls_user_created_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId, table.bodyGearId],
			foreignColumns: [fotoaiUserGear.id, fotoaiUserGear.userId],
			name: "fotoai_film_rolls_body_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_film_rolls_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_film_rolls_id_user_key").on(table.id, table.userId),
	check("fotoai_film_rolls_box_iso_check", sql`box_iso > 0`),
	check("fotoai_film_rolls_exposures_check", sql`(exposures >= 1) AND (exposures <= 72)`),
	check("fotoai_film_rolls_notes_check", sql`char_length(notes) <= 2000`),
	check("fotoai_film_rolls_rated_iso_check", sql`rated_iso > 0`),
	check("fotoai_film_rolls_status_check", sql`status = ANY (ARRAY['loaded'::text, 'finished'::text, 'developed'::text, 'scanned'::text])`),
	check("fotoai_film_rolls_stock_id_check", sql`stock_id ~ '^[a-z0-9-]{1,60}$'::text`),
	check("fotoai_film_rolls_stock_name_check", sql`(char_length(stock_name) >= 1) AND (char_length(stock_name) <= 60)`),
]).enableRLS();

export const fotoaiFilmFrames = pgTable("fotoai_film_frames", {
	id: uuid().primaryKey().notNull(),
	rollId: uuid("roll_id").notNull(),
	userId: uuid("user_id").notNull(),
	frameNo: integer("frame_no").notNull(),
	settings: jsonb().notNull(),
	lensGearId: uuid("lens_gear_id"),
	stepId: uuid("step_id"),
	lat: doublePrecision(),
	lng: doublePrecision(),
	note: text(),
	shotAt: timestamp("shot_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_film_frames_step_idx").using("btree", table.stepId.asc().nullsLast().op("uuid_ops")).where(sql`(step_id IS NOT NULL)`),
	foreignKey({
			columns: [table.userId, table.lensGearId],
			foreignColumns: [fotoaiUserGear.id, fotoaiUserGear.userId],
			name: "fotoai_film_frames_lens_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.rollId, table.userId],
			foreignColumns: [fotoaiFilmRolls.id, fotoaiFilmRolls.userId],
			name: "fotoai_film_frames_roll_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId, table.stepId],
			foreignColumns: [fotoaiPlanSteps.id, fotoaiPlanSteps.userId],
			name: "fotoai_film_frames_step_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_film_frames_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_film_frames_id_user_key").on(table.id, table.userId),
	unique("fotoai_film_frames_roll_frame_key").on(table.rollId, table.frameNo),
	check("fotoai_film_frames_frame_no_check", sql`(frame_no >= 1) AND (frame_no <= 74)`),
	check("fotoai_film_frames_lat_check", sql`(lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)`),
	check("fotoai_film_frames_lng_check", sql`(lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)`),
	check("fotoai_film_frames_note_check", sql`char_length(note) <= 500`),
]).enableRLS();

export const fotoaiPhotos = pgTable("fotoai_photos", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	source: text().notNull(),
	objectKey: text("object_key").notNull(),
	mime: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bytes: bigint({ mode: "number" }).notNull(),
	status: text().default('pending').notNull(),
	takenAt: timestamp("taken_at", { withTimezone: true, mode: 'string' }),
	takenOffset: text("taken_offset"),
	cameraMake: text("camera_make"),
	cameraModel: text("camera_model"),
	lensModel: text("lens_model"),
	focalMm: numeric("focal_mm"),
	aperture: numeric(),
	shutterS: numeric("shutter_s"),
	iso: integer(),
	lat: doublePrecision(),
	lng: doublePrecision(),
	stepId: uuid("step_id"),
	frameId: uuid("frame_id"),
	rollId: uuid("roll_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fotoai_photos_step_idx").using("btree", table.stepId.asc().nullsLast().op("uuid_ops")).where(sql`(step_id IS NOT NULL)`),
	index("fotoai_photos_user_created_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.userId, table.frameId],
			foreignColumns: [fotoaiFilmFrames.id, fotoaiFilmFrames.userId],
			name: "fotoai_photos_frame_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId, table.rollId],
			foreignColumns: [fotoaiFilmRolls.id, fotoaiFilmRolls.userId],
			name: "fotoai_photos_roll_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId, table.stepId],
			foreignColumns: [fotoaiPlanSteps.id, fotoaiPlanSteps.userId],
			name: "fotoai_photos_step_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_photos_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_photos_object_key_key").on(table.objectKey),
	check("fotoai_photos_aperture_check", sql`aperture > (0)::numeric`),
	check("fotoai_photos_bytes_check", sql`(bytes >= 1) AND (bytes <= 52428800)`),
	check("fotoai_photos_camera_make_check", sql`char_length(camera_make) <= 80`),
	check("fotoai_photos_camera_model_check", sql`char_length(camera_model) <= 80`),
	check("fotoai_photos_focal_mm_check", sql`focal_mm > (0)::numeric`),
	check("fotoai_photos_iso_check", sql`iso > 0`),
	check("fotoai_photos_lat_check", sql`(lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)`),
	check("fotoai_photos_lens_model_check", sql`char_length(lens_model) <= 80`),
	check("fotoai_photos_lng_check", sql`(lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)`),
	check("fotoai_photos_mime_check", sql`(char_length(mime) >= 3) AND (char_length(mime) <= 80)`),
	check("fotoai_photos_object_key_check", sql`object_key ~ (((('^'::text || (user_id)::text) || '/photos/'::text) || (id)::text) || '/[a-z0-9-]+\\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$'::text)`),
	check("fotoai_photos_shutter_s_check", sql`shutter_s > (0)::numeric`),
	check("fotoai_photos_source_check", sql`source = ANY (ARRAY['gallery'::text, 'scan'::text, 'camera'::text])`),
	check("fotoai_photos_status_check", sql`status = ANY (ARRAY['pending'::text, 'ready'::text])`),
	check("fotoai_photos_taken_offset_check", sql`taken_offset ~ '^[+-][0-9]{2}:[0-9]{2}$'::text`),
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
	bodyId: text("body_id"),
	lensId: text("lens_id"),
	custom: jsonb(),
}, (table) => [
	index("fotoai_user_gear_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.bodyId],
			foreignColumns: [fotoaiGearBodies.id],
			name: "fotoai_user_gear_body_id_fkey"
		}),
	foreignKey({
			columns: [table.lensId],
			foreignColumns: [fotoaiGearLenses.id],
			name: "fotoai_user_gear_lens_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_user_gear_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_user_gear_id_user_key").on(table.id, table.userId),
	unique("fotoai_user_gear_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_user_gear_one_link_check", sql`num_nonnulls(body_id, lens_id, custom) <= 1`),
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
	theme: text().default('golden').notNull(),
	units: text().default('metric').notNull(),
	homeLat: doublePrecision("home_lat"),
	homeLng: doublePrecision("home_lng"),
	loadout: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_user_preferences_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_user_preferences_user_id_key").on(table.userId),
	unique("fotoai_user_preferences_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_user_preferences_home_lat_check", sql`(home_lat IS NULL) OR ((home_lat >= ('-90'::integer)::double precision) AND (home_lat <= (90)::double precision))`),
	check("fotoai_user_preferences_home_lng_check", sql`(home_lng IS NULL) OR ((home_lng >= ('-180'::integer)::double precision) AND (home_lng <= (180)::double precision))`),
	check("fotoai_user_preferences_home_pair_check", sql`(home_lat IS NULL) = (home_lng IS NULL)`),
	check("fotoai_user_preferences_skill_level_check", sql`skill_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'professional'::text])`),
	check("fotoai_user_preferences_theme_check", sql`theme = ANY (ARRAY['golden'::text, 'golden_dark'::text, 'camera'::text])`),
	check("fotoai_user_preferences_units_check", sql`units = ANY (ARRAY['metric'::text, 'imperial'::text])`),
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
	source: text().default('dashboard').notNull(),
}, (table) => [
	index("fotoai_daily_challenges_user_issued_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.issuedDate.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fotoai_daily_challenges_user_id_fkey"
		}).onDelete("cascade"),
	unique("fotoai_daily_challenges_id_user_key").on(table.id, table.userId),
	unique("fotoai_daily_challenges_legacy_appwrite_id_key").on(table.legacyAppwriteId),
	check("fotoai_daily_challenges_source_check", sql`source = ANY (ARRAY['dashboard'::text, 'chat'::text, 'plan'::text, 'job'::text])`),
	check("fotoai_daily_challenges_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'skipped'::text, 'completed'::text, 'superseded'::text])`),
	check("fotoai_daily_challenges_technical_level_check", sql`(technical_level >= 1) AND (technical_level <= 5)`),
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
	check("fotoai_xp_events_source_kind_check", sql`source_kind = ANY (ARRAY['challenge_complete'::text, 'submission'::text, 'critique_bonus'::text, 'plan_step'::text])`),
	check("fotoai_xp_events_xp_amount_check", sql`xp_amount > 0`),
]).enableRLS();
