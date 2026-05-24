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

function normalizePhone(input: string) {
  const clean = input.replace(/\D/g, '');
  return clean.startsWith('57') ? `+${clean}` : `+57${clean}`;
}

export default async function authLoginPin(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const normalized = normalizePhone(String(body.phone ?? ''));
  const pinHash = String(body.pinHash ?? '');
  if (!/^\+57\d{10}$/.test(normalized) || !pinHash) return json({ message: 'Datos inválidos' }, 400);

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  });

  const { data, error } = await client.database
    .from('phone_users')
    .select('id, phone, name, type, pin_hash')
    .eq('phone', normalized)
    .maybeSingle();

  if (error) return json({ message: error.message ?? 'No fue posible iniciar sesión' }, 500);
  if (!data || data.pin_hash !== pinHash) return json({ message: 'PIN incorrecto' }, 401);

  return json({
    user: {
      id: data.id,
      phone: data.phone,
      name: data.name,
      type: data.type,
    },
    access_token: `phone-session-${data.id}`,
  });
}
