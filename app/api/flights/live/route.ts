import { getLiveFlights } from '@/lib/yul-ops/live-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await getLiveFlights();
  return Response.json(payload, {
    status: payload.status === 'error' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
