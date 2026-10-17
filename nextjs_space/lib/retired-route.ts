// 410 handler for the retired Appwrite API routes. Each answers with the new
// endpoint so an old client fails loudly with a pointer, never silently.

export function retiredRoute(replacement: string | null) {
  return async (): Promise<Response> =>
    new Response(
      JSON.stringify({
        error: replacement ? `This endpoint was retired. Use ${replacement}.` : 'This endpoint was retired.',
        code: 'gone',
        replacement,
      }),
      { status: 410, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
}
