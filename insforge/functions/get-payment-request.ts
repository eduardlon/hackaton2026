module.exports = async function(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@insforge/sdk');
    const body = await safeJson(request);
    const payerUserId = resolveSessionUserId(request, body);

    if (!payerUserId) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para leer un cobro NFC.' } }, 401, corsHeaders);
    }

    const token = String(body.token || '').trim();
    if (!token) {
      return json({ error: { code: 'TOKEN_REQUIRED', message: 'No se recibió token NFC.' } }, 400, corsHeaders);
    }

    const parsed = decodeToken(token);
    if (!parsed?.paymentRequestId || !parsed?.nonce || !parsed?.signature) {
      return json({ error: { code: 'INVALID_TOKEN', message: 'El token NFC no tiene un formato válido.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: paymentRequest, error } = await client.database
      .from('payment_requests')
      .select('id, receiver_user_id, amount, currency, nonce, token_hash, signature, status, note, expires_at, created_at')
      .eq('id', parsed.paymentRequestId)
      .maybeSingle();

    if (error || !paymentRequest) {
      return json({ error: { code: 'REQUEST_NOT_FOUND', message: 'La solicitud NFC no existe o ya no está disponible.' } }, 404, corsHeaders);
    }

    const validation = await validatePaymentRequestToken(paymentRequest, token, parsed);
    if (!validation.ok) {
      return json({ error: { code: validation.code, message: validation.message } }, validation.status, corsHeaders);
    }

    if (paymentRequest.receiver_user_id === payerUserId) {
      return json({ error: { code: 'SELF_TRANSFER', message: 'No puedes pagarte a ti mismo por NFC.' } }, 400, corsHeaders);
    }

    const { data: receiverUser } = await client.database
      .from('phone_users')
      .select('id, name, phone')
      .eq('id', paymentRequest.receiver_user_id)
      .maybeSingle();

    return json({
      paymentRequest: publicPaymentRequest(paymentRequest, receiverUser)
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error consultando solicitud de pago.' } }, 500, corsHeaders);
  }
};

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function resolveSessionUserId(request, body) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer phone-session-')) return auth.replace('Bearer phone-session-', '') || null;
  if (auth.startsWith('Bearer fg1.')) {
    const [, payload] = auth.replace('Bearer ', '').split('.');
    const sub = decodeJwtSub(payload || '');
    if (sub) return sub;
  }
  if (body && body.userId) return String(body.userId);
  return null;
}

function decodeJwtSub(payload) {
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))));
    if (parsed.exp && parsed.exp * 1000 < Date.now()) return null;
    return parsed.sub || null;
  } catch (_) {
    return null;
  }
}

function decodeToken(token) {
  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))));
  } catch (_) {
    return null;
  }
}

async function validatePaymentRequestToken(row, token, parsed) {
  if (row.status !== 'pending') {
    return { ok: false, status: 409, code: 'REQUEST_NOT_PENDING', message: 'Esta solicitud ya fue usada o cancelada.' };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 410, code: 'TOKEN_EXPIRED', message: 'El cobro NFC expiró. Pide al receptor crear uno nuevo.' };
  }
  if (row.nonce !== parsed.nonce) {
    return { ok: false, status: 400, code: 'INVALID_NONCE', message: 'El token NFC no coincide con la solicitud.' };
  }
  if (row.token_hash !== await sha256(token)) {
    return { ok: false, status: 400, code: 'INVALID_TOKEN_HASH', message: 'El token NFC fue alterado.' };
  }
  const expected = await signPaymentRequest({
    id: row.id,
    receiverUserId: row.receiver_user_id,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'COP',
    nonce: row.nonce,
    expiresAt: row.expires_at
  });
  if (expected !== row.signature || expected !== parsed.signature) {
    return { ok: false, status: 400, code: 'INVALID_SIGNATURE', message: 'La firma del token NFC no es válida.' };
  }
  return { ok: true };
}

async function signPaymentRequest(input) {
  const secret = Deno.env.get('PAYMENT_REQUEST_SIGNING_SECRET') || Deno.env.get('ANON_KEY') || 'fingrow-dev-signing-secret';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const canonical = `${input.id}.${input.receiverUserId}.${input.amount}.${input.currency}.${input.nonce}.${input.expiresAt}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));
  return b64url(new Uint8Array(signature));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return b64url(new Uint8Array(digest));
}

function b64url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function publicPaymentRequest(row, receiverUser) {
  return {
    id: row.id,
    receiver: {
      id: row.receiver_user_id,
      name: receiverUser?.name || 'Receptor',
      phone: receiverUser?.phone
    },
    amount: Number(row.amount) || 0,
    currency: row.currency || 'COP',
    note: row.note || null,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
