import { relations } from "drizzle-orm/relations";
import { authUsers as usersInAuth } from "drizzle-orm/supabase";
import { fotoaiGearLenses, fotoaiGearBodies, fotoaiPlaces, fotoaiShootPlans, fotoaiPlanSteps, fotoaiUserGear, fotoaiFilmRolls, fotoaiFilmFrames, fotoaiPhotos, fotoaiDailyChallenges, fotoaiChallengeSubmissions, fotoaiItineraries, fotoaiUserProgress, fotoaiAgentActions, fotoaiPhotoCritiques, fotoaiReverseAnalyses, fotoaiEditingRecipes, fotoaiWeeklyReports, fotoaiPortfolioAnalyses, fotoaiUserSkills, fotoaiUserPreferences, fotoaiXpEvents } from "./schema.ts";

export const fotoaiGearBodiesRelations = relations(fotoaiGearBodies, ({one, many}) => ({
	fotoaiGearLense: one(fotoaiGearLenses, {
		fields: [fotoaiGearBodies.fixedLensId],
		references: [fotoaiGearLenses.id]
	}),
	fotoaiUserGears: many(fotoaiUserGear),
}));

export const fotoaiGearLensesRelations = relations(fotoaiGearLenses, ({many}) => ({
	fotoaiGearBodies: many(fotoaiGearBodies),
	fotoaiUserGears: many(fotoaiUserGear),
}));

export const fotoaiPlacesRelations = relations(fotoaiPlaces, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiPlaces.userId],
		references: [usersInAuth.id]
	}),
	fotoaiShootPlans: many(fotoaiShootPlans),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	fotoaiPlaces: many(fotoaiPlaces),
	fotoaiShootPlans: many(fotoaiShootPlans),
	fotoaiPlanSteps: many(fotoaiPlanSteps),
	fotoaiFilmRolls: many(fotoaiFilmRolls),
	fotoaiFilmFrames: many(fotoaiFilmFrames),
	fotoaiPhotos: many(fotoaiPhotos),
	fotoaiUserGears: many(fotoaiUserGear),
	fotoaiChallengeSubmissions: many(fotoaiChallengeSubmissions),
	fotoaiItineraries: many(fotoaiItineraries),
	fotoaiUserProgresses: many(fotoaiUserProgress),
	fotoaiAgentActions: many(fotoaiAgentActions),
	fotoaiPhotoCritiques: many(fotoaiPhotoCritiques),
	fotoaiReverseAnalyses: many(fotoaiReverseAnalyses),
	fotoaiEditingRecipes: many(fotoaiEditingRecipes),
	fotoaiWeeklyReports: many(fotoaiWeeklyReports),
	fotoaiPortfolioAnalyses: many(fotoaiPortfolioAnalyses),
	fotoaiUserSkills: many(fotoaiUserSkills),
	fotoaiUserPreferences: many(fotoaiUserPreferences),
	fotoaiDailyChallenges: many(fotoaiDailyChallenges),
	fotoaiXpEvents: many(fotoaiXpEvents),
}));

export const fotoaiShootPlansRelations = relations(fotoaiShootPlans, ({one, many}) => ({
	fotoaiPlace: one(fotoaiPlaces, {
		fields: [fotoaiShootPlans.userId],
		references: [fotoaiPlaces.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiShootPlans.userId],
		references: [usersInAuth.id]
	}),
	fotoaiPlanSteps: many(fotoaiPlanSteps),
}));

export const fotoaiPlanStepsRelations = relations(fotoaiPlanSteps, ({one, many}) => ({
	fotoaiShootPlan: one(fotoaiShootPlans, {
		fields: [fotoaiPlanSteps.planId],
		references: [fotoaiShootPlans.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiPlanSteps.userId],
		references: [usersInAuth.id]
	}),
	fotoaiFilmFrames: many(fotoaiFilmFrames),
	fotoaiPhotos: many(fotoaiPhotos),
}));

export const fotoaiFilmRollsRelations = relations(fotoaiFilmRolls, ({one, many}) => ({
	fotoaiUserGear: one(fotoaiUserGear, {
		fields: [fotoaiFilmRolls.userId],
		references: [fotoaiUserGear.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiFilmRolls.userId],
		references: [usersInAuth.id]
	}),
	fotoaiFilmFrames: many(fotoaiFilmFrames),
	fotoaiPhotos: many(fotoaiPhotos),
}));

export const fotoaiUserGearRelations = relations(fotoaiUserGear, ({one, many}) => ({
	fotoaiFilmRolls: many(fotoaiFilmRolls),
	fotoaiFilmFrames: many(fotoaiFilmFrames),
	fotoaiGearBody: one(fotoaiGearBodies, {
		fields: [fotoaiUserGear.bodyId],
		references: [fotoaiGearBodies.id]
	}),
	fotoaiGearLense: one(fotoaiGearLenses, {
		fields: [fotoaiUserGear.lensId],
		references: [fotoaiGearLenses.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiUserGear.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiFilmFramesRelations = relations(fotoaiFilmFrames, ({one, many}) => ({
	fotoaiUserGear: one(fotoaiUserGear, {
		fields: [fotoaiFilmFrames.userId],
		references: [fotoaiUserGear.id]
	}),
	fotoaiFilmRoll: one(fotoaiFilmRolls, {
		fields: [fotoaiFilmFrames.rollId],
		references: [fotoaiFilmRolls.id]
	}),
	fotoaiPlanStep: one(fotoaiPlanSteps, {
		fields: [fotoaiFilmFrames.userId],
		references: [fotoaiPlanSteps.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiFilmFrames.userId],
		references: [usersInAuth.id]
	}),
	fotoaiPhotos: many(fotoaiPhotos),
}));

export const fotoaiPhotosRelations = relations(fotoaiPhotos, ({one}) => ({
	fotoaiFilmFrame: one(fotoaiFilmFrames, {
		fields: [fotoaiPhotos.userId],
		references: [fotoaiFilmFrames.id]
	}),
	fotoaiFilmRoll: one(fotoaiFilmRolls, {
		fields: [fotoaiPhotos.userId],
		references: [fotoaiFilmRolls.id]
	}),
	fotoaiPlanStep: one(fotoaiPlanSteps, {
		fields: [fotoaiPhotos.userId],
		references: [fotoaiPlanSteps.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiPhotos.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiChallengeSubmissionsRelations = relations(fotoaiChallengeSubmissions, ({one, many}) => ({
	fotoaiDailyChallenge: one(fotoaiDailyChallenges, {
		fields: [fotoaiChallengeSubmissions.userId],
		references: [fotoaiDailyChallenges.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiChallengeSubmissions.userId],
		references: [usersInAuth.id]
	}),
	fotoaiPhotoCritiques: many(fotoaiPhotoCritiques),
}));

export const fotoaiDailyChallengesRelations = relations(fotoaiDailyChallenges, ({one, many}) => ({
	fotoaiChallengeSubmissions: many(fotoaiChallengeSubmissions),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiDailyChallenges.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiItinerariesRelations = relations(fotoaiItineraries, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiItineraries.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiUserProgressRelations = relations(fotoaiUserProgress, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiUserProgress.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiAgentActionsRelations = relations(fotoaiAgentActions, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiAgentActions.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiPhotoCritiquesRelations = relations(fotoaiPhotoCritiques, ({one}) => ({
	fotoaiChallengeSubmission: one(fotoaiChallengeSubmissions, {
		fields: [fotoaiPhotoCritiques.userId],
		references: [fotoaiChallengeSubmissions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiPhotoCritiques.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiReverseAnalysesRelations = relations(fotoaiReverseAnalyses, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiReverseAnalyses.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiEditingRecipesRelations = relations(fotoaiEditingRecipes, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiEditingRecipes.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiWeeklyReportsRelations = relations(fotoaiWeeklyReports, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiWeeklyReports.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiPortfolioAnalysesRelations = relations(fotoaiPortfolioAnalyses, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiPortfolioAnalyses.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiUserSkillsRelations = relations(fotoaiUserSkills, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiUserSkills.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiUserPreferencesRelations = relations(fotoaiUserPreferences, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiUserPreferences.userId],
		references: [usersInAuth.id]
	}),
}));

export const fotoaiXpEventsRelations = relations(fotoaiXpEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiXpEvents.userId],
		references: [usersInAuth.id]
	}),
}));