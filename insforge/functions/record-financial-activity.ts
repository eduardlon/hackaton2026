Function: Record Financial Activity (record-financial-activity)
Status:   active
Desc:     Records isolated income or sale quick actions for the authenticated FinGrow user.
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
    const type = String(body.type || '').trim();
    const amount = Math.round(Number(body.amount || 0));
    const category = String(body.category || (type === 'sale' ? 'Ventas' : 'Ingresos')).trim();
    const description = String(body.description || (type === 'sale' ? 'Venta registrada' : 'Ingreso registrado')).trim();

    if (!['income', 'sale'].includes(type)) {
      return json({ error: { code: 'INVALID_TYPE', message: 'Solo se permite registrar income o sale.' } }, 400, corsHeaders);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: { code: 'INVALID_AMOUNT', message: 'El monto debe ser mayor a cero.' } }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: wallet, error: walletError } = await client.database
      .from('wallet_accounts')
      .select('id, balance, currency, monthly_income')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return json({ error: { code: 'WALLET_NOT_FOUND', message: 'No se encontró la billetera del usuario.' } }, 404, corsHeaders);
    }

    const { data: passport, error: passportError } = await client.database
      .from('financial_passports')
      .select('id, points')
      .eq('user_id', userId)
      .single();

    if (passportError || !passport) {
      return json({ error: { code: 'PASSPORT_NOT_FOUND', message: 'No se encontró el Pasaporte Financiero.' } }, 404, corsHeaders);
    }

    const now = new Date().toISOString();
    const transactionId = `tx-${crypto.randomUUID()}`;
    const eventId = `pe-${crypto.randomUUID()}`;
    const pointsAdded = type === 'sale' ? 15 : 10;
    const eventType = type === 'sale' ? 'sale_registered' : 'income_registered';
    const reason = type === 'sale' ? 'Venta registrada en la app' : 'Ingreso registrado en la app';
    const currentBalance = Number(wallet.balance) + amount;
    const monthlyIncome = Number(wallet.monthly_income || 0) + amount;
    const updatedPoints = Number(passport.points) + pointsAdded;
    const levelInfo = calculateLevel(updatedPoints);

    await client.database
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: userId,
        wallet_id: wallet.id,
        type,
        amount,
        currency: wallet.currency || 'COP',
        category,
        description,
        status: 'completed',
        idempotency_key: `${type}:${userId}:${Date.now()}:${amount}`,
        metadata: { source: 'quick-action' }
      });

    await client.database
      .from('wallet_accounts')
      .update({
        balance: currentBalance,
        monthly_income: monthlyIncome,
        updated_at: now
      })
      .eq('id', wallet.id);

    await client.database
      .from('financial_passports')
      .update({
        points: updatedPoints,
        level: levelInfo.level,
        level_name: levelInfo.levelName,
        next_level_points: levelInfo.nextLevelPoints,
        progress_percentage: levelInfo.progressPercentage,
        next_benefit: levelInfo.nextBenefit,
        updated_at: now
      })
      .eq('id', passport.id);

    await client.database
      .from('passport_events')
      .insert({
        id: eventId,
        passport_id: passport.id,
        user_id: userId,
        event_type: eventType,
        points_delta: pointsAdded,
        reason,
        metadata: { transactionId, amount, category }
      });

    return json({
      transaction: {
        id: transactionId,
        type,
        amount,
        category,
        description,
        status: 'completed',
        createdAt: now
      },
      passportUpdate: {
        eventId,
        pointsAdded,
        reason,
        currentPoints: updatedPoints,
        level: levelInfo.level,
        levelName: levelInfo.levelName,
        progressPercentage: levelInfo.progressPercentage
      },
      wallet: {
        previousBalance: wallet.balance,
        currentBalance,
        currency: wallet.currency || 'COP'
      }
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado registrando actividad.' } }, 500, corsHeaders);
  }
};

function calculateLevel(points) {
  if (points >= 1000) return { level: 5, levelName: 'Aliado financiero', nextLevelPoints: 1000, progressPercentage: 100, nextBenefit: 'Productos financieros personalizados' };
  if (points >= 700) return { level: 4, levelName: 'Crecimiento', nextLevelPoints: 1000, progressPercentage: Math.min(99, Math.round((points / 1000) * 100)), nextBenefit: 'Mejores recomendaciones y ofertas simuladas' };
  if (points >= 400) return { level: 3, levelName: 'Confiable', nextLevelPoints: 700, progressPercentage: Math.min(99, Math.round((points / 700) * 100)), nextBenefit: 'Microcrédito simulado de hasta $500.000' };
  if (points >= 200) return { level: 2, levelName: 'Organizado', nextLevelPoints: 400, progressPercentage: Math.min(99, Math.round((points / 400) * 100)), nextBenefit: 'Análisis financiero más completo' };
  return { level: 1, levelName: 'Explorador financiero', nextLevelPoints: 200, progressPercentage: Math.min(99, Math.round((points / 200) * 100)), nextBenefit: 'Recomendaciones básicas de hábitos financieros' };
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

