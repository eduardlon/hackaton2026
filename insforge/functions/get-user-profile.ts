Function: Get User Profile (get-user-profile)
Status:   active
Desc:     Returns isolated complete profile data for the authenticated FinGrow user.
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

    const { data: user, error: userError } = await client.database
      .from('demo_users')
      .select('id, name, email, phone, document_number, user_type, role, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return json({ error: { code: 'USER_NOT_FOUND', message: 'No se encontró el perfil del usuario.' } }, 404, corsHeaders);
    }

    const { data: wallet } = await client.database
      .from('wallet_accounts')
      .select('balance, currency, status, monthly_income, monthly_expenses, pending_bills')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: passport } = await client.database
      .from('financial_passports')
      .select('points, level, level_name, risk_band, next_level_points, progress_percentage, next_benefit')
      .eq('user_id', userId)
      .maybeSingle();

    return json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        documentNumber: user.document_number,
        type: user.user_type,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      wallet: wallet ? {
        balance: wallet.balance,
        currency: wallet.currency,
        status: wallet.status,
        monthlyIncome: wallet.monthly_income,
        monthlyExpenses: wallet.monthly_expenses,
        pendingBills: wallet.pending_bills
      } : null,
      passport: passport ? {
        points: passport.points,
        level: passport.level,
        levelName: passport.level_name,
        riskBand: passport.risk_band,
        nextLevelPoints: passport.next_level_points,
        progressPercentage: passport.progress_percentage,
        nextBenefit: passport.next_benefit
      } : null
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado cargando perfil.' } }, 500, corsHeaders);
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

