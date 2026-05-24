module.exports = async function(request) {
  const corsHeaders = buildCorsHeaders();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@insforge/sdk');
    const body = await safeJson(request);
    const phone = normalizePhone(body.phone || body.phoneNumber || body.msisdn || '');

    if (!phone) {
      return json({ error: { code: 'PHONE_REQUIRED', message: 'Ingresa tu número de celular.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: user, error } = await client.database
      .from('phone_users')
      .select('id, name, phone, type')
      .eq('phone', phone)
      .maybeSingle();

    if (error) {
      return json({ error: { code: 'LOOKUP_FAILED', message: 'No fue posible validar el celular.' } }, 500, corsHeaders);
    }

    return json({
      exists: Boolean(user),
      user: user ? mapPublicUser(user) : null
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado validando celular.' } }, 500, corsHeaders);
  }
};

function mapPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    type: user.type
  };
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('57')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  return digits;
}

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

