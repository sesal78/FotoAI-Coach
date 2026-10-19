-- Baseline only. Already applied by supabase/migrations (2026101700000{1,2,3} + later root migrations). Never apply this file.
-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "fotoai_gear_lenses" (
	"id" text PRIMARY KEY NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"mount" text,
	"focal_min_mm" numeric NOT NULL,
	"focal_max_mm" numeric NOT NULL,
	"max_aperture_wide" numeric NOT NULL,
	"max_aperture_tele" numeric NOT NULL,
	"min_aperture" numeric NOT NULL,
	"sources" text[] NOT NULL,
	CONSTRAINT "fotoai_gear_lenses_check" CHECK (focal_max_mm >= focal_min_mm),
	CONSTRAINT "fotoai_gear_lenses_check1" CHECK (max_aperture_tele >= max_aperture_wide),
	CONSTRAINT "fotoai_gear_lenses_check2" CHECK (min_aperture > max_aperture_tele),
	CONSTRAINT "fotoai_gear_lenses_focal_min_mm_check" CHECK (focal_min_mm > (0)::numeric),
	CONSTRAINT "fotoai_gear_lenses_max_aperture_wide_check" CHECK (max_aperture_wide > (0)::numeric),
	CONSTRAINT "fotoai_gear_lenses_sources_check" CHECK (cardinality(sources) > 0)
);
--> statement-breakpoint
ALTER TABLE "fotoai_gear_lenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_gear_bodies" (
	"id" text PRIMARY KEY NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"type" text NOT NULL,
	"mount" text,
	"modes" text[] NOT NULL,
	"shutter_slowest_s" numeric,
	"shutter_fastest_s" numeric NOT NULL,
	"bulb" boolean,
	"shutter_aperture_limits" jsonb,
	"flash_sync_s" numeric,
	"iso_min" integer,
	"iso_max" integer,
	"metering" text,
	"fixed_lens_id" text,
	"sources" text[] NOT NULL,
	CONSTRAINT "fotoai_gear_bodies_check" CHECK ((shutter_slowest_s IS NULL) OR (shutter_slowest_s > shutter_fastest_s)),
	CONSTRAINT "fotoai_gear_bodies_check1" CHECK (((iso_min IS NULL) = (iso_max IS NULL)) AND ((iso_min IS NULL) OR (iso_min <= iso_max))),
	CONSTRAINT "fotoai_gear_bodies_modes_check" CHECK ((cardinality(modes) > 0) AND (modes <@ ARRAY['P'::text, 'A'::text, 'S'::text, 'M'::text])),
	CONSTRAINT "fotoai_gear_bodies_shutter_fastest_s_check" CHECK (shutter_fastest_s > (0)::numeric),
	CONSTRAINT "fotoai_gear_bodies_sources_check" CHECK (cardinality(sources) > 0),
	CONSTRAINT "fotoai_gear_bodies_type_check" CHECK (type = ANY (ARRAY['digital'::text, 'film'::text]))
);
--> statement-breakpoint
ALTER TABLE "fotoai_gear_bodies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"place_id" text,
	"name" text,
	"lat" double precision,
	"lng" double precision,
	"notes" text,
	"favourite" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_places_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_places_lat_check" CHECK ((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)),
	CONSTRAINT "fotoai_places_lng_check" CHECK ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)),
	CONSTRAINT "fotoai_places_notes_check" CHECK (char_length(notes) <= 2000),
	CONSTRAINT "fotoai_places_source_check" CHECK (source = ANY (ARRAY['google'::text, 'user'::text])),
	CONSTRAINT "fotoai_places_source_shape_check" CHECK (((source = 'google'::text) AND (place_id IS NOT NULL) AND (name IS NULL) AND (lat IS NULL) AND (lng IS NULL)) OR ((source = 'user'::text) AND (place_id IS NULL) AND (name IS NOT NULL) AND ((char_length(name) >= 1) AND (char_length(name) <= 80)) AND (lat IS NOT NULL) AND (lng IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "fotoai_places" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_shoot_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_source" text NOT NULL,
	"place_id" text,
	"spot_id" uuid,
	"plan_date" date NOT NULL,
	"timezone" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"loadout" jsonb NOT NULL,
	"notes" text[] DEFAULT '{""}' NOT NULL,
	"prompt_id" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_shoot_plans_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_shoot_plans_place_check" CHECK (((place_source = 'google'::text) AND (place_id IS NOT NULL)) OR ((place_source = 'user'::text) AND (place_id IS NULL))),
	CONSTRAINT "fotoai_shoot_plans_place_source_check" CHECK (place_source = ANY (ARRAY['google'::text, 'user'::text])),
	CONSTRAINT "fotoai_shoot_plans_prompt_version_check" CHECK (prompt_version > 0),
	CONSTRAINT "fotoai_shoot_plans_status_check" CHECK (status = ANY (ARRAY['active'::text, 'done'::text, 'archived'::text])),
	CONSTRAINT "fotoai_shoot_plans_summary_check" CHECK (char_length(summary) <= 400),
	CONSTRAINT "fotoai_shoot_plans_timezone_check" CHECK ((char_length(timezone) >= 1) AND (char_length(timezone) <= 64)),
	CONSTRAINT "fotoai_shoot_plans_title_check" CHECK ((char_length(title) >= 1) AND (char_length(title) <= 80))
);
--> statement-breakpoint
ALTER TABLE "fotoai_shoot_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_plan_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"tip" text,
	"starts_at" timestamp with time zone,
	"settings" jsonb NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_plan_steps_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_plan_steps_plan_position_key" UNIQUE("plan_id","position"),
	CONSTRAINT "fotoai_plan_steps_instruction_check" CHECK ((char_length(instruction) >= 1) AND (char_length(instruction) <= 600)),
	CONSTRAINT "fotoai_plan_steps_position_check" CHECK (("position" >= 1) AND ("position" <= 20)),
	CONSTRAINT "fotoai_plan_steps_status_check" CHECK (status = ANY (ARRAY['todo'::text, 'done'::text, 'skipped'::text])),
	CONSTRAINT "fotoai_plan_steps_tip_check" CHECK (char_length(tip) <= 200),
	CONSTRAINT "fotoai_plan_steps_title_check" CHECK ((char_length(title) >= 1) AND (char_length(title) <= 80))
);
--> statement-breakpoint
ALTER TABLE "fotoai_plan_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_film_rolls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"stock_id" text,
	"stock_name" text NOT NULL,
	"box_iso" integer NOT NULL,
	"rated_iso" integer NOT NULL,
	"exposures" integer NOT NULL,
	"body_gear_id" uuid,
	"status" text DEFAULT 'loaded' NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_film_rolls_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_film_rolls_box_iso_check" CHECK (box_iso > 0),
	CONSTRAINT "fotoai_film_rolls_exposures_check" CHECK ((exposures >= 1) AND (exposures <= 72)),
	CONSTRAINT "fotoai_film_rolls_notes_check" CHECK (char_length(notes) <= 2000),
	CONSTRAINT "fotoai_film_rolls_rated_iso_check" CHECK (rated_iso > 0),
	CONSTRAINT "fotoai_film_rolls_status_check" CHECK (status = ANY (ARRAY['loaded'::text, 'finished'::text, 'developed'::text, 'scanned'::text])),
	CONSTRAINT "fotoai_film_rolls_stock_id_check" CHECK (stock_id ~ '^[a-z0-9-]{1,60}$'::text),
	CONSTRAINT "fotoai_film_rolls_stock_name_check" CHECK ((char_length(stock_name) >= 1) AND (char_length(stock_name) <= 60))
);
--> statement-breakpoint
ALTER TABLE "fotoai_film_rolls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_film_frames" (
	"id" uuid PRIMARY KEY NOT NULL,
	"roll_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"frame_no" integer NOT NULL,
	"settings" jsonb NOT NULL,
	"lens_gear_id" uuid,
	"step_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"note" text,
	"shot_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_film_frames_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_film_frames_roll_frame_key" UNIQUE("roll_id","frame_no"),
	CONSTRAINT "fotoai_film_frames_frame_no_check" CHECK ((frame_no >= 1) AND (frame_no <= 74)),
	CONSTRAINT "fotoai_film_frames_lat_check" CHECK ((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)),
	CONSTRAINT "fotoai_film_frames_lng_check" CHECK ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)),
	CONSTRAINT "fotoai_film_frames_note_check" CHECK (char_length(note) <= 500)
);
--> statement-breakpoint
ALTER TABLE "fotoai_film_frames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"taken_at" timestamp with time zone,
	"taken_offset" text,
	"camera_make" text,
	"camera_model" text,
	"lens_model" text,
	"focal_mm" numeric,
	"aperture" numeric,
	"shutter_s" numeric,
	"iso" integer,
	"lat" double precision,
	"lng" double precision,
	"step_id" uuid,
	"frame_id" uuid,
	"roll_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_photos_object_key_key" UNIQUE("object_key"),
	CONSTRAINT "fotoai_photos_aperture_check" CHECK (aperture > (0)::numeric),
	CONSTRAINT "fotoai_photos_bytes_check" CHECK ((bytes >= 1) AND (bytes <= 52428800)),
	CONSTRAINT "fotoai_photos_camera_make_check" CHECK (char_length(camera_make) <= 80),
	CONSTRAINT "fotoai_photos_camera_model_check" CHECK (char_length(camera_model) <= 80),
	CONSTRAINT "fotoai_photos_focal_mm_check" CHECK (focal_mm > (0)::numeric),
	CONSTRAINT "fotoai_photos_iso_check" CHECK (iso > 0),
	CONSTRAINT "fotoai_photos_lat_check" CHECK ((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)),
	CONSTRAINT "fotoai_photos_lens_model_check" CHECK (char_length(lens_model) <= 80),
	CONSTRAINT "fotoai_photos_lng_check" CHECK ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)),
	CONSTRAINT "fotoai_photos_mime_check" CHECK ((char_length(mime) >= 3) AND (char_length(mime) <= 80)),
	CONSTRAINT "fotoai_photos_object_key_check" CHECK (object_key ~ (((('^'::text || (user_id)::text) || '/photos/'::text) || (id)::text) || '/[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$'::text)),
	CONSTRAINT "fotoai_photos_shutter_s_check" CHECK (shutter_s > (0)::numeric),
	CONSTRAINT "fotoai_photos_source_check" CHECK (source = ANY (ARRAY['gallery'::text, 'scan'::text, 'camera'::text])),
	CONSTRAINT "fotoai_photos_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'ready'::text])),
	CONSTRAINT "fotoai_photos_taken_offset_check" CHECK (taken_offset ~ '^[+-][0-9]{2}:[0-9]{2}$'::text)
);
--> statement-breakpoint
ALTER TABLE "fotoai_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_user_gear" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"category" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"specs" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body_id" text,
	"lens_id" text,
	"custom" jsonb,
	CONSTRAINT "fotoai_user_gear_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_user_gear_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_user_gear_one_link_check" CHECK (num_nonnulls(body_id, lens_id, custom) <= 1)
);
--> statement-breakpoint
ALTER TABLE "fotoai_user_gear" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_challenge_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"challenge_id" uuid NOT NULL,
	"photo_object_key" text,
	"photo_mime" text,
	"photo_bytes" bigint,
	"notes" text DEFAULT '' NOT NULL,
	"feedback" text,
	"rating" integer,
	"feedback_status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_challenge_submissions_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_challenge_submissions_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_challenge_submissions_check" CHECK ((photo_object_key IS NULL) OR ((photo_object_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|raw)$'::text) AND (split_part(photo_object_key, '/'::text, 1) = (user_id)::text))),
	CONSTRAINT "fotoai_challenge_submissions_feedback_status_check" CHECK (feedback_status = ANY (ARRAY['pending'::text, 'ready'::text])),
	CONSTRAINT "fotoai_challenge_submissions_photo_bytes_check" CHECK ((photo_bytes IS NULL) OR ((photo_bytes >= 1) AND (photo_bytes <= 52428800))),
	CONSTRAINT "fotoai_challenge_submissions_rating_check" CHECK ((rating IS NULL) OR ((rating >= 1) AND (rating <= 5)))
);
--> statement-breakpoint
ALTER TABLE "fotoai_challenge_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_itineraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"location" text NOT NULL,
	"title" text,
	"description" text,
	"spots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_times" text[] DEFAULT '{""}' NOT NULL,
	"weather_conditions" text,
	"gear_recommendations" text[] DEFAULT '{""}' NOT NULL,
	"duration" text,
	"status" text DEFAULT 'generated' NOT NULL,
	"generated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_date" timestamp with time zone,
	"completed_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_itineraries_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_itineraries_status_check" CHECK (status = ANY (ARRAY['generated'::text, 'scheduled'::text, 'completed'::text]))
);
--> statement-breakpoint
ALTER TABLE "fotoai_itineraries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"total_challenges_issued" integer DEFAULT 0 NOT NULL,
	"total_challenges_completed" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"saturday_challenges_completed" integer DEFAULT 0 NOT NULL,
	"saturday_challenges_issued" integer DEFAULT 0 NOT NULL,
	"lunch_break_completed" integer DEFAULT 0 NOT NULL,
	"lunch_break_issued" integer DEFAULT 0 NOT NULL,
	"after_work_completed" integer DEFAULT 0 NOT NULL,
	"after_work_issued" integer DEFAULT 0 NOT NULL,
	"wfh_completed" integer DEFAULT 0 NOT NULL,
	"wfh_issued" integer DEFAULT 0 NOT NULL,
	"favorite_subjects" text[] DEFAULT '{""}' NOT NULL,
	"improvement_areas" text[] DEFAULT '{""}' NOT NULL,
	"last_challenge_date" timestamp with time zone,
	"last_completion_date" timestamp with time zone,
	"last_streak_update" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "fotoai_user_progress_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "fotoai_user_progress_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_user_progress_after_work_completed_check" CHECK (after_work_completed >= 0),
	CONSTRAINT "fotoai_user_progress_after_work_issued_check" CHECK (after_work_issued >= 0),
	CONSTRAINT "fotoai_user_progress_current_streak_check" CHECK (current_streak >= 0),
	CONSTRAINT "fotoai_user_progress_longest_streak_check" CHECK (longest_streak >= 0),
	CONSTRAINT "fotoai_user_progress_lunch_break_completed_check" CHECK (lunch_break_completed >= 0),
	CONSTRAINT "fotoai_user_progress_lunch_break_issued_check" CHECK (lunch_break_issued >= 0),
	CONSTRAINT "fotoai_user_progress_saturday_challenges_completed_check" CHECK (saturday_challenges_completed >= 0),
	CONSTRAINT "fotoai_user_progress_saturday_challenges_issued_check" CHECK (saturday_challenges_issued >= 0),
	CONSTRAINT "fotoai_user_progress_total_challenges_completed_check" CHECK (total_challenges_completed >= 0),
	CONSTRAINT "fotoai_user_progress_total_challenges_issued_check" CHECK (total_challenges_issued >= 0),
	CONSTRAINT "fotoai_user_progress_wfh_completed_check" CHECK (wfh_completed >= 0),
	CONSTRAINT "fotoai_user_progress_wfh_issued_check" CHECK (wfh_issued >= 0)
);
--> statement-breakpoint
ALTER TABLE "fotoai_user_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"action_type" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_agent_actions_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id")
);
--> statement-breakpoint
ALTER TABLE "fotoai_agent_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_photo_critiques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"submission_id" uuid,
	"photo_object_key" text NOT NULL,
	"technical_score" integer,
	"composition_score" integer,
	"creative_score" integer,
	"overall_score" integer,
	"technical_feedback" text,
	"composition_feedback" text,
	"creative_feedback" text,
	"strengths" text[] DEFAULT '{""}' NOT NULL,
	"improvements" text[] DEFAULT '{""}' NOT NULL,
	"suggested_settings" text,
	"critique_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_photo_critiques_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_photo_critiques_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_photo_critiques_check" CHECK (split_part(photo_object_key, '/'::text, 1) = (user_id)::text),
	CONSTRAINT "fotoai_photo_critiques_composition_score_check" CHECK ((composition_score >= 0) AND (composition_score <= 100)),
	CONSTRAINT "fotoai_photo_critiques_creative_score_check" CHECK ((creative_score >= 0) AND (creative_score <= 100)),
	CONSTRAINT "fotoai_photo_critiques_overall_score_check" CHECK ((overall_score >= 0) AND (overall_score <= 100)),
	CONSTRAINT "fotoai_photo_critiques_technical_score_check" CHECK ((technical_score >= 0) AND (technical_score <= 100))
);
--> statement-breakpoint
ALTER TABLE "fotoai_photo_critiques" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_reverse_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"photo_object_key" text NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analysis_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_reverse_analyses_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_reverse_analyses_check" CHECK (split_part(photo_object_key, '/'::text, 1) = (user_id)::text)
);
--> statement-breakpoint
ALTER TABLE "fotoai_reverse_analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_editing_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"original_photo_object_key" text,
	"edited_photo_object_key" text,
	"recipe" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analysis_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_editing_recipes_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_editing_recipes_check" CHECK ((original_photo_object_key IS NULL) OR (split_part(original_photo_object_key, '/'::text, 1) = (user_id)::text)),
	CONSTRAINT "fotoai_editing_recipes_check1" CHECK ((edited_photo_object_key IS NULL) OR (split_part(edited_photo_object_key, '/'::text, 1) = (user_id)::text))
);
--> statement-breakpoint
ALTER TABLE "fotoai_editing_recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"insights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"report_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_weekly_reports_user_week_key" UNIQUE("user_id","week_start"),
	CONSTRAINT "fotoai_weekly_reports_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_weekly_reports_check" CHECK (week_end >= week_start)
);
--> statement-breakpoint
ALTER TABLE "fotoai_weekly_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_portfolio_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"photo_count" integer NOT NULL,
	"analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analysis_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_portfolio_analyses_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_portfolio_analyses_photo_count_check" CHECK (photo_count > 0)
);
--> statement-breakpoint
ALTER TABLE "fotoai_portfolio_analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_user_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"skill_id" text NOT NULL,
	"current_xp" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"last_xp_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "fotoai_user_skills_user_skill_key" UNIQUE("user_id","skill_id"),
	CONSTRAINT "fotoai_user_skills_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_user_skills_current_xp_check" CHECK (current_xp >= 0),
	CONSTRAINT "fotoai_user_skills_status_check" CHECK (status = ANY (ARRAY['locked'::text, 'available'::text, 'learned'::text, 'practiced'::text, 'mastered'::text]))
);
--> statement-breakpoint
ALTER TABLE "fotoai_user_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"skill_level" text DEFAULT 'intermediate' NOT NULL,
	"photography_interests" text[] DEFAULT '{""}' NOT NULL,
	"avoids_styles" text[] DEFAULT '{""}' NOT NULL,
	"work_days" text[] DEFAULT '{""}' NOT NULL,
	"work_start_time" text DEFAULT '09:00' NOT NULL,
	"work_end_time" text DEFAULT '17:00' NOT NULL,
	"lunch_start_time" text DEFAULT '12:00' NOT NULL,
	"lunch_end_time" text DEFAULT '13:00' NOT NULL,
	"primary_photo_day" text DEFAULT 'Saturday' NOT NULL,
	"secondary_photo_days" text[] DEFAULT '{""}' NOT NULL,
	"lunch_break_photography" boolean DEFAULT true NOT NULL,
	"evening_photography" boolean DEFAULT true NOT NULL,
	"wfh_flexibility" boolean DEFAULT true NOT NULL,
	"adapt_to_weather" boolean DEFAULT true NOT NULL,
	"adapt_to_calendar" boolean DEFAULT true NOT NULL,
	"office_location" text,
	"home_location" text,
	"current_location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"theme" text DEFAULT 'golden' NOT NULL,
	"units" text DEFAULT 'metric' NOT NULL,
	"home_lat" double precision,
	"home_lng" double precision,
	"loadout" jsonb,
	CONSTRAINT "fotoai_user_preferences_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "fotoai_user_preferences_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_user_preferences_home_lat_check" CHECK ((home_lat IS NULL) OR ((home_lat >= ('-90'::integer)::double precision) AND (home_lat <= (90)::double precision))),
	CONSTRAINT "fotoai_user_preferences_home_lng_check" CHECK ((home_lng IS NULL) OR ((home_lng >= ('-180'::integer)::double precision) AND (home_lng <= (180)::double precision))),
	CONSTRAINT "fotoai_user_preferences_home_pair_check" CHECK ((home_lat IS NULL) = (home_lng IS NULL)),
	CONSTRAINT "fotoai_user_preferences_skill_level_check" CHECK (skill_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'professional'::text])),
	CONSTRAINT "fotoai_user_preferences_theme_check" CHECK (theme = ANY (ARRAY['golden'::text, 'golden_dark'::text, 'camera'::text])),
	CONSTRAINT "fotoai_user_preferences_units_check" CHECK (units = ANY (ARRAY['metric'::text, 'imperial'::text]))
);
--> statement-breakpoint
ALTER TABLE "fotoai_user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"challenge_type" text NOT NULL,
	"challenge_text" text NOT NULL,
	"difficulty" text,
	"category" text,
	"duration" text,
	"weather_conditions" text,
	"location" text,
	"recommended_gear" text[] DEFAULT '{""}' NOT NULL,
	"tips" text,
	"issued_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_date" timestamp with time zone,
	"shot_list" text[] DEFAULT '{""}' NOT NULL,
	"narrative_context" text,
	"editing_direction" text,
	"mastery_area" text,
	"technical_level" integer,
	"success_criteria" text,
	"what_to_look_for" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'dashboard' NOT NULL,
	CONSTRAINT "fotoai_daily_challenges_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "fotoai_daily_challenges_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_daily_challenges_source_check" CHECK (source = ANY (ARRAY['dashboard'::text, 'chat'::text, 'plan'::text, 'job'::text])),
	CONSTRAINT "fotoai_daily_challenges_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'skipped'::text, 'completed'::text, 'superseded'::text])),
	CONSTRAINT "fotoai_daily_challenges_technical_level_check" CHECK ((technical_level >= 1) AND (technical_level <= 5))
);
--> statement-breakpoint
ALTER TABLE "fotoai_daily_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fotoai_xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"legacy_appwrite_id" text,
	"skill_id" text NOT NULL,
	"xp_amount" integer NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" uuid,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotoai_xp_events_legacy_appwrite_id_key" UNIQUE("legacy_appwrite_id"),
	CONSTRAINT "fotoai_xp_events_source_kind_check" CHECK (source_kind = ANY (ARRAY['challenge_complete'::text, 'submission'::text, 'critique_bonus'::text, 'plan_step'::text])),
	CONSTRAINT "fotoai_xp_events_xp_amount_check" CHECK (xp_amount > 0)
);
--> statement-breakpoint
ALTER TABLE "fotoai_xp_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fotoai_gear_bodies" ADD CONSTRAINT "fotoai_gear_bodies_fixed_lens_id_fkey" FOREIGN KEY ("fixed_lens_id") REFERENCES "public"."fotoai_gear_lenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_places" ADD CONSTRAINT "fotoai_places_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_shoot_plans" ADD CONSTRAINT "fotoai_shoot_plans_spot_fkey" FOREIGN KEY ("user_id","spot_id") REFERENCES "public"."fotoai_places"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_shoot_plans" ADD CONSTRAINT "fotoai_shoot_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_plan_steps" ADD CONSTRAINT "fotoai_plan_steps_plan_fkey" FOREIGN KEY ("plan_id","user_id") REFERENCES "public"."fotoai_shoot_plans"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_plan_steps" ADD CONSTRAINT "fotoai_plan_steps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_film_rolls" ADD CONSTRAINT "fotoai_film_rolls_body_fkey" FOREIGN KEY ("user_id","body_gear_id") REFERENCES "public"."fotoai_user_gear"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_film_rolls" ADD CONSTRAINT "fotoai_film_rolls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_film_frames" ADD CONSTRAINT "fotoai_film_frames_lens_fkey" FOREIGN KEY ("user_id","lens_gear_id") REFERENCES "public"."fotoai_user_gear"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_film_frames" ADD CONSTRAINT "fotoai_film_frames_roll_fkey" FOREIGN KEY ("roll_id","user_id") REFERENCES "public"."fotoai_film_rolls"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_film_frames" ADD CONSTRAINT "fotoai_film_frames_step_fkey" FOREIGN KEY ("user_id","step_id") REFERENCES "public"."fotoai_plan_steps"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_film_frames" ADD CONSTRAINT "fotoai_film_frames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_photos" ADD CONSTRAINT "fotoai_photos_frame_fkey" FOREIGN KEY ("user_id","frame_id") REFERENCES "public"."fotoai_film_frames"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_photos" ADD CONSTRAINT "fotoai_photos_roll_fkey" FOREIGN KEY ("user_id","roll_id") REFERENCES "public"."fotoai_film_rolls"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_photos" ADD CONSTRAINT "fotoai_photos_step_fkey" FOREIGN KEY ("user_id","step_id") REFERENCES "public"."fotoai_plan_steps"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_photos" ADD CONSTRAINT "fotoai_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_user_gear" ADD CONSTRAINT "fotoai_user_gear_body_id_fkey" FOREIGN KEY ("body_id") REFERENCES "public"."fotoai_gear_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_user_gear" ADD CONSTRAINT "fotoai_user_gear_lens_id_fkey" FOREIGN KEY ("lens_id") REFERENCES "public"."fotoai_gear_lenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_user_gear" ADD CONSTRAINT "fotoai_user_gear_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_challenge_submissions" ADD CONSTRAINT "fotoai_challenge_submissions_challenge_owner_fkey" FOREIGN KEY ("user_id","challenge_id") REFERENCES "public"."fotoai_daily_challenges"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_challenge_submissions" ADD CONSTRAINT "fotoai_challenge_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_itineraries" ADD CONSTRAINT "fotoai_itineraries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_user_progress" ADD CONSTRAINT "fotoai_user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_agent_actions" ADD CONSTRAINT "fotoai_agent_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_photo_critiques" ADD CONSTRAINT "fotoai_photo_critiques_submission_owner_fkey" FOREIGN KEY ("user_id","submission_id") REFERENCES "public"."fotoai_challenge_submissions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_photo_critiques" ADD CONSTRAINT "fotoai_photo_critiques_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_reverse_analyses" ADD CONSTRAINT "fotoai_reverse_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_editing_recipes" ADD CONSTRAINT "fotoai_editing_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_weekly_reports" ADD CONSTRAINT "fotoai_weekly_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_portfolio_analyses" ADD CONSTRAINT "fotoai_portfolio_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_user_skills" ADD CONSTRAINT "fotoai_user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_user_preferences" ADD CONSTRAINT "fotoai_user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_daily_challenges" ADD CONSTRAINT "fotoai_daily_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotoai_xp_events" ADD CONSTRAINT "fotoai_xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fotoai_places_user_created_idx" ON "fotoai_places" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "fotoai_places_user_place_key" ON "fotoai_places" USING btree ("user_id" text_ops,"place_id" text_ops) WHERE (place_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "fotoai_shoot_plans_user_created_idx" ON "fotoai_shoot_plans" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_film_rolls_user_created_idx" ON "fotoai_film_rolls" USING btree ("user_id" timestamptz_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_film_frames_step_idx" ON "fotoai_film_frames" USING btree ("step_id" uuid_ops) WHERE (step_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "fotoai_photos_step_idx" ON "fotoai_photos" USING btree ("step_id" uuid_ops) WHERE (step_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "fotoai_photos_user_created_idx" ON "fotoai_photos" USING btree ("user_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "fotoai_user_gear_user_idx" ON "fotoai_user_gear" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fotoai_challenge_submissions_challenge_idx" ON "fotoai_challenge_submissions" USING btree ("challenge_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fotoai_challenge_submissions_user_submitted_idx" ON "fotoai_challenge_submissions" USING btree ("user_id" uuid_ops,"submitted_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_itineraries_user_idx" ON "fotoai_itineraries" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fotoai_agent_actions_user_idx" ON "fotoai_agent_actions" USING btree ("user_id" timestamptz_ops,"executed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_photo_critiques_submission_idx" ON "fotoai_photo_critiques" USING btree ("submission_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fotoai_photo_critiques_user_idx" ON "fotoai_photo_critiques" USING btree ("user_id" uuid_ops,"critique_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_reverse_analyses_user_idx" ON "fotoai_reverse_analyses" USING btree ("user_id" timestamptz_ops,"analysis_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_editing_recipes_user_idx" ON "fotoai_editing_recipes" USING btree ("user_id" timestamptz_ops,"analysis_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_portfolio_analyses_user_idx" ON "fotoai_portfolio_analyses" USING btree ("user_id" timestamptz_ops,"analysis_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "fotoai_daily_challenges_user_issued_idx" ON "fotoai_daily_challenges" USING btree ("user_id" timestamptz_ops,"issued_date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "fotoai_xp_events_dedupe_idx" ON "fotoai_xp_events" USING btree ("user_id" text_ops,"skill_id" text_ops,"source_kind" text_ops,"source_id" text_ops) WHERE (source_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "fotoai_xp_events_user_awarded_idx" ON "fotoai_xp_events" USING btree ("user_id" timestamptz_ops,"awarded_at" timestamptz_ops);--> statement-breakpoint
CREATE POLICY "fotoai_gear_lenses_read" ON "fotoai_gear_lenses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "fotoai_gear_bodies_read" ON "fotoai_gear_bodies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "fotoai_places_delete" ON "fotoai_places" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_places_update" ON "fotoai_places" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_places_insert" ON "fotoai_places" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_places_select" ON "fotoai_places" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_shoot_plans_delete" ON "fotoai_shoot_plans" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_shoot_plans_update" ON "fotoai_shoot_plans" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_shoot_plans_insert" ON "fotoai_shoot_plans" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_shoot_plans_select" ON "fotoai_shoot_plans" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_plan_steps_delete" ON "fotoai_plan_steps" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_plan_steps_update" ON "fotoai_plan_steps" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_plan_steps_insert" ON "fotoai_plan_steps" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_plan_steps_select" ON "fotoai_plan_steps" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_film_rolls_delete" ON "fotoai_film_rolls" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_film_rolls_update" ON "fotoai_film_rolls" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_film_rolls_insert" ON "fotoai_film_rolls" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_film_rolls_select" ON "fotoai_film_rolls" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_film_frames_insert" ON "fotoai_film_frames" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_film_frames_select" ON "fotoai_film_frames" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_photos_delete" ON "fotoai_photos" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_photos_update" ON "fotoai_photos" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_photos_insert" ON "fotoai_photos" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_photos_select" ON "fotoai_photos" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_gear_delete" ON "fotoai_user_gear" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_user_gear_update" ON "fotoai_user_gear" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_gear_insert" ON "fotoai_user_gear" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_gear_select" ON "fotoai_user_gear" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_challenge_submissions_delete" ON "fotoai_challenge_submissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_challenge_submissions_update" ON "fotoai_challenge_submissions" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_challenge_submissions_insert" ON "fotoai_challenge_submissions" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_challenge_submissions_select" ON "fotoai_challenge_submissions" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_itineraries_delete" ON "fotoai_itineraries" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_itineraries_update" ON "fotoai_itineraries" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_itineraries_insert" ON "fotoai_itineraries" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_itineraries_select" ON "fotoai_itineraries" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_progress_delete" ON "fotoai_user_progress" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_user_progress_update" ON "fotoai_user_progress" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_progress_insert" ON "fotoai_user_progress" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_progress_select" ON "fotoai_user_progress" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_agent_actions_insert" ON "fotoai_agent_actions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_agent_actions_select" ON "fotoai_agent_actions" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_photo_critiques_delete" ON "fotoai_photo_critiques" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_photo_critiques_insert" ON "fotoai_photo_critiques" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_photo_critiques_select" ON "fotoai_photo_critiques" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_reverse_analyses_delete" ON "fotoai_reverse_analyses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_reverse_analyses_insert" ON "fotoai_reverse_analyses" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_reverse_analyses_select" ON "fotoai_reverse_analyses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_editing_recipes_delete" ON "fotoai_editing_recipes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_editing_recipes_insert" ON "fotoai_editing_recipes" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_editing_recipes_select" ON "fotoai_editing_recipes" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_weekly_reports_select" ON "fotoai_weekly_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_portfolio_analyses_delete" ON "fotoai_portfolio_analyses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_portfolio_analyses_insert" ON "fotoai_portfolio_analyses" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_portfolio_analyses_select" ON "fotoai_portfolio_analyses" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_skills_select" ON "fotoai_user_skills" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_user_preferences_delete" ON "fotoai_user_preferences" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_user_preferences_update" ON "fotoai_user_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_preferences_insert" ON "fotoai_user_preferences" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_user_preferences_select" ON "fotoai_user_preferences" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_daily_challenges_delete" ON "fotoai_daily_challenges" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));--> statement-breakpoint
CREATE POLICY "fotoai_daily_challenges_update" ON "fotoai_daily_challenges" AS PERMISSIVE FOR UPDATE TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_daily_challenges_insert" ON "fotoai_daily_challenges" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_daily_challenges_select" ON "fotoai_daily_challenges" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "fotoai_xp_events_select" ON "fotoai_xp_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));
*/