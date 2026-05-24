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
      return json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para confirmar el pago NFC.' } }, 401, corsHeaders);
    }

    if (body.confirmedByUser !== true) {
      return json({ error: { code: 'CONFIRMATION_REQUIRED', message: 'Debes confirmar manualmente antes de pagar.' } }, 400, corsHeaders);
    }

    const token = String(body.token || '').trim();
    const parsed = decodeToken(token);
    if (!token || !parsed?.paymentRequestId || !parsed?.nonce || !parsed?.signature) {
      return json({ error: { code: 'INVALID_TOKEN', message: 'El token NFC no es válido.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: paymentRequest, error: requestError } = await client.database
      .from('payment_requests')
      .select('id, receiver_user_id, payer_user_id, amount, currency, nonce, token_hash, signature, status, note, expires_at, created_at')
      .eq('id', parsed.paymentRequestId)
      .maybeSingle();

    if (requestError || !paymentRequest) {
      return json({ error: { code: 'REQUEST_NOT_FOUND', message: 'La solicitud NFC no existe o expiró.' } }, 404, corsHeaders);
    }

    const validation = await validatePaymentRequestToken(paymentRequest, token, parsed);
    if (!validation.ok) {
      return json({ error: { code: validation.code, message: validation.message } }, validation.status, corsHeaders);
    }

    const receiverUserId = paymentRequest.receiver_user_id;
    if (receiverUserId === payerUserId) {
      return json({ error: { code: 'SELF_TRANSFER', message: 'No puedes pagarte a ti mismo por NFC.' } }, 400, corsHeaders);
    }

    const amount = Math.round(Number(paymentRequest.amount) || 0);
    if (!Number.isFinite(amount) || amount < 1000) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El monto de la solicitud no es válido.' } }, 400, corsHeaders);
    }

    const now = new Date().toISOString();

    const { data: updatedRequest, error: lockError } = await client.database
      .from('payment_requests')
      .update({
        status: 'processing',
        payer_user_id: payerUserId,
        confirmed_at: now,
        updated_at: now
      })
      .eq('id', paymentRequest.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (lockError || !updatedRequest) {
      return json({ error: { code: 'DUPLICATE_OR_NOT_PENDING', message: 'Esta solicitud ya fue procesada o está siendo confirmada.' } }, 409, corsHeaders);
    }

    const { data: payerWallet } = await client.database
      .from('wallets')
      .select('user_id, balance, currency, monthly_expenses')
      .eq('user_id', payerUserId)
      .maybeSingle();

    if (!payerWallet) {
      await markRequest(client, paymentRequest.id, 'pending');
      return json({ error: { code: 'PAYER_WALLET_NOT_FOUND', message: 'No se encontró tu billetera.' } }, 404, corsHeaders);
    }

    const payerBalanceBefore = Number(payerWallet.balance) || 0;
    if (payerBalanceBefore < amount) {
      await markRequest(client, paymentRequest.id, 'pending');
      return json({
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: `Saldo insuficiente. Tienes $${payerBalanceBefore.toLocaleString('es-CO')} y el cobro es $${amount.toLocaleString('es-CO')}.`
        }
      }, 400, corsHeaders);
    }

    const { data: receiverWallet } = await client.database
      .from('wallets')
      .select('user_id, balance, currency, monthly_income')
      .eq('user_id', receiverUserId)
      .maybeSingle();

    if (!receiverWallet) {
      await markRequest(client, paymentRequest.id, 'pending');
      return json({ error: { code: 'RECEIVER_WALLET_NOT_FOUND', message: 'No se encontró la billetera del receptor.' } }, 404, corsHeaders);
    }

    const { data: payerUser } = await client.database
      .from('phone_users')
      .select('id, name, phone')
      .eq('id', payerUserId)
      .maybeSingle();

    const { data: receiverUser } = await client.database
      .from('phone_users')
      .select('id, name, phone')
      .eq('id', receiverUserId)
      .maybeSingle();

    const reference = `PAYREQ:${paymentRequest.id}`;
    const payerBalanceAfter = payerBalanceBefore - amount;
    const receiverBalanceBefore = Number(receiverWallet.balance) || 0;
    const receiverBalanceAfter = receiverBalanceBefore + amount;

    const { data: outTx, error: outInsertErr } = await client.database
      .from('transactions')
      .insert({
        user_id: payerUserId,
        type: 'transfer_out',
        amount,
        category: 'NFC',
        description: `${reference}:OUT`,
        status: 'completed'
      })
      .select('id')
      .single();

    if (outInsertErr) {
      await markRequest(client, paymentRequest.id, 'pending');
      return json({ error: { code: 'PAYER_TX_FAILED', message: `No se pudo registrar el débito: ${outInsertErr.message || 'error desconocido'}` } }, 500, corsHeaders);
    }

    await client.database
      .from('wallets')
      .update({
        balance: payerBalanceAfter,
        monthly_expenses: (Number(payerWallet.monthly_expenses) || 0) + amount,
        updated_at: now
      })
      .eq('user_id', payerUserId);

    const { error: inInsertErr } = await client.database
      .from('transactions')
      .insert({
        user_id: receiverUserId,
        type: 'transfer_in',
        amount,
        category: 'NFC',
        description: `${reference}:IN`,
        status: 'completed'
      });

    if (inInsertErr) {
      console.warn('[confirm-payment-request] receiver tx insert error', inInsertErr);
    }

    await client.database
      .from('wallets')
      .update({
        balance: receiverBalanceAfter,
        monthly_income: (Number(receiverWallet.monthly_income) || 0) + amount,
        updated_at: now
      })
      .eq('user_id', receiverUserId);

    await client.database
      .from('payment_requests')
      .update({
        status: 'completed',
        payer_user_id: payerUserId,
        completed_transaction_id: outTx?.id || null,
        updated_at: now
      })
      .eq('id', paymentRequest.id);

    return json({
      transferId: outTx?.id || `nfc-${Date.now()}`,
      status: 'completed',
      amount,
      reference,
      from: { id: payerUserId, name: payerUser?.name || 'Pagador' },
      to: { id: receiverUserId, name: receiverUser?.name || 'Receptor' },
      paymentRequest: publicPaymentRequest({ ...paymentRequest, status: 'completed' }, receiverUser),
      payerWallet: {
        previousBalance: payerBalanceBefore,
        currentBalance: payerBalanceAfter,
        currency: payerWallet.currency || 'COP'
      },
      receiverWallet: {
        previousBalance: receiverBalanceBefore,
        currentBalance: receiverBalanceAfter,
        currency: receiverWallet.currency || 'COP'
      }
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error confirmando pago NFC.' } }, 500, corsHeaders);
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

async function markRequest(client, id, status) {
  await client.database
    .from('payment_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
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
