Function: Pay Bre-B (pay-breb)
Status:   active
Desc:     Demo Bre-B payment isolated to the authenticated payer wallet.
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
    const userId = resolveUserId(request, body);

    if (!userId) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'No se pudo identificar la sesión del usuario.' } }, 401, corsHeaders);
    }
    const amount = Math.round(Number(body.amount || 0));
    const recipient = String(body.recipient || body.alias || 'Comercio Bre-B').trim();
    const note = String(body.note || 'Pago Bre-B').trim();

    if (!Number.isFinite(amount) || amount < 1000) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El pago mínimo por Bre-B es $1.000.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: wallet, error: walletError } = await client.database
      .from('wallet_accounts')
      .select('id, balance, currency, monthly_expenses')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return json({ error: { code: 'WALLET_NOT_FOUND', message: 'No se encontró la billetera del usuario.' } }, 404, corsHeaders);
    }

    if (Number(wallet.balance) < amount) {
      return json({ error: { code: 'INSUFFICIENT_FUNDS', message: 'No tienes saldo suficiente para este pago.' } }, 400, corsHeaders);
    }

    const now = new Date().toISOString();
    const transactionId = `tx-${crypto.randomUUID()}`;
    const currentBalance = Number(wallet.balance) - amount;
    const monthlyExpenses = Number(wallet.monthly_expenses || 0) + amount;
    const reference = `BREB-${Date.now()}`;

    await client.database
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: userId,
        wallet_id: wallet.id,
        type: 'transfer_out',
        amount,
        currency: wallet.currency || 'COP',
        category: 'Bre-B',
        description: `Pago Bre-B a ${recipient}`,
        status: 'completed',
        idempotency_key: `breb:${userId}:${Date.now()}:${amount}`,
        metadata: { recipient, note, reference, rails: 'bre-b-demo' }
      });

    await client.database
      .from('wallet_accounts')
      .update({
        balance: currentBalance,
        monthly_expenses: monthlyExpenses,
        updated_at: now
      })
      .eq('id', wallet.id);

    return json({
      payment: {
        id: transactionId,
        reference,
        recipient,
        amount,
        status: 'completed',
        paidAt: now
      },
      wallet: {
        previousBalance: wallet.balance,
        currentBalance,
        currency: wallet.currency || 'COP'
      }
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado pagando por Bre-B.' } }, 500, corsHeaders);
  }
};

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function resolveUserId(request, body) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer phone-session-')) return auth.replace('Bearer phone-session-', '') || null;
  if (auth.startsWith('Bearer fg1.')) {
    const [, payload] = auth.replace('Bearer ', '').split('.');
    const sub = decodeJwtSub(payload || '');
    if (sub) return sub;
  }
  return body.userId || body.receiverUserId || body.toUserId || null;
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

