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

    const { data: passport, error: passportError } = await client.database
      .from('passports')
      .select('user_id, points, level, level_name, next_level_points, progress_percentage, next_benefit, monthly_points')
      .eq('user_id', userId)
      .single();

    if (passportError || !passport) {
      return json({ error: { code: 'PASSPORT_NOT_FOUND', message: 'No se encontró el Pasaporte Financiero.' } }, 404, corsHeaders);
    }

    const { data: events, error: eventsError } = await client.database
      .from('passport_events')
      .select('id, event_type, points_delta, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (eventsError) {
      return json({ error: { code: 'PASSPORT_EVENTS_ERROR', message: 'No se pudieron cargar los eventos del Pasaporte.' } }, 500, corsHeaders);
    }

    return json({
      points: passport.points,
      level: passport.level,
      levelName: passport.level_name,
      nextLevelPoints: passport.next_level_points,
      progressPercentage: passport.progress_percentage,
      nextBenefit: passport.next_benefit,
      recommendations: buildRecommendations(passport),
      events: (events || []).map((event) => ({
        id: event.id,
        eventType: event.event_type,
        pointsDelta: event.points_delta,
        reason: event.reason,
        createdAt: event.created_at
      }))
    }, 200, corsHeaders);
  } catch (error) {
    return json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error inesperado cargando el Pasaporte Financiero.'
      }
    }, 500, corsHeaders);
  }
};

function buildRecommendations(passport) {
  const base = [
    'Paga tus facturas a tiempo para subir de nivel',
    'Registra tus ingresos y ventas en la app',
    'Mantén tus gastos por debajo del 60% de tus ingresos'
  ];

  if ((passport.level || 1) >= 3) {
    return [
      'Tu nivel te da acceso a mejores condiciones de crédito',
      'Considera abonar extra a tu crédito activo',
      ...base.slice(0, 1)
    ];
  }

  return base;
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
