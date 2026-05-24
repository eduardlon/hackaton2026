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

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export default async function authRegister(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => ({}));
  const normalized = normalizePhone(String(body.phone ?? ''));
  const name = String(body.name ?? '').trim();
  const pin = String(body.pin ?? '');
  const pinHash = String(body.pinHash ?? '') || (/^\d{4}$/.test(pin) ? await sha256(`${normalized}:${pin}`) : '');
  if (!/^\+57\d{10}$/.test(normalized)) return json({ message: 'Celular inválido' }, 400);
  if (name.length < 2) return json({ message: 'Ingresa tu nombre completo' }, 400);
  if (!pinHash) return json({ message: 'Clave inválida' }, 400);

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    anonKey: Deno.env.get('ANON_KEY'),
  });

  const { data: existing, error: lookupError } = await client.database
    .from('phone_users')
    .select('id')
    .eq('phone', normalized)
    .maybeSingle();

  if (lookupError) return json({ message: lookupError.message ?? 'No se pudo validar la cuenta' }, 500);
  if (existing) return json({ message: 'Este celular ya está registrado' }, 409);

  const { data, error } = await client.database
    .from('phone_users')
    .insert({ phone: normalized, name, pin_hash: pinHash, type: 'customer' })
    .select('id, phone, name, type')
    .single();

  if (error || !data) return json({ message: error?.message ?? 'No fue posible crear tu cuenta' }, 500);

  return json({ user: data, access_token: `phone-session-${data.id}` }, 201);
}
