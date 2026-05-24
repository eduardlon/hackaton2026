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
    const receiverUserId = resolveSessionUserId(request, body);

    if (!receiverUserId) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para crear un cobro.' } }, 401, corsHeaders);
    }

    const amount = Math.round(Number(body.amount || 0));
    const currency = String(body.currency || 'COP').trim().toUpperCase();
    const note = String(body.note || 'Cobro FinGrow').trim().slice(0, 120);

    if (!Number.isFinite(amount) || amount < 1000) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El cobro mínimo por NFC es $1.000.' } }, 400, corsHeaders);
    }

    if (currency !== 'COP') {
      return json({ error: { code: 'INVALID_CURRENCY', message: 'Por ahora FinGrow solo permite pagos NFC en COP.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: receiverUser } = await client.database
      .from('phone_users')
      .select('id, name, phone')
      .eq('id', receiverUserId)
      .maybeSingle();

    if (!receiverUser) {
      return json({ error: { code: 'RECEIVER_NOT_FOUND', message: 'No se encontró el usuario receptor.' } }, 404, corsHeaders);
    }

    const { data: receiverWallet } = await client.database
      .from('wallets')
      .select('user_id, currency')
      .eq('user_id', receiverUserId)
      .maybeSingle();

    if (!receiverWallet) {
      return json({ error: { code: 'RECEIVER_WALLET_NOT_FOUND', message: 'No se encontró la billetera del receptor.' } }, 404, corsHeaders);
    }

    const paymentRequestId = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
    const signature = await signPaymentRequest({
      id: paymentRequestId,
      receiverUserId,
      amount,
      currency,
      nonce,
      expiresAt
    });

    const token = await encodeToken({
      paymentRequestId,
      nonce,
      signature
    });

    const insertPayload = {
      id: paymentRequestId,
      receiver_user_id: receiverUserId,
      amount,
      currency,
      nonce,
      token_hash: await sha256(token),
      signature,
      status: 'pending',
      note,
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    const { error: insertError } = await client.database
      .from('payment_requests')
      .insert(insertPayload);

    if (insertError) {
      return json({ error: { code: 'CREATE_FAILED', message: insertError.message || 'No se pudo crear la solicitud NFC.' } }, 500, corsHeaders);
    }

    return json({
      paymentRequest: publicPaymentRequest(insertPayload, receiverUser),
      nfcToken: {
        kind: 'fingrow.payment-request-token',
        version: 1,
        paymentRequestId,
        token,
        expiresAt
      }
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error creando solicitud de pago.' } }, 500, corsHeaders);
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

async function encodeToken(payload) {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decodeSecret() {
  return Deno.env.get('PAYMENT_REQUEST_SIGNING_SECRET') || Deno.env.get('ANON_KEY') || 'fingrow-dev-signing-secret';
}

async function signPaymentRequest(input) {
  const secret = await decodeSecret();
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
