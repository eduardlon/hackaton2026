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

  return json({
    availableAmount: 0,
    maxAmount: 0,
    usedAmount: 0,
    safeMonthlyPayment: 0,
    risk: 'medio-bajo',
    eligibility: 0,
    level: 'Sin perfil financiero',
    nextTierAmount: 0,
    pointsToNextTier: 0,
  });
}
