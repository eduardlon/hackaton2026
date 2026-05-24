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
const OTHER_USER = 'f62c395b-f143-4a12-8764-1e406a47b594';

function passportFor(userId: string) {
  if (userId === OTHER_USER) {
    return {
      points: 180, level: 2, levelName: 'Estable', nextLevelPoints: 400,
      progressPercentage: 45, nextBenefit: 'Menor interés en créditos',
      recommendations: ['Usa tu crédito de forma responsable', 'Aumenta tus ingresos para mejorar tu perfil'],
      events: [] as any[],
    };
  }
  return {
    points: 420, level: 3, levelName: 'Confiable', nextLevelPoints: 700,
    progressPercentage: 60, nextBenefit: 'Aumento de cupo de crédito',
    recommendations: ['Sigue pagando a tiempo para subir de nivel', 'Diversifica tus ingresos'],
    events: [] as any[],
  };
}

export default async function getPassport(request: Request): Promise<Response> {
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
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (userError) return json({ message: userError.message }, 500);
  if (!user) return json({ message: 'Usuario no encontrado' }, 404);

  return json(passportFor(userId));
}
