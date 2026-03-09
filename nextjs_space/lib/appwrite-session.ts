// Helper to create an Appwrite email/password session and extract the secret.
// Appwrite 1.8+ no longer returns session.secret in the JSON body from the
// node-appwrite SDK. The secret is only available in the Set-Cookie header.

export async function createEmailSession(email: string, password: string) {
  const endpoint = process.env.APPWRITE_ENDPOINT!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;

  const res = await fetch(`${endpoint}/account/sessions/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || 'Invalid credentials');
  }

  const session = await res.json();

  // Try body first, then fall back to Set-Cookie header
  let secret: string = session.secret || '';

  if (!secret) {
    const setCookie = res.headers.get('set-cookie') || '';
    const prefix = `a_session_${projectId}=`;
    for (const part of setCookie.split(',')) {
      const nameValue = part.trim().split(';')[0];
      if (nameValue.startsWith(prefix)) {
        secret = nameValue.substring(prefix.length);
        break;
      }
    }
  }

  if (!secret) {
    throw new Error('Session created but secret not returned by Appwrite');
  }

  return { userId: session.userId as string, secret };
}
