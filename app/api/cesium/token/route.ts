import { getCesiumIonToken } from '@/lib/yul-ops/live-service';

export async function GET() {
  return Response.json({ token: getCesiumIonToken() || null });
}
