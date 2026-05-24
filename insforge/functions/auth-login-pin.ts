module.exports = async function(request) {
  const corsHeaders = buildCorsHeaders();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@insforge/sdk');
    const body = await safeJson(request);
    const phone = normalizePhone(body.phone || body.phoneNumber || body.msisdn || '');
    const pin = String(body.pin || body.password || body.passcode || '').trim();
    const biometricConfirmed = Boolean(body.biometricConfirmed);

    if (!phone) {
      return json({ error: { code: 'PHONE_REQUIRED', message: 'Ingresa tu número de celular.' } }, 400, corsHeaders);
    }

    if (!biometricConfirmed && !/^\d{4}$/.test(pin)) {
      return json({ error: { code: 'PIN_INVALID', message: 'El PIN debe tener exactamente 4 dígitos.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: user, error } = await client.database
      .from('phone_users')
      .select('id, name, phone, type, created_at, pin_hash')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      return json({ error: { code: 'USER_NOT_FOUND', message: 'No se encontró una cuenta con ese celular.' } }, 404, corsHeaders);
    }

    if (!biometricConfirmed) {
      const nextHash = await hashPin(phone, pin);
      const legacyAllowed = !user.pin_hash && pin === '1234';
      if (!legacyAllowed && user.pin_hash !== nextHash) {
        return json({ error: { code: 'INVALID_PIN', message: 'La clave ingresada no es correcta.' } }, 401, corsHeaders);
      }

      if (!user.pin_hash) {
        await client.database
          .from('phone_users')
          .update({ pin_hash: nextHash, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    }

    await ensureFinancialProfile(client, user);

    return json(await buildAuthResponse(user, biometricConfirmed ? 'biometric' : 'phone-pin'), 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado iniciando sesión.' } }, 500, corsHeaders);
  }
};

async function ensureFinancialProfile(client, user) {
  const { data: wallet } = await client.database
    .from('wallets')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!wallet) {
    await client.database.from('wallets').insert({
      user_id: user.id,
      balance: 900000,
      currency: 'COP',
      status: 'active',
      monthly_income: 2500000,
      monthly_expenses: 1200000,
      pending_bills: 1
    });
  }

  const { data: passport } = await client.database
    .from('passports')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!passport) {
    await client.database.from('passports').insert({
      user_id: user.id,
      points: 120,
      level: 1,
      level_name: 'Explorador financiero',
      risk_band: 'medium',
      next_level_points: 200,
      progress_percentage: 60,
      next_benefit: 'Mejores condiciones al pagar tus primeras facturas'
    });
  }
}

async function buildAuthResponse(user, authMethod) {
  const token = await signToken({ sub: user.id, phone: user.phone, role: user.type || 'customer' });
  return {
    session: {
      mode: 'phone-pin',
      token,
      access_token: token,
      authMethod
    },
    access_token: token,
    user: mapUser(user),
    nextRoute: user.type === 'admin' ? '/admin' : '/wallet'
  };
}

function mapUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    type: user.type,
    role: user.type,
    createdAt: user.created_at
  };
}

async function hashPin(phone, pin) {
  const secret = Deno.env.get('AUTH_TOKEN_SECRET') || Deno.env.get('ANON_KEY') || 'fingrow-local-secret';
  const data = new TextEncoder().encode(`${phone}:${pin}:${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hash);
}

async function signToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 30 };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await hmacSha256(encodedPayload);
  return `fg1.${encodedPayload}.${signature}`;
}

async function hmacSha256(value) {
  const secret = Deno.env.get('AUTH_TOKEN_SECRET') || Deno.env.get('ANON_KEY') || 'fingrow-local-secret';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
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

function base64UrlEncode(value) {
  return btoa(unescape(encodeURIComponent(value))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
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

