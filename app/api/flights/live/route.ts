import { getLiveFlights } from '@/lib/yul-ops/live-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await getLiveFlights();
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  // Server memory is per function instance, so share one FR24 snapshot across
  // instances through Netlify's CDN. The password wall edge function still
  // runs before the cache. Errors and demo traffic are never cached.
  if (payload.mode === 'live' && payload.status !== 'error') {
    const seconds = Math.max(1, Math.floor(payload.refreshIntervalMs / 1000));
    headers['Netlify-CDN-Cache-Control'] = `public, durable, s-maxage=${seconds}`;
  }
  return Response.json(payload, {
    status: payload.status === 'error' ? 503 : 200,
    headers,
  });
}
