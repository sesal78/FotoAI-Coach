import { relations } from "drizzle-orm/relations";
import { authUsers as usersInAuth } from "drizzle-orm/supabase";
import { fotoaiUserPreferences, fotoaiUserGear, fotoaiDailyChallenges, fotoaiChallengeSubmissions, fotoaiItineraries, fotoaiUserProgress, fotoaiAgentActions, fotoaiPhotoCritiques, fotoaiReverseAnalyses, fotoaiEditingRecipes, fotoaiWeeklyReports, fotoaiPortfolioAnalyses, fotoaiUserSkills, fotoaiXpEvents } from "./schema.ts";

export const fotoaiUserPreferencesRelations = relations(fotoaiUserPreferences, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiUserPreferences.userId],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	fotoaiUserPreferences: many(fotoaiUserPreferences),
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
	fotoaiXpEvents: many(fotoaiXpEvents),
	fotoaiDailyChallenges: many(fotoaiDailyChallenges),
}));

export const fotoaiUserGearRelations = relations(fotoaiUserGear, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiUserGear.userId],
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

export const fotoaiXpEventsRelations = relations(fotoaiXpEvents, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [fotoaiXpEvents.userId],
		references: [usersInAuth.id]
	}),
}));