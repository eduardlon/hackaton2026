Function: Confirm NFC Transfer (confirm-nfc-transfer)
Status:   active
Desc:     Confirma un pago NFC. El PAGADOR (token de sesión) envía al RECEPTOR
          (receiverUserId del body). Descuenta del pagador y acredita al
          receptor. Idempotente vía `transactions.description` + `category`.
---
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
      return json({ error: { code: 'UNAUTHORIZED', message: 'No se pudo identificar al pagador. Inicia sesión.' } }, 401, corsHeaders);
    }

    const receiverUserId = String(body.receiverUserId || body.toUserId || '').trim();
    if (!receiverUserId) {
      return json({ error: { code: 'INVALID_RECEIVER', message: 'No se pudo identificar al receptor del cobro NFC.' } }, 400, corsHeaders);
    }

    if (receiverUserId === payerUserId) {
      return json({ error: { code: 'SELF_TRANSFER', message: 'No puedes pagarte a ti mismo por NFC.' } }, 400, corsHeaders);
    }

    const amount = Math.round(Number(body.amount || 0));
    const reference = String(body.reference || `NFC-${Date.now()}`).trim();
    const note = String(body.note || 'Pago NFC').trim();

    if (!Number.isFinite(amount) || amount < 1000) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El monto NFC debe ser mínimo $1.000.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    // ── Idempotencia: si ya existe una tx NFC con esta referencia, no repetimos
    const idempotencyDescription = `NFC:${reference}`;
    const { data: existing } = await client.database
      .from('transactions')
      .select('id')
      .eq('user_id', payerUserId)
      .eq('category', 'NFC')
      .eq('description', `${idempotencyDescription}:OUT`)
      .maybeSingle();

    if (existing && existing.id) {
      return json({
        error: { code: 'DUPLICATE_TRANSFER', message: 'Este cobro NFC ya fue pagado anteriormente.' }
      }, 409, corsHeaders);
    }

    // ── Validar billetera del PAGADOR ───────────────────────────────────────
    const { data: payerWallet, error: payerWalletError } = await client.database
      .from('wallets')
      .select('user_id, balance, currency, monthly_expenses')
      .eq('user_id', payerUserId)
      .maybeSingle();

    if (payerWalletError || !payerWallet) {
      return json({ error: { code: 'PAYER_WALLET_NOT_FOUND', message: 'No se encontró tu billetera.' } }, 404, corsHeaders);
    }

    const payerBalanceBefore = Number(payerWallet.balance) || 0;
    if (payerBalanceBefore < amount) {
      return json({
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: `Saldo insuficiente. Tienes $${payerBalanceBefore.toLocaleString('es-CO')} y el cobro es $${amount.toLocaleString('es-CO')}.`
        }
      }, 400, corsHeaders);
    }

    // ── Validar billetera del RECEPTOR ──────────────────────────────────────
    const { data: receiverWallet, error: receiverWalletError } = await client.database
      .from('wallets')
      .select('user_id, balance, currency, monthly_income')
      .eq('user_id', receiverUserId)
      .maybeSingle();

    if (receiverWalletError || !receiverWallet) {
      return json({ error: { code: 'RECEIVER_WALLET_NOT_FOUND', message: 'No se encontró la billetera del receptor del cobro.' } }, 404, corsHeaders);
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

    const now = new Date().toISOString();
    const payerBalanceAfter = payerBalanceBefore - amount;
    const payerExpenses = (Number(payerWallet.monthly_expenses) || 0) + amount;
    const receiverBalanceBefore = Number(receiverWallet.balance) || 0;
    const receiverBalanceAfter = receiverBalanceBefore + amount;
    const receiverIncome = (Number(receiverWallet.monthly_income) || 0) + amount;

    const payerName = payerUser?.name || 'Pagador';
    const receiverName = receiverUser?.name || 'Receptor';

    // ── 1) Descontar del PAGADOR ───────────────────────────────────────────
    const { data: outTx, error: outInsertErr } = await client.database
      .from('transactions')
      .insert({
        user_id: payerUserId,
        type: 'transfer_out',
        amount,
        category: 'NFC',
        description: `${idempotencyDescription}:OUT`,
        status: 'completed'
      })
      .select('id')
      .single();

    if (outInsertErr) {
      return json({ error: { code: 'PAYER_TX_FAILED', message: `No se pudo registrar el débito: ${outInsertErr.message || 'error desconocido'}` } }, 500, corsHeaders);
    }

    await client.database
      .from('wallets')
      .update({
        balance: payerBalanceAfter,
        monthly_expenses: payerExpenses,
        updated_at: now
      })
      .eq('user_id', payerUserId);

    // ── 2) Acreditar al RECEPTOR ───────────────────────────────────────────
    const { error: inInsertErr } = await client.database
      .from('transactions')
      .insert({
        user_id: receiverUserId,
        type: 'transfer_in',
        amount,
        category: 'NFC',
        description: `${idempotencyDescription}:IN`,
        status: 'completed'
      });

    if (inInsertErr) {
      console.warn('[confirm-nfc-transfer] receiver insert error', inInsertErr);
    } else {
      await client.database
        .from('wallets')
        .update({
          balance: receiverBalanceAfter,
          monthly_income: receiverIncome,
          updated_at: now
        })
        .eq('user_id', receiverUserId);
    }

    return json({
      transferId: outTx?.id || `nfc-${Date.now()}`,
      status: 'completed',
      amount,
      reference,
      note,
      from: { id: payerUserId, name: payerName },
      to: { id: receiverUserId, name: receiverName },
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
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado confirmando el pago NFC.' } }, 500, corsHeaders);
  }
};

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function resolveSessionUserId(request, body) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer phone-session-')) {
    return auth.replace('Bearer phone-session-', '') || null;
  }
  if (auth.startsWith('Bearer fg1.')) {
    const [, payload] = auth.replace('Bearer ', '').split('.');
    const sub = decodeJwtSub(payload || '');
    if (sub) return sub;
  }
  if (body && body.fromUserId) return String(body.fromUserId);
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

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
