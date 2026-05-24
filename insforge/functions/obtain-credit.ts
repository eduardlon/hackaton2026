const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

module.exports = async function(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@insforge/sdk');
    const body = await safeJson(request);
    const userId = resolveSessionUserId(request, body);
    const amount = Math.round(Number(body.amount || 0));
    const termMonths = Math.round(Number(body.termMonths || 0));
    const purpose = String(body.purpose || 'Propósito general').trim();

    if (!userId) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para solicitar crédito.' } }, 401);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' } }, 400);
    }

    if (!Number.isFinite(termMonths) || termMonths <= 0) {
      return json({ error: { code: 'INVALID_TERM', message: 'El plazo debe ser mayor a cero.' } }, 400);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY'),
    });

    const { data: user, error: userError } = await client.database
      .from('phone_users')
      .select('id, name, type')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return json({ error: { code: 'USER_NOT_FOUND', message: 'No se encontró el usuario.' } }, 404);
    }

    const { data: activeLoan } = await client.database
      .from('loans')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (activeLoan) {
      return json({ error: { code: 'ACTIVE_CREDIT_EXISTS', message: 'Ya tienes un crédito activo. Debes liquidarlo antes de solicitar otro.' } }, 409);
    }

    const { data: wallet, error: walletError } = await client.database
      .from('wallets')
      .select('user_id, balance, currency, monthly_income, monthly_expenses')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError || !wallet) {
      return json({ error: { code: 'WALLET_NOT_FOUND', message: 'No se encontró la billetera del usuario.' } }, 404);
    }

    const { data: profile } = await client.database
      .from('credit_profiles')
      .select('available_amount, max_amount, used_amount, safe_monthly_payment, risk, eligibility, level, next_tier_amount, points_to_next_tier')
      .eq('user_id', userId)
      .maybeSingle();

    const availableAmount = Number(profile?.available_amount) || 0;
    if (availableAmount > 0 && amount > availableAmount) {
      return json({
        error: {
          code: 'AMOUNT_EXCEEDS_AVAILABLE',
          message: `El monto supera tu cupo disponible de $${availableAmount.toLocaleString('es-CO')}.`,
        },
      }, 400);
    }

    const monthlyIncome = Number(wallet.monthly_income) || 0;
    const monthlyExpenses = Number(wallet.monthly_expenses) || 0;
    const freeMargin = Math.max(0, monthlyIncome - monthlyExpenses);
    const maxAffordableMonthly = Math.max(Number(profile?.safe_monthly_payment) || 0, Math.round(freeMargin * 0.35));
    const monthlyRate = 0.025;
    const monthlyPayment = Math.round(amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths))) / 1000) * 1000;

    if (maxAffordableMonthly > 0 && monthlyPayment > maxAffordableMonthly) {
      return json({
        error: {
          code: 'PAYMENT_EXCEEDS_CAPACITY',
          message: `La cuota estimada de $${monthlyPayment.toLocaleString('es-CO')} supera tu capacidad de pago de $${maxAffordableMonthly.toLocaleString('es-CO')}.`,
        },
      }, 400);
    }

    const now = new Date().toISOString();
    const previousBalance = Number(wallet.balance) || 0;
    const currentBalance = previousBalance + amount;

    const { data: loan, error: loanError } = await client.database
      .from('loans')
      .insert({
        user_id: userId,
        original_amount: amount,
        paid_amount: 0,
        outstanding_balance: amount,
        next_payment_amount: monthlyPayment,
        term_months: termMonths,
        purpose,
        monthly_payment: monthlyPayment,
        status: 'active',
        disbursed_at: now,
        updated_at: now,
      })
      .select('id, original_amount, term_months, purpose, monthly_payment, status, created_at')
      .single();

    if (loanError || !loan) {
      return json({ error: { code: 'LOAN_CREATE_FAILED', message: loanError?.message || 'No se pudo crear el crédito.' } }, 500);
    }

    await client.database
      .from('wallets')
      .update({
        balance: currentBalance,
        updated_at: now,
      })
      .eq('user_id', userId);

    await client.database
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'loan_disbursement',
        amount,
        category: 'Crédito',
        description: `Desembolso de crédito - ${purpose}`,
        status: 'completed',
      });

    const nextAvailableAmount = Math.max(0, availableAmount - amount);
    const nextUsedAmount = (Number(profile?.used_amount) || 0) + amount;

    if (profile) {
      await client.database
        .from('credit_profiles')
        .update({
          available_amount: nextAvailableAmount,
          used_amount: nextUsedAmount,
          updated_at: now,
        })
        .eq('user_id', userId);
    }

    return json({
      loan: {
        id: loan.id,
        amount,
        termMonths,
        purpose,
        monthlyPayment,
        status: loan.status || 'active',
        createdAt: loan.created_at || now,
      },
      credit: {
        availableAmount: nextAvailableAmount,
        maxAmount: Number(profile?.max_amount) || amount,
        usedAmount: nextUsedAmount,
        safeMonthlyPayment: maxAffordableMonthly || monthlyPayment,
        risk: profile?.risk || 'medio-bajo',
        eligibility: Number(profile?.eligibility) || 70,
        level: profile?.level || 'Explorador',
        nextTierAmount: Number(profile?.next_tier_amount) || 0,
        pointsToNextTier: Number(profile?.points_to_next_tier) || 0,
      },
      wallet: {
        previousBalance,
        currentBalance,
        currency: wallet.currency || 'COP',
      },
    }, 201);
  } catch (error) {
    return json({
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado al solicitar crédito.' },
    }, 500);
  }
};

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
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

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
