// Shared session cookie name — used in API routes, server lib, and middleware.
// A fixed name avoids env-var-based mismatches (e.g. NEXT_PUBLIC_* not baked in at build time).
export const SESSION_COOKIE = 'foto_session';
