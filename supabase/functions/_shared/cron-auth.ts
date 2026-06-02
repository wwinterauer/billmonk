/**
 * Shared cron authentication helper. Returns a 401 Response if the request
 * is not authenticated with the CRON_SECRET, otherwise returns null.
 *
 * Callers must include: `Authorization: Bearer <CRON_SECRET>`
 */
export function requireCronAuth(req: Request): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) {
    return new Response(
      JSON.stringify({ error: "CRON_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}
