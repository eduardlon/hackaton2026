import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractUserId(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer phone-session-')) return null;
  return auth.replace('Bearer phone-session-', '');
}

const OTHER_USER = 'f62c395b-f143-4a12-8764-1e406a47b594';

function creditProfileFor(userId: string) {
  if (userId === OTHER_USER) {
    return {
      availableAmount: 2000000,
      maxAmount: 3500000,
      usedAmount: 0,
      safeMonthlyPayment: 280000,
      risk: 'medio-bajo',
      eligibility: 65,
      level: 'Nivel 2 — Estable',
      nextTierAmount: 3500000,
      pointsToNextTier: 220,
    };
  }
  return {
    availableAmount: 5000000,
    maxAmount: 8000000,
    usedAmount: 0,
    safeMonthlyPayment: 450000,
    risk: 'bajo',
    eligibility: 82,
    level: 'Nivel 3 — Confiable',
    nextTierAmount: 8000000,
    pointsToNextTier: 280,
  };
}

export default async function getCreditProfile(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const userId = extractUserId(request);
  if (!userId) return json({ message: 'No autorizado' }, 401);

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  });

  const { data: user, error } = await client.database
    .from('phone_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) return json({ message: error.message }, 500);
  if (!user) return json({ message: 'Usuario no encontrado' }, 404);

  return json(creditProfileFor(userId));
}
