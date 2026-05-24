Function: Confirm Bill Payment (confirm-bill-payment)
Status:   active
Desc:     Confirms a sandbox bill payment, creates transaction, updates wallet balance, and adds Financial Passport points.
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
    const validation = validatePayload(body);

    if (validation) {
      return json({ error: validation }, validation.httpStatus, corsHeaders);
    }

    const userId = body.userId || 'demo-user-001';
    const amount = Math.round(Number(body.amount));
    const provider = String(body.provider).trim();
    const reference = String(body.reference).trim();
    const category = body.category || 'Servicios públicos';
    const currency = body.currency || 'COP';

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const { data: wallet, error: walletError } = await client.database
      .from('wallet_accounts')
      .select('id, balance, currency, pending_bills')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return json({ error: { code: 'WALLET_NOT_FOUND', message: 'No se encontró la billetera del usuario.' } }, 404, corsHeaders);
    }

    if (wallet.balance < amount) {
      return json({
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'El saldo simulado no alcanza para confirmar el pago.'
        }
      }, 409, corsHeaders);
    }

    const { data: duplicate, error: duplicateError } = await client.database
      .from('bill_payments')
      .select('id, provider, reference, amount, status')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('reference', reference)
      .eq('amount', amount)
      .maybeSingle();

    if (duplicateError) {
      return json({ error: { code: 'DUPLICATE_CHECK_FAILED', message: 'No se pudo verificar si la factura ya fue pagada.' } }, 500, corsHeaders);
    }

    if (duplicate) {
      await createPassportAlert(client, userId, duplicate.id);

      return json({
        error: {
          code: 'DUPLICATE_BILL',
          message: 'Esta factura parece haber sido pagada anteriormente.',
          paymentId: duplicate.id
        }
      }, 409, corsHeaders);
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
    const paymentId = `pay-${crypto.randomUUID()}`;
    const transactionId = `tx-${crypto.randomUUID()}`;
    const eventId = `pe-${crypto.randomUUID()}`;
    const pointsAdded = isPaidOnTime(body.dueDate) ? 20 : 10;
    const updatedPoints = passport.points + pointsAdded;
    const levelInfo = calculateLevel(updatedPoints);
    const currentBalance = wallet.balance - amount;
    const nextPendingBills = Math.max(0, Number(wallet.pending_bills || 0) - 1);

    const { data: paymentRows, error: paymentError } = await client.database
      .from('bill_payments')
      .insert({
        id: paymentId,
        user_id: userId,
        document_id: body.documentId || null,
        provider,
        amount,
        currency,
        due_date: body.dueDate || null,
        reference,
        category,
        status: 'completed',
        paid_at: now
      })
      .select();

    if (paymentError) {
      return json({ error: { code: 'PAYMENT_CREATE_FAILED', message: paymentError.message || 'No se pudo registrar el pago.' } }, 500, corsHeaders);
    }

    const { data: transactionRows, error: transactionError } = await client.database
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: userId,
        wallet_id: wallet.id,
        type: 'bill_payment',
        amount,
        currency,
        category,
        description: `Pago factura ${provider}`,
        status: 'completed',
        idempotency_key: `bill:${userId}:${provider}:${reference}:${amount}`,
        metadata: {
          paymentId,
          documentId: body.documentId || null,
          dueDate: body.dueDate || null,
          paidOnTime: isPaidOnTime(body.dueDate)
        }
      })
      .select();

    if (transactionError) {
      return json({ error: { code: 'TRANSACTION_CREATE_FAILED', message: transactionError.message || 'No se pudo registrar el movimiento.' } }, 500, corsHeaders);
    }

    await client.database
      .from('wallet_accounts')
      .update({
        balance: currentBalance,
        pending_bills: nextPendingBills,
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
        event_type: isPaidOnTime(body.dueDate) ? 'bill_paid_on_time' : 'bill_paid',
        points_delta: pointsAdded,
        reason: isPaidOnTime(body.dueDate) ? 'Factura pagada a tiempo' : 'Factura pagada',
        metadata: {
          paymentId,
          transactionId,
          provider,
          reference,
          amount
        }
      });

    if (body.documentId) {
      await client.database
        .from('documents')
        .update({ status: 'confirmed' })
        .eq('id', body.documentId);
    }

    return json({
      payment: {
        id: paymentId,
        status: 'completed',
        provider,
        amount,
        reference,
        paidAt: now
      },
      transaction: {
        id: transactionId,
        type: 'bill_payment',
        amount,
        category,
        description: `Pago factura ${provider}`,
        status: 'completed'
      },
      passportUpdate: {
        eventId,
        pointsAdded,
        reason: isPaidOnTime(body.dueDate) ? 'Factura pagada a tiempo' : 'Factura pagada',
        currentPoints: updatedPoints,
        level: levelInfo.level,
        levelName: levelInfo.levelName,
        progressPercentage: levelInfo.progressPercentage
      },
      wallet: {
        previousBalance: wallet.balance,
        currentBalance,
        currency
      }
    }, 200, corsHeaders);
  } catch (error) {
    return json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error inesperado confirmando el pago.'
      }
    }, 500, corsHeaders);
  }
};

function validatePayload(body) {
  if (!body.confirmedByUser) {
    return {
      httpStatus: 400,
      code: 'PAYMENT_NOT_CONFIRMED',
      message: 'El usuario debe confirmar explícitamente el pago.'
    };
  }

  if (!body.pinConfirmed) {
    return {
      httpStatus: 400,
      code: 'PIN_NOT_CONFIRMED',
      message: 'La acción sensible requiere confirmación por PIN o biometría simulada.'
    };
  }

  if (!body.provider || !String(body.provider).trim()) {
    return {
      httpStatus: 400,
      code: 'PROVIDER_REQUIRED',
      message: 'La factura necesita un proveedor para confirmar el pago.'
    };
  }

  if (!body.reference || !String(body.reference).trim()) {
    return {
      httpStatus: 400,
      code: 'REFERENCE_REQUIRED',
      message: 'La factura necesita una referencia para evitar pagos duplicados.'
    };
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      httpStatus: 400,
      code: 'AMOUNT_INVALID',
      message: 'La factura necesita un monto válido mayor a cero.'
    };
  }

  return null;
}

async function createPassportAlert(client, userId, duplicatePaymentId) {
  const { data: passport } = await client.database
    .from('financial_passports')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!passport) return;

  await client.database
    .from('passport_events')
    .insert({
      id: `pe-${crypto.randomUUID()}`,
      passport_id: passport.id,
      user_id: userId,
      event_type: 'duplicate_bill_attempt',
      points_delta: 0,
      reason: 'Intento de pago duplicado detectado',
      metadata: { duplicatePaymentId }
    });
}

function isPaidOnTime(dueDate) {
  if (!dueDate) return true;
  const due = new Date(`${dueDate}T23:59:59.999Z`);
  if (Number.isNaN(due.getTime())) return true;
  return new Date() <= due;
}

function calculateLevel(points) {
  if (points >= 1000) {
    return {
      level: 5,
      levelName: 'Aliado financiero',
      nextLevelPoints: 1000,
      progressPercentage: 100,
      nextBenefit: 'Productos financieros personalizados'
    };
  }

  if (points >= 700) {
    return {
      level: 4,
      levelName: 'Crecimiento',
      nextLevelPoints: 1000,
      progressPercentage: Math.min(99, Math.round((points / 1000) * 100)),
      nextBenefit: 'Mejores recomendaciones y ofertas simuladas'
    };
  }

  if (points >= 400) {
    return {
      level: 3,
      levelName: 'Confiable',
      nextLevelPoints: 700,
      progressPercentage: Math.min(99, Math.round((points / 700) * 100)),
      nextBenefit: 'Microcrédito simulado de hasta $500.000'
    };
  }

  if (points >= 200) {
    return {
      level: 2,
      levelName: 'Organizado',
      nextLevelPoints: 400,
      progressPercentage: Math.min(99, Math.round((points / 400) * 100)),
      nextBenefit: 'Análisis financiero más completo'
    };
  }

  return {
    level: 1,
    levelName: 'Explorador financiero',
    nextLevelPoints: 200,
    progressPercentage: Math.min(99, Math.round((points / 200) * 100)),
    nextBenefit: 'Recomendaciones básicas de hábitos financieros'
  };
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function json(payload, status, corsHeaders) {
  const cleanedPayload = payload.error?.httpStatus
    ? { error: { code: payload.error.code, message: payload.error.message } }
    : payload;

  return new Response(JSON.stringify(cleanedPayload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

