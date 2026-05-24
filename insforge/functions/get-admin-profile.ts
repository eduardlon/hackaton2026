Function: Get Admin Profile (get-admin-profile)
Status:   active
Desc:     Returns bank/admin financial profile with passport, payment capacity, risk level, AI-style summary, and product recommendation.
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
    const userId = body.userId || 'demo-user-001';

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: user, error: userError } = await client.database
      .from('demo_users')
      .select('id, name, user_type')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return json({ error: { code: 'USER_NOT_FOUND', message: 'No se encontró el usuario.' } }, 404, corsHeaders);
    }

    const { data: wallet } = await client.database
      .from('wallet_accounts')
      .select('monthly_income, monthly_expenses')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: passport } = await client.database
      .from('financial_passports')
      .select('points, level, level_name, risk_band')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: payments } = await client.database
      .from('bill_payments')
      .select('id, status')
      .eq('user_id', userId);

    const { data: documents } = await client.database
      .from('documents')
      .select('id, status')
      .eq('user_id', userId);

    const monthlyIncome = Number(wallet?.monthly_income || 0);
    const monthlyExpenses = Number(wallet?.monthly_expenses || 0);
    const paymentCapacity = Math.round(Math.max(0, monthlyIncome - monthlyExpenses) * 0.30);
    const paidBills = (payments || []).filter((payment) => payment.status === 'completed').length;
    const documentsProcessed = (documents || []).filter((document) => ['processed', 'requires_review', 'confirmed'].includes(document.status)).length;
    const riskLevel = calculateAdminRisk({ passport, paymentCapacity });

    return json({
      user: {
        id: user.id,
        name: user.name,
        type: user.user_type
      },
      passport: {
        points: passport?.points || 0,
        level: passport?.level || 1,
        levelName: passport?.level_name || 'Explorador financiero'
      },
      financialSummary: {
        estimatedMonthlyIncome: monthlyIncome,
        estimatedMonthlyExpenses: monthlyExpenses,
        paymentCapacity,
        paidBills,
        latePayments: 0,
        documentsProcessed
      },
      riskLevel,
      aiSummary: buildAiSummary({ user, passport, paymentCapacity, paidBills }),
      productRecommendation: buildProductRecommendation({ passport, riskLevel })
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado cargando perfil admin.' } }, 500, corsHeaders);
  }
};

function calculateAdminRisk({ passport, paymentCapacity }) {
  if (!passport || paymentCapacity <= 0) return 'high';
  if (passport.level >= 4 && paymentCapacity >= 300000) return 'low';
  if (passport.level >= 3 && paymentCapacity >= 200000) return 'medium';
  return 'high';
}

function buildAiSummary({ user, passport, paymentCapacity, paidBills }) {
  return `${user.name} muestra actividad financiera constante, ${paidBills} facturas pagadas y un Pasaporte nivel ${passport?.level_name || 'inicial'}. Su capacidad de pago estimada es ${formatCop(paymentCapacity)}, por lo que puede evaluarse para un producto inicial controlado sin considerar esto una aprobación automática.`;
}

function buildProductRecommendation({ passport, riskLevel }) {
  if (riskLevel === 'low') return 'Microcrédito simulado con mejores condiciones y seguimiento mensual';
  if ((passport?.level || 1) >= 3) return 'Microcrédito inicial simulado hasta $500.000';
  return 'Producto educativo y ahorro guiado antes de crédito';
}

function formatCop(value) {
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

