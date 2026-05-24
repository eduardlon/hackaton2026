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
    const requestedAmount = Math.round(Number(body.requestedAmount || 2000000));
    const termMonths = Math.round(Number(body.termMonths || 10));
    const purpose = body.purpose || 'Comprar inventario para mi negocio';

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El monto solicitado debe ser mayor a cero.' } }, 400, corsHeaders);
    }

    if (!Number.isFinite(termMonths) || termMonths <= 0) {
      return json({ error: { code: 'INVALID_TERM', message: 'El plazo debe ser mayor a cero.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: wallet, error: walletError } = await client.database
      .from('wallets')
      .select('monthly_income, monthly_expenses')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return json({ error: { code: 'WALLET_NOT_FOUND', message: 'No se encontró información financiera del usuario.' } }, 404, corsHeaders);
    }

    const { data: passport } = await client.database
      .from('passports')
      .select('points, level, level_name, risk_band')
      .eq('user_id', userId)
      .maybeSingle();

    const monthlyIncome = Number(wallet.monthly_income || 0);
    const monthlyExpenses = Number(wallet.monthly_expenses || 0);
    const availableMargin = Math.max(0, monthlyIncome - monthlyExpenses);
    const paymentCapacity = Math.round(availableMargin * 0.30);
    const estimatedMonthlyPayment = calculateMonthlyPayment(requestedAmount, termMonths);
    const riskLevel = calculateRiskLevel({ estimatedMonthlyPayment, paymentCapacity, passportLevel: passport?.level || 1 });
    const responsibleAmount = calculateResponsibleAmount({ requestedAmount, termMonths, paymentCapacity });
    const recommendation = buildRecommendation({ requestedAmount, estimatedMonthlyPayment, paymentCapacity, riskLevel, responsibleAmount });
    const assumptions = [
      `Ingresos mensuales estimados: ${formatCop(monthlyIncome)}`,
      `Gastos mensuales estimados: ${formatCop(monthlyExpenses)}`,
      `Margen disponible estimado: ${formatCop(availableMargin)}`,
      `Capacidad prudente de pago estimada: ${formatCop(paymentCapacity)}`,
      `Nivel actual del Pasaporte: ${passport?.level_name || 'Explorador financiero'}`
    ];
    const suggestedActions = buildSuggestedActions(riskLevel);
    const simulationId = `loan-${crypto.randomUUID()}`;

    return json({
      simulationId,
      requestedAmount,
      termMonths,
      estimatedMonthlyPayment,
      paymentCapacity,
      riskLevel,
      responsibleAmount,
      recommendation,
      assumptions,
      suggestedActions
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado simulando préstamo.' } }, 500, corsHeaders);
  }
};

function calculateMonthlyPayment(amount, termMonths) {
  const monthlyRate = 0.025;
  const payment = amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)));
  return Math.round(payment / 1000) * 1000;
}

function calculateRiskLevel({ estimatedMonthlyPayment, paymentCapacity, passportLevel }) {
  if (paymentCapacity <= 0) return 'high';
  const ratio = estimatedMonthlyPayment / paymentCapacity;
  if (ratio <= 0.75 && passportLevel >= 3) return 'low';
  if (ratio <= 1.05) return 'medium';
  return 'high';
}

function calculateResponsibleAmount({ requestedAmount, termMonths, paymentCapacity }) {
  if (paymentCapacity <= 0) return 0;
  const monthlyRate = 0.025;
  const maxPayment = paymentCapacity * 0.95;
  const principal = maxPayment * ((1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate);
  return Math.min(requestedAmount, Math.round(principal / 100000) * 100000);
}

function buildRecommendation({ requestedAmount, estimatedMonthlyPayment, paymentCapacity, riskLevel, responsibleAmount }) {
  if (riskLevel === 'low') {
    return `El préstamo de ${formatCop(requestedAmount)} es prudente para tu flujo actual. Mantén la cuota cerca de ${formatCop(estimatedMonthlyPayment)} y conserva tus pagos al día.`;
  }

  if (riskLevel === 'medium') {
    return `El préstamo es posible, pero debes cuidar tu flujo de caja. Te recomendamos no superar una cuota mensual de ${formatCop(paymentCapacity)} y considerar un monto responsable cercano a ${formatCop(responsibleAmount)}.`;
  }

  return `El préstamo solicitado puede presionar demasiado tu flujo de caja. Te recomendamos bajar el monto hacia ${formatCop(responsibleAmount)} o extender el plazo antes de asumir una cuota.`;
}

function buildSuggestedActions(riskLevel) {
  const base = [
    'Mantén tus pagos de facturas al día',
    'Registra tus ventas durante 2 semanas más',
    'Evita tomar una cuota superior a tu capacidad prudente de pago'
  ];

  if (riskLevel === 'high') {
    return [
      'Reduce el monto solicitado o aumenta el plazo',
      'Registra más ingresos antes de solicitar crédito',
      'Evita endeudarte si la cuota supera tu capacidad mensual'
    ];
  }

  return base;
}

function formatCop(value) {
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}

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

