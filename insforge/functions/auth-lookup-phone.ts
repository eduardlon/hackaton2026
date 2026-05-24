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

export default async function authLookupPhone(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const { phone = '' } = await request.json().catch(() => ({}));
  const normalized = normalizePhone(String(phone));
  if (!/^\+57\d{10}$/.test(normalized)) return json({ message: 'Celular inválido' }, 400);

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  });

  const { data, error } = await client.database
    .from('phone_users')
    .select('id, phone, name, type')
    .eq('phone', normalized)
    .maybeSingle();

  if (error) return json({ message: error.message ?? 'No se pudo buscar el celular' }, 500);
  return json({ exists: Boolean(data), user: data ?? null });
}
