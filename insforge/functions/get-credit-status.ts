Function: Get Credit Status (get-credit-status)
Status:   active
Desc:     Returns isolated estimated or active credit state for the authenticated FinGrow user.
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

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: credit, error } = await client.database
      .from('credit_accounts')
      .select('id, original_amount, paid_amount, outstanding_balance, monthly_payment, term_months, risk_level, eligibility, level_label, status, disbursed_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('disbursed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return json({ error: { code: 'CREDIT_QUERY_FAILED', message: 'No se pudo consultar el crédito activo.' } }, 500, corsHeaders);
    }

    if (!credit) {
      return json({
        mode: 'estimated',
        estimatedAmount: 800000,
        safeMonthlyPayment: 180000,
        risk: 'medio-bajo',
        eligibility: 67,
        potentialAmount: 1200000,
        level: 'Nivel 3 — Confiable',
        activeLoan: null
      }, 200, corsHeaders);
    }

    const originalAmount = Number(credit.original_amount || 0);
    const paidAmount = Number(credit.paid_amount || 0);
    const outstandingBalance = Number(credit.outstanding_balance || 0);
    const progressPercentage = originalAmount > 0
      ? Math.min(100, Math.round((paidAmount / originalAmount) * 100))
      : 0;

    return json({
      mode: 'active',
      estimatedAmount: originalAmount,
      safeMonthlyPayment: Number(credit.monthly_payment || 0),
      risk: credit.risk_level || 'medio-bajo',
      eligibility: Number(credit.eligibility || 67),
      potentialAmount: 1200000,
      level: credit.level_label || 'Nivel 3 — Confiable',
      activeLoan: {
        id: credit.id,
        originalAmount,
        paidAmount,
        outstandingBalance,
        progressPercentage,
        nextPaymentAmount: Math.min(Number(credit.monthly_payment || 0), outstandingBalance),
        termMonths: Number(credit.term_months || 0),
        status: credit.status,
        disbursedAt: credit.disbursed_at,
        updatedAt: credit.updated_at
      }
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado consultando crédito.' } }, 500, corsHeaders);
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

