// Server-side Appwrite SDK (API routes only — never import in client components)
import { Client, Account, Databases, Storage, Users, Health } from 'node-appwrite';
import { cookies } from 'next/headers';

const ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const API_KEY = process.env.APPWRITE_API_KEY!;

// Admin client — has full API key access, use for scheduled jobs and admin operations
export function createAdminClient() {
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  return {
    get account() { return new Account(client); },
    get databases() { return new Databases(client); },
    get storage() { return new Storage(client); },
    get users() { return new Users(client); },
    get health() { return new Health(client); },
  };
}

// Session client — scoped to the current user's session, use in authenticated API routes
export async function createSessionClient(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(`a_session_${PROJECT_ID}`);

  if (!sessionCookie?.value) {
    throw new Error('No active session');
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setSession(sessionCookie.value);

  return {
    get account() { return new Account(client); },
    get databases() { return new Databases(client); },
    get storage() { return new Storage(client); },
  };
}
