Function: Demo Login (demo-login)
Status:   active
Desc:     Returns a simulated hackathon session using phone plus PIN or biometric demo mode for user, and admin demo mode for bank.
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
    const loginAs = String(body.loginAs || body.role || '').toLowerCase();
    const phone = normalizePhone(body.phone || body.phoneNumber || body.msisdn || '');
    const pin = String(body.pin || body.password || body.passcode || '').trim();
    const biometricConfirmed = Boolean(body.biometricConfirmed);
    const isAdminLogin = loginAs === 'admin' || loginAs === 'bank';

    if (!isAdminLogin && !phone) {
      return json({
        error: {
          code: 'PHONE_REQUIRED',
          message: 'Ingresa tu número de celular para entrar.'
        }
      }, 400, corsHeaders);
    }

    if (!isAdminLogin && !biometricConfirmed && !pin) {
      return json({
        error: {
          code: 'PIN_REQUIRED',
          message: 'Ingresa tu clave o usa huella para entrar.'
        }
      }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    let query = client.database
      .from('demo_users')
      .select('id, name, email, phone, document_number, user_type, role, created_at')

    if (isAdminLogin) {
      query = query.eq('id', 'demo-admin-001');
    } else {
      query = query.eq('phone', phone);
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      return json({ error: { code: 'DEMO_USER_NOT_FOUND', message: 'No se encontró un usuario demo con ese celular.' } }, 404, corsHeaders);
    }

    if (!isAdminLogin && !biometricConfirmed && pin !== '1234') {
      return json({
        error: {
          code: 'INVALID_PIN',
          message: 'La clave ingresada no es correcta.'
        }
      }, 401, corsHeaders);
    }

    return json({
      session: {
        mode: 'demo',
        token: `demo-session-${user.id}`,
        authMethod: biometricConfirmed ? 'biometric' : isAdminLogin ? 'admin-demo' : 'phone-pin',
        warning: 'Sesión simulada para hackathon. No usar como autenticación productiva.'
      },
      user: mapUser(user),
      nextRoute: user.role === 'admin' ? '/admin' : '/wallet'
    }, 200, corsHeaders);
  } catch (error) {
    return json({ error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error inesperado iniciando sesión demo.' } }, 500, corsHeaders);
  }
};

function mapUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    documentNumber: user.document_number,
    type: user.user_type,
    role: user.role,
    createdAt: user.created_at
  };
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('57')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  return digits;
}

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

