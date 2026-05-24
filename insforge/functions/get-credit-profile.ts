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

    if (!userId) {
      return json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesión para ver tu perfil de crédito.' } }, 401, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY'),
    });

    const { data: user, error: userError } = await client.database
      .from('phone_users')
      .select('id, name, phone, type')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return json({ error: { code: 'USER_NOT_FOUND', message: 'No se encontró el usuario.' } }, 404, corsHeaders);
    }

    const { data: profile } = await client.database
      .from('credit_profiles')
      .select('available_amount, max_amount, used_amount, safe_monthly_payment, risk, eligibility, level, next_tier_amount, points_to_next_tier')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: wallet } = await client.database
      .from('wallets')
      .select('monthly_income, monthly_expenses, balance')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: passport } = await client.database
      .from('passports')
      .select('points, level, level_name, next_level_points')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: activeLoan } = await client.database
      .from('loans')
      .select('id, original_amount, paid_amount, outstanding_balance, monthly_payment, term_months, status, disbursed_at, next_payment_amount')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('disbursed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Defaults derivados si no hay credit_profile pre-calculado ────────────
    const monthlyIncome = Number(wallet?.monthly_income) || 0;
    const monthlyExpenses = Number(wallet?.monthly_expenses) || 0;
    const freeMargin = Math.max(0, monthlyIncome - monthlyExpenses);
    const passportLevel = Number(passport?.level) || 1;
    const passportPoints = Number(passport?.points) || 0;

    const fallbackEstimated = Math.min(monthlyIncome * 1.5, 800000 + (passportLevel * 200000));
    const fallbackMax = Math.min(monthlyIncome * 3, 2000000 + (passportLevel * 500000));
    const fallbackSafePayment = Math.round(freeMargin * 0.35);

    let fallbackRisk = 'medio-bajo';
    let fallbackEligibility = 60 + (passportLevel * 10);
    if (passportLevel <= 1) {
      fallbackRisk = 'medio';
      fallbackEligibility = Math.min(fallbackEligibility, 50);
    } else if (passportLevel >= 3) {
      fallbackRisk = 'bajo';
      fallbackEligibility = Math.min(fallbackEligibility, 90);
    }

    const fallbackLevel = passport?.level_name || 'Explorador financiero';
    const fallbackNextTier = Math.round(fallbackMax);
    const fallbackPointsToNextTier = passport
      ? Math.max(0, (Number(passport.next_level_points) || 200) - passportPoints)
      : 200;

    // Si tenemos credit_profiles, usamos esos valores; si no, los derivados.
    const availableAmount = profile ? Number(profile.available_amount) || 0 : Math.round(fallbackEstimated);
    const maxAmount = profile ? Number(profile.max_amount) || 0 : Math.round(fallbackMax);
    const usedAmountFromProfile = profile ? Number(profile.used_amount) || 0 : 0;
    const safeMonthlyPayment = profile ? Number(profile.safe_monthly_payment) || 0 : Math.round(fallbackSafePayment);
    const risk = (profile && profile.risk) || fallbackRisk;
    const eligibility = profile ? Math.min(100, Number(profile.eligibility) || 0) : Math.min(100, Math.round(fallbackEligibility));
    const level = (profile && profile.level) || fallbackLevel;
    const nextTierAmount = profile ? Number(profile.next_tier_amount) || 0 : fallbackNextTier;
    const pointsToNextTier = profile ? Number(profile.points_to_next_tier) || 0 : Math.round(fallbackPointsToNextTier);

    // ── Info del crédito activo (para barra de progreso "pagado / total") ──
    let activeCreditPayload = null;
    let usedAmount = usedAmountFromProfile;

    if (activeLoan) {
      const originalAmount = Number(activeLoan.original_amount) || 0;
      const paidAmount = Math.max(0, Number(activeLoan.paid_amount) || 0);
      const outstandingBalance = Math.max(0, Number(activeLoan.outstanding_balance) || Math.max(0, originalAmount - paidAmount));
      const monthlyPayment = Number(activeLoan.monthly_payment) || Number(activeLoan.next_payment_amount) || safeMonthlyPayment;
      const termMonths = Number(activeLoan.term_months) || 0;
      const totalPayments = termMonths > 0
        ? termMonths
        : (monthlyPayment > 0 ? Math.ceil(originalAmount / monthlyPayment) : 0);
      const paymentsMade = monthlyPayment > 0
        ? Math.min(totalPayments || 999, Math.floor(paidAmount / monthlyPayment))
        : 0;
      const progressPct = originalAmount > 0
        ? Math.min(100, Math.round((paidAmount / originalAmount) * 100))
        : 0;

      activeCreditPayload = {
        id: activeLoan.id || null,
        originalAmount,
        paidAmount,
        outstandingBalance,
        monthlyPayment,
        months: termMonths,
        paymentsMade,
        paymentsRemaining: Math.max(0, totalPayments - paymentsMade),
        progressPct,
        disbursedAt: activeLoan.disbursed_at || null,
      };

      if (!usedAmount && outstandingBalance > 0) {
        usedAmount = outstandingBalance;
      }
    }

    return json({
      availableAmount: Math.round(availableAmount),
      maxAmount: Math.round(maxAmount),
      usedAmount: Math.round(usedAmount),
      safeMonthlyPayment: Math.round(safeMonthlyPayment),
      risk,
      eligibility,
      level,
      nextTierAmount: Math.round(nextTierAmount),
      pointsToNextTier: Math.round(pointsToNextTier),
      activeCredit: activeCreditPayload,
    }, 200, corsHeaders);
  } catch (error) {
    return json({
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado consultando perfil de crédito.' },
    }, 500, corsHeaders);
  }
};

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
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

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
