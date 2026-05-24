Function: Financial Chat (financial-chat)
Status:   active
Desc:     AI financial agent powered by Gemini/OpenRouter with wallet, credit, passport, and transaction context.
---
module.exports = async function(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-Api-Key, X-OpenRouter-Api-Key'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('npm:@insforge/sdk');
    const body = await safeJson(request);
    const userId = body.userId || extractUserId(request) || DEFAULT_PHONE_USER;
    const message = String(body.message || '').trim();
    const history = normalizeHistory(body.history);

    if (!message) {
      return json({
        error: {
          code: 'MESSAGE_REQUIRED',
          message: 'Debes enviar una pregunta para el asistente financiero.'
        }
      }, 400, corsHeaders);
    }

    if (message.length > 1200) {
      return json({
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: 'Haz una pregunta más corta para poder analizarla bien.'
        }
      }, 400, corsHeaders);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const context = await loadFinancialContext(client, userId);
    const openRouterApiKey = getOpenRouterApiKey(request);
    const geminiApiKey = getGeminiApiKey(request);
    const model = body.model
      || (openRouterApiKey ? Deno.env.get('OPENROUTER_MODEL') : Deno.env.get('GEMINI_MODEL'))
      || (openRouterApiKey ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash');

    if (!openRouterApiKey && !geminiApiKey) {
      return json({
        ...buildFallbackResponse(message, context),
        model: 'fallback-rules',
        usedFallback: true
      }, 200, corsHeaders);
    }

    try {
      const aiResponse = openRouterApiKey
        ? await askOpenRouter({ apiKey: openRouterApiKey, model, message, history, context })
        : await askGemini({ apiKey: geminiApiKey, model, message, history, context });

      return json({
        ...normalizeAgentResponse(aiResponse, message, context),
        model,
        usedFallback: false
      }, 200, corsHeaders);
    } catch (error) {
      return json({
        ...buildFallbackResponse(message, context, error?.message),
        model,
        usedFallback: true
      }, 200, corsHeaders);
    }
  } catch (error) {
    return json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error inesperado en el agente financiero.'
      }
    }, 500, corsHeaders);
  }
};

const DEFAULT_PHONE_USER = '36ac6a5a-17c8-4407-b7f3-fc9302bf4ed9';
const EDUARD_PHONE_USER = 'f62c395b-f143-4a12-8764-1e406a47b594';

function extractUserId(request) {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer phone-session-')) return auth.replace('Bearer phone-session-', '');
  return null;
}

async function loadFinancialContext(client, userId) {
  const phoneContext = await loadPhoneFinancialContext(client, userId);
  if (phoneContext) return compactContext(phoneContext);

  const { data: user } = await client.database
    .from('demo_users')
    .select('id, name, phone, user_type, role')
    .eq('id', userId)
    .maybeSingle();

  const { data: wallet } = await client.database
    .from('wallet_accounts')
    .select('balance, currency, monthly_income, monthly_expenses, pending_bills')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: passport } = await client.database
    .from('financial_passports')
    .select('points, level, level_name, next_level_points, progress_percentage, next_benefit')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: credit } = await client.database
    .from('credit_accounts')
    .select('id, original_amount, paid_amount, outstanding_balance, monthly_payment, term_months, risk_level, eligibility, level_label, status, disbursed_at, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('disbursed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: transactions } = await client.database
    .from('transactions')
    .select('type, amount, currency, category, description, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(24);

  return compactContext({
    user: user || {},
    wallet: wallet || {},
    passport: passport || {},
    credit: credit || null,
    transactions: transactions || []
  });
}

async function loadPhoneFinancialContext(client, userId) {
  const { data: user, error } = await client.database
    .from('phone_users')
    .select('id, phone, name, type')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) return null;

  const profile = phoneProfileForUser(userId);
  const creditProfile = phoneCreditForUser(userId);

  return {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      user_type: user.type || 'Cuenta FinGrow'
    },
    wallet: {
      balance: profile.wallet.balance,
      currency: 'COP',
      monthly_income: profile.wallet.monthlyIncome,
      monthly_expenses: profile.wallet.monthlyExpenses,
      pending_bills: profile.wallet.pendingBills
    },
    passport: {
      points: profile.passport.points,
      level: profile.passport.level,
      level_name: profile.passport.levelName,
      next_level_points: profile.passport.nextLevelPoints,
      progress_percentage: profile.passport.progressPercentage,
      next_benefit: profile.passport.nextBenefit
    },
    credit: creditProfile.usedAmount > 0 ? {
      original_amount: creditProfile.usedAmount,
      paid_amount: 0,
      outstanding_balance: creditProfile.usedAmount,
      monthly_payment: creditProfile.safeMonthlyPayment,
      term_months: 12,
      risk_level: creditProfile.risk,
      eligibility: creditProfile.eligibility,
      level_label: creditProfile.level,
      status: 'active'
    } : null,
    transactions: []
  };
}

function phoneProfileForUser(userId) {
  if (userId === EDUARD_PHONE_USER) {
    return {
      wallet: { balance: 1500000, monthlyIncome: 2200000, monthlyExpenses: 1500000, pendingBills: 1 },
      passport: { points: 180, level: 2, levelName: 'Estable', nextLevelPoints: 400, progressPercentage: 45, nextBenefit: 'Menor interés en créditos' }
    };
  }
  return {
    wallet: { balance: 2500000, monthlyIncome: 3200000, monthlyExpenses: 2100000, pendingBills: 2 },
    passport: { points: 420, level: 3, levelName: 'Confiable', nextLevelPoints: 700, progressPercentage: 60, nextBenefit: 'Aumento de cupo de crédito' }
  };
}

function phoneCreditForUser(userId) {
  if (userId === EDUARD_PHONE_USER) {
    return {
      availableAmount: 2000000,
      maxAmount: 3500000,
      usedAmount: 0,
      safeMonthlyPayment: 280000,
      risk: 'medio-bajo',
      eligibility: 65,
      level: 'Nivel 2 — Estable',
      nextTierAmount: 3500000,
      pointsToNextTier: 220
    };
  }
  return {
    availableAmount: 5000000,
    maxAmount: 8000000,
    usedAmount: 0,
    safeMonthlyPayment: 450000,
    risk: 'bajo',
    eligibility: 82,
    level: 'Nivel 3 — Confiable',
    nextTierAmount: 8000000,
    pointsToNextTier: 280
  };
}

function compactContext(raw) {
  const income = Number(raw.wallet.monthly_income || 0);
  const expenses = Number(raw.wallet.monthly_expenses || 0);
  const balance = Number(raw.wallet.balance || 0);
  const margin = Math.max(0, income - expenses);
  const safePaymentCapacity = Math.round(margin * 0.30);
  const topExpenseCategory = getTopExpenseCategory(raw.transactions);

  return {
    user: {
      id: raw.user.id || null,
      name: raw.user.name || 'Usuario FinGrow',
      phone: raw.user.phone || null,
      type: raw.user.user_type || 'Cuenta FinGrow'
    },
    wallet: {
      balance,
      currency: raw.wallet.currency || 'COP',
      monthlyIncome: income,
      monthlyExpenses: expenses,
      freeMargin: margin,
      safePaymentCapacity,
      pendingBills: Number(raw.wallet.pending_bills || 0)
    },
    passport: {
      points: Number(raw.passport.points || 0),
      level: Number(raw.passport.level || 1),
      levelName: raw.passport.level_name || 'Inicial',
      nextLevelPoints: Number(raw.passport.next_level_points || 0),
      progressPercentage: Number(raw.passport.progress_percentage || 0),
      nextBenefit: raw.passport.next_benefit || null
    },
    credit: raw.credit ? {
      originalAmount: Number(raw.credit.original_amount || 0),
      paidAmount: Number(raw.credit.paid_amount || 0),
      outstandingBalance: Number(raw.credit.outstanding_balance || 0),
      monthlyPayment: Number(raw.credit.monthly_payment || 0),
      termMonths: Number(raw.credit.term_months || 0),
      riskLevel: raw.credit.risk_level || 'medio-bajo',
      eligibility: Number(raw.credit.eligibility || 67),
      levelLabel: raw.credit.level_label || raw.passport.level_name || 'Confiable',
      status: raw.credit.status || 'active'
    } : {
      originalAmount: 0,
      paidAmount: 0,
      outstandingBalance: 0,
      monthlyPayment: 0,
      termMonths: 0,
      riskLevel: 'medio-bajo',
      eligibility: 67,
      levelLabel: raw.passport.level_name || 'Confiable',
      status: 'estimated'
    },
    spending: {
      topCategory: topExpenseCategory.category,
      topCategoryAmount: topExpenseCategory.amount
    },
    recentTransactions: raw.transactions.slice(0, 12).map((transaction) => ({
      type: transaction.type,
      amount: Number(transaction.amount || 0),
      category: transaction.category || 'Sin categoría',
      description: transaction.description || 'Movimiento financiero',
      status: transaction.status || 'posted',
      createdAt: transaction.created_at
    }))
  };
}

async function askGemini({ apiKey, model, message, history, context }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildGeminiPlainSystemPrompt() }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildGeminiPlainPrompt(message, history, context) }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 500
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini respondió con estado ${response.status}`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini no devolvió contenido interpretable.');
  return { answer: text };
}

async function askOpenRouter({ apiKey, model, message, history, context }) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('APP_PUBLIC_URL') || 'https://eh28u6b7.us-east.insforge.app',
      'X-Title': 'FinGrow'
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(message, history, context) }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenRouter respondió con estado ${response.status}`);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter no devolvió contenido interpretable.');
  return parseModelJson(text);
}

function buildGeminiContents(message, history, context) {
  const previousTurns = history.slice(-6).map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }]
  }));

  return [
    ...previousTurns,
    {
      role: 'user',
      parts: [{ text: buildUserPrompt(message, [], context) }]
    }
  ];
}

function buildGeminiPlainSystemPrompt() {
  return `
Eres el agente financiero de FinGrow para microempresarios en Colombia.
Responde en español, con tono claro y práctico. Usa SOLO el contexto entregado.
No prometas aprobación de crédito. No pidas PIN, claves ni datos sensibles.
No uses markdown, emojis, tablas ni listas largas. Máximo 420 caracteres.
`;
}

function buildGeminiPlainPrompt(message, history, context) {
  return `
Pregunta del usuario: ${message}

Historial reciente: ${JSON.stringify(history.slice(-6))}

Contexto financiero real: ${JSON.stringify(context)}

Responde con una recomendación principal breve. Si pide plan financiero, resume el plan y deja los pasos para suggestedActions del sistema. Si pregunta por préstamo, compara la cuota prudente con el monto pedido y menciona que no es aprobación.
`;
}

function buildSystemPrompt() {
  return `
Eres el agente financiero de FinGrow para microempresarios en Colombia.

Tu trabajo:
- Responder preguntas sobre saldo, ingresos, gastos, préstamos/crédito, Pasaporte Financiero y movimientos recientes usando SOLO el contexto JSON entregado.
- Crear planes financieros accionables cuando el usuario lo pida.
- Explicar con lenguaje simple, cálido y concreto.
- Si faltan datos, dilo claramente y recomienda el siguiente paso.
- No prometas aprobación de crédito, no inventes centrales de riesgo y no des asesoría legal/tributaria definitiva.
- No pidas datos sensibles como PIN, contraseñas, claves o documentos completos.
- No uses markdown, listas dentro de answer, emojis ni saltos de línea en answer. Las listas van en suggestedActions.
- Mantén answer en máximo 420 caracteres.

Devuelve únicamente JSON válido con este schema:
{
  "answer": "respuesta principal en español, concreta y útil",
  "riskLevel": "low" | "medium" | "high",
  "cards": [{ "title": "métrica corta", "value": "valor corto" }],
  "suggestedActions": ["acción 1", "acción 2", "acción 3"],
  "disclaimer": "orientación breve"
}
`;
}

function buildUserPrompt(message, history, context) {
  return `
Pregunta del usuario:
${message}

Historial reciente:
${JSON.stringify(history.slice(-6))}

Contexto financiero real del usuario:
${JSON.stringify(context)}

Instrucciones de respuesta:
- Si pregunta por préstamo, compara cuota posible contra safePaymentCapacity y deuda activa.
- Si pide plan financiero, entrega un plan en 3 a 5 pasos con prioridades semanales.
- Si pregunta por gastos, usa topCategory y recentTransactions.
- Si pregunta por Pasaporte, usa points, levelName, progressPercentage y nextBenefit.
- Mantén cards en máximo 3 elementos y suggestedActions en máximo 5.
`;
}

function normalizeAgentResponse(value, message, context) {
  const fallback = buildFallbackResponse(message, context);
  const cards = Array.isArray(value?.cards) ? value.cards.slice(0, 3) : fallback.cards;
  const suggestedActions = Array.isArray(value?.suggestedActions)
    ? value.suggestedActions.slice(0, 5).map(String).filter(Boolean)
    : fallback.suggestedActions;
  const candidateAnswer = cleanAnswerText(value?.answer || '');

  return {
    answer: isCompleteAnswer(candidateAnswer) ? candidateAnswer : fallback.answer,
    riskLevel: normalizeRisk(value?.riskLevel || fallback.riskLevel),
    cards: cards.map((card) => ({
      title: String(card?.title || 'Dato').slice(0, 32),
      value: String(card?.value || '-').slice(0, 40)
    })),
    suggestedActions: suggestedActions.length ? suggestedActions : fallback.suggestedActions,
    disclaimer: String(value?.disclaimer || fallback.disclaimer).trim()
  };
}

function isCompleteAnswer(value) {
  if (!value || value.length < 80) return false;
  if (!/[.!?]$/.test(value.trim())) return false;
  return !/(\bte permite|\bpuede|\bpara|\bcon|\bde|\bque|\by)$/i.test(value.trim());
}

function buildFallbackResponse(message, context, errorMessage) {
  const intent = detectIntent(message);
  const wallet = context.wallet;
  const passport = context.passport;
  const credit = context.credit;
  const safePayment = wallet.safePaymentCapacity;

  if (intent === 'loan') {
    const requestedAmount = extractAmount(message) || 1000000;
    const estimatedPayment = Math.round((requestedAmount / 10) * 1.25 / 1000) * 1000;
    const riskLevel = estimatedPayment > safePayment || credit.outstandingBalance > 0 ? 'high' : 'medium';
    return {
      answer: `Con tus datos actuales, una cuota prudente sería hasta ${formatCop(safePayment)} al mes. Para un préstamo de ${formatCop(requestedAmount)}, estimaría una cuota cercana a ${formatCop(estimatedPayment)}. ${credit.outstandingBalance > 0 ? `Además ya tienes saldo pendiente por ${formatCop(credit.outstandingBalance)}, así que conviene bajar deuda antes de pedir más.` : 'Puedes simularlo, pero mantén margen para facturas y gastos del negocio.'}`,
      riskLevel,
      cards: [
        { title: 'Cuota prudente', value: `${formatCop(safePayment)}/mes` },
        { title: 'Deuda activa', value: formatCop(credit.outstandingBalance) },
        { title: 'Riesgo', value: riskLevel === 'high' ? 'Alto' : 'Medio' }
      ],
      suggestedActions: [
        `No tomes cuotas superiores a ${formatCop(safePayment)}`,
        'Simula el crédito antes de aceptarlo',
        'Prioriza pagar facturas y deuda activa',
        'Conserva efectivo para inventario o emergencias'
      ],
      disclaimer: buildDisclaimer(errorMessage)
    };
  }

  if (intent === 'plan') {
    return {
      answer: `Te propongo un plan simple: primero protege tu saldo disponible de ${formatCop(wallet.balance)}, luego separa pagos pendientes y usa máximo ${formatCop(safePayment)} al mes para deuda. Tu Pasaporte está en ${passport.levelName}, así que subir consistencia de pagos puede ayudarte a mejorar condiciones.` ,
      riskLevel: 'medium',
      cards: [
        { title: 'Saldo', value: formatCop(wallet.balance) },
        { title: 'Margen libre', value: formatCop(wallet.freeMargin) },
        { title: 'Pasaporte', value: passport.levelName }
      ],
      suggestedActions: [
        'Semana 1: separa dinero para facturas y gastos fijos',
        'Semana 2: registra todos los ingresos del negocio',
        'Semana 3: reduce la categoría de mayor gasto',
        'Semana 4: simula crédito solo si la cuota cabe en tu margen'
      ],
      disclaimer: buildDisclaimer(errorMessage)
    };
  }

  if (intent === 'spending') {
    return {
      answer: `Tus gastos mensuales estimados son ${formatCop(wallet.monthlyExpenses)}. En movimientos recientes, la categoría que más pesa es ${context.spending.topCategory} con ${formatCop(context.spending.topCategoryAmount)}. Ahí está la primera palanca para mejorar flujo.`,
      riskLevel: 'medium',
      cards: [
        { title: 'Gastos/mes', value: formatCop(wallet.monthlyExpenses) },
        { title: 'Mayor gasto', value: context.spending.topCategory },
        { title: 'Margen', value: formatCop(wallet.freeMargin) }
      ],
      suggestedActions: [
        'Revisa los últimos movimientos grandes',
        'Separa gastos fijos de gastos variables',
        'Define un tope semanal para la categoría más alta'
      ],
      disclaimer: buildDisclaimer(errorMessage)
    };
  }

  if (intent === 'passport') {
    return {
      answer: `Tu Pasaporte Financiero está en ${passport.levelName} con ${passport.points} puntos y ${passport.progressPercentage}% de progreso. Para subir, prioriza pagos a tiempo, registros consistentes e ingresos claros.`,
      riskLevel: 'low',
      cards: [
        { title: 'Puntos', value: String(passport.points) },
        { title: 'Progreso', value: `${passport.progressPercentage}%` },
        { title: 'Nivel', value: passport.levelName }
      ],
      suggestedActions: [
        'Paga facturas antes del vencimiento',
        'Registra ingresos de cada venta importante',
        'Evita movimientos duplicados o inconsistentes'
      ],
      disclaimer: buildDisclaimer(errorMessage)
    };
  }

  return {
    answer: `Veo saldo disponible de ${formatCop(wallet.balance)}, ingresos estimados de ${formatCop(wallet.monthlyIncome)} y gastos de ${formatCop(wallet.monthlyExpenses)}. Tu margen aproximado es ${formatCop(wallet.freeMargin)}. Te recomiendo cuidar facturas, revisar gastos recientes y simular cualquier préstamo antes de tomarlo.`,
    riskLevel: 'medium',
    cards: [
      { title: 'Saldo', value: formatCop(wallet.balance) },
      { title: 'Margen', value: formatCop(wallet.freeMargin) },
      { title: 'Cuota prudente', value: formatCop(safePayment) }
    ],
    suggestedActions: [
      'Pregunta por un plan financiero semanal',
      'Consulta si te conviene pedir un préstamo',
      'Revisa en qué estás gastando más'
    ],
    disclaimer: buildDisclaimer(errorMessage)
  };
}

function detectIntent(message) {
  const lower = normalize(message);
  if (lower.includes('plan') || lower.includes('organizar') || lower.includes('presupuesto')) return 'plan';
  if (lower.includes('prestamo') || lower.includes('credito') || lower.includes('pedir') || lower.includes('endeudar')) return 'loan';
  if (lower.includes('gaste') || lower.includes('gasto') || lower.includes('gastando') || lower.includes('movimiento')) return 'spending';
  if (lower.includes('pasaporte') || lower.includes('subir') || lower.includes('puntos') || lower.includes('nivel')) return 'passport';
  return 'general';
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: String(item?.content || '').slice(0, 900)
  })).filter((item) => item.content.trim());
}

function getTopExpenseCategory(transactions) {
  const totals = {};
  for (const transaction of transactions) {
    if (!['expense', 'bill_payment', 'loan_payment', 'transfer_out'].includes(transaction.type)) continue;
    const category = transaction.category || 'Sin categoría';
    totals[category] = (totals[category] || 0) + Math.abs(Number(transaction.amount || 0));
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { category: 'Sin gastos recientes', amount: 0 };
  return { category: entries[0][0], amount: entries[0][1] };
}

function extractAmount(message) {
  const clean = message.replace(/\./g, '').replace(/,/g, '');
  const match = clean.match(/\$?\s*(\d{5,})/);
  return match ? Number(match[1]) : null;
}

function parseModelJson(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const objectText = extractFirstJsonObject(cleaned);
    if (objectText) {
      try {
        return JSON.parse(objectText);
      } catch (_) {
        const answer = extractJsonStringField(objectText, 'answer');
        if (answer) return { answer };
      }
    }
    const looseAnswer = extractJsonStringField(cleaned, 'answer');
    if (looseAnswer) return { answer: looseAnswer };
    return { answer: cleaned };
  }
}

function extractJsonStringField(text, fieldName) {
  const field = `"${fieldName}"`;
  const fieldIndex = text.indexOf(field);
  if (fieldIndex < 0) return null;

  const colonIndex = text.indexOf(':', fieldIndex + field.length);
  if (colonIndex < 0) return null;

  const firstQuote = text.indexOf('"', colonIndex + 1);
  if (firstQuote < 0) return null;

  let escaped = false;
  let value = '';

  for (let index = firstQuote + 1; index < text.length; index++) {
    const char = text[index];
    if (escaped) {
      if (char === 'n' || char === 'r' || char === 't') value += ' ';
      else value += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') return value.trim();
    value += char;
  }

  return value.trim() || null;
}

function cleanAnswerText(value) {
  return String(value || '')
    .replace(/\\n|\\r|\\t/g, ' ')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

function getGeminiApiKey(request) {
  return Deno.env.get('GEMINI_API_KEY')
    || Deno.env.get('GEMINL_API_KEY')
    || Deno.env.get('GOOGLE_API_KEY')
    || Deno.env.get('GOOGLE_GEMINI_API_KEY')
    || Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
    || Deno.env.get('GEMINI_KEY')
    || request.headers.get('X-Gemini-Api-Key');
}

function getOpenRouterApiKey(request) {
  return Deno.env.get('OPENROUTER_API_KEY')
    || Deno.env.get('OPENROUTER_KEY')
    || request.headers.get('X-OpenRouter-Api-Key');
}

function normalizeRisk(value) {
  const normalized = normalize(String(value || 'medium'));
  if (normalized.includes('high') || normalized.includes('alto')) return 'high';
  if (normalized.includes('low') || normalized.includes('bajo')) return 'low';
  return 'medium';
}

function buildDisclaimer(errorMessage) {
  return 'Orientación educativa basada en tus datos de FinGrow; no es aprobación de crédito.';
}

function normalize(value) {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatCop(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString('es-CO')}`;
}

async function safeJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

