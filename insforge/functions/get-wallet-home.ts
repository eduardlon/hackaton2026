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

const DEMO_USER = '36ac6a5a-17c8-4407-b7f3-fc9302bf4ed9';
const EDUARD_USER = 'f62c395b-f143-4a12-8764-1e406a47b594';

function profileForUser(userId: string) {
  if (userId === EDUARD_USER) {
    return {
      wallet: { balance: 1500000, monthlyIncome: 2200000, monthlyExpenses: 1500000, pendingBills: 1 },
      passport: { points: 180, level: 2, levelName: 'Estable', nextLevelPoints: 400, progressPercentage: 45, nextBenefit: 'Menor interés en créditos', monthlyPoints: 22 },
    };
  }
  return {
    wallet: { balance: 2500000, monthlyIncome: 3200000, monthlyExpenses: 2100000, pendingBills: 2 },
    passport: { points: 420, level: 3, levelName: 'Confiable', nextLevelPoints: 700, progressPercentage: 60, nextBenefit: 'Aumento de cupo de crédito', monthlyPoints: 45 },
  };
}

export default async function getWalletHome(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const userId = extractUserId(request);
  if (!userId) return json({ message: 'No autorizado' }, 401);

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  });

  const { data: user, error: userError } = await client.database
    .from('phone_users')
    .select('id, phone, name, type')
    .eq('id', userId)
    .maybeSingle();

  if (userError) return json({ message: userError.message }, 500);
  if (!user) return json({ message: 'Usuario no encontrado' }, 404);

  const profile = profileForUser(userId);

  return json({
    user: { id: user.id, name: user.name, type: user.type || 'customer' },
    wallet: { currency: 'COP', ...profile.wallet },
    passport: profile.passport,
    recentTransactions: [],
  });
}
