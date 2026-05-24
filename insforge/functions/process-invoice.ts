Function: Process Invoice (process-invoice)
Status:   active
Desc:     Extract invoice payment data from uploaded images or storage files using OCR/AI with safe demo fallback.
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
    const userId = body.userId || 'demo-user-001';
    const bucket = body.bucket || 'invoices';
    const mimeType = body.mimeType || guessMimeType(body.fileUrl || body.fileKey || body.fileName || '');
    const imageBase64 = extractBase64Image(body.imageBase64 || body.imageDataUrl);
    const openRouterApiKey = getOpenRouterApiKey(request);
    const geminiApiKey = getGeminiApiKey(request);
    const model = body.model
      || (openRouterApiKey ? Deno.env.get('OPENROUTER_MODEL') : Deno.env.get('GEMINI_MODEL'))
      || (openRouterApiKey ? 'openai/gpt-4o-mini' : 'gemini-3.5-flash');

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    if (!body.fileUrl && !body.fileKey && !imageBase64 && !body.demoMode) {
      return json({
        error: {
          code: 'FILE_REQUIRED',
          message: 'Debes enviar una imagen, fileUrl o fileKey para analizar la factura.'
        }
      }, 400, corsHeaders);
    }

    const documentId = `doc-${crypto.randomUUID()}`;
    let extraction;
    let usedFallback = false;

    if ((!openRouterApiKey && !geminiApiKey) || body.demoMode) {
      usedFallback = true;
      extraction = buildDemoExtraction(body);
    } else {
      try {
        const encodedImage = imageBase64 || await fetchFileAsBase64(body.fileUrl || buildStorageUrl(bucket, body.fileKey));
        extraction = openRouterApiKey
          ? await extractWithOpenRouter({
              apiKey: openRouterApiKey,
              model,
              imageBase64: encodedImage,
              mimeType
            })
          : await extractWithGemini({
              apiKey: geminiApiKey,
              model,
              imageBase64: encodedImage,
              mimeType
            });
      } catch (error) {
        usedFallback = true;
        extraction = {
          ...buildDemoExtraction(body),
          confidence: 0.62,
          requiresReview: true,
          warnings: [
            'La IA no pudo procesar la factura en este intento.',
            'Se devolvió una extracción demo para no bloquear la presentación.',
            error?.message || 'Error desconocido de procesamiento.'
          ]
        };
      }
    }

    const normalized = normalizeExtraction(extraction);
    const status = normalized.requiresReview ? 'requires_review' : 'processed';

    const { error: insertError } = await client.database
      .from('documents')
      .insert({
        id: documentId,
        user_id: userId,
        type: normalized.documentType || 'bill',
        bucket,
        file_key: body.fileKey || null,
        file_url: body.fileUrl || null,
        mime_type: mimeType,
        extracted_data: {
          ...normalized,
          model,
          usedFallback
        },
        confidence_score: normalized.confidence,
        status,
        processed_at: new Date().toISOString()
      });

    if (insertError) {
      return json({
        error: {
          code: 'DOCUMENT_SAVE_FAILED',
          message: insertError.message || 'No se pudo guardar el documento procesado.'
        }
      }, 500, corsHeaders);
    }

    return json({
      documentId,
      status,
      usedFallback,
      model,
      extracted: normalized
    }, 200, corsHeaders);
  } catch (error) {
    return json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error inesperado procesando la factura.'
      }
    }, 500, corsHeaders);
  }
};

async function extractWithOpenRouter({ apiKey, model, imageBase64, mimeType }) {
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
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildExtractionPrompt() },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenRouter respondió con estado ${response.status}`);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenRouter no devolvió contenido interpretable.');
  }

  return parseModelJson(text);
}

async function extractWithGemini({ apiKey, model, imageBase64, mimeType }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = buildExtractionPrompt();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini respondió con estado ${response.status}`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini no devolvió contenido interpretable.');
  }

  return parseModelJson(text);
}

function buildExtractionPrompt() {
  return `
Eres un extractor de datos financieros para una billetera digital en Colombia.

Analiza la factura o documento adjunto y extrae únicamente la información necesaria para preparar un pago simulado.

Reglas estrictas:
- Devuelve únicamente JSON válido, sin markdown y sin explicación adicional.
- No inventes datos.
- Si un campo no aparece claramente, usa null.
- Si la confianza es baja, marca requiresReview=true.
- Para amount usa número entero sin símbolos ni separadores.
- Para dueDate usa formato YYYY-MM-DD si es posible.
- Si hay múltiples valores, elige el valor total a pagar.
- Si hay referencia de pago, contrato, cuenta o número de factura, úsalo como reference.
- category debe ser una categoría simple en español.

Schema esperado:
{
  "provider": string | null,
  "amount": number | null,
  "currency": "COP" | string,
  "dueDate": string | null,
  "reference": string | null,
  "category": string | null,
  "concept": string | null,
  "documentType": "bill" | "receipt" | "invoice" | "proof" | "unknown",
  "confidence": number,
  "requiresReview": boolean,
  "warnings": string[]
}
`;
}

async function fetchFileBytes(fileUrl) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo de factura: ${response.status}`);
  }
  return await response.arrayBuffer();
}

async function fetchFileAsBase64(fileUrl) {
  return arrayBufferToBase64(await fetchFileBytes(fileUrl));
}

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini no devolvió JSON válido.');
    return JSON.parse(match[0]);
  }
}

function normalizeExtraction(extraction) {
  const amount = extraction.amount === null || extraction.amount === undefined
    ? null
    : Math.round(Number(String(extraction.amount).replace(/[^0-9.-]/g, '')));
  const confidence = clamp(Number(extraction.confidence ?? 0.5), 0, 1);
  const missingCritical = !extraction.provider || !amount || !extraction.reference;
  const warnings = Array.isArray(extraction.warnings) ? extraction.warnings : [];

  return {
    provider: extraction.provider ? String(extraction.provider).trim() : null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    currency: extraction.currency || 'COP',
    dueDate: normalizeDate(extraction.dueDate),
    reference: extraction.reference ? String(extraction.reference).trim() : null,
    category: extraction.category || 'Servicios públicos',
    concept: extraction.concept || 'Factura por pagar',
    documentType: normalizeDocumentType(extraction.documentType),
    confidence,
    requiresReview: Boolean(extraction.requiresReview) || confidence < 0.75 || missingCritical,
    warnings: missingCritical
      ? [...warnings, 'Faltan campos críticos para confirmar el pago sin revisión.']
      : warnings
  };
}

function buildDemoExtraction(body) {
  return {
    provider: body.provider || 'Afinia',
    amount: body.amount || 185400,
    currency: body.currency || 'COP',
    dueDate: body.dueDate || '2026-05-28',
    reference: body.reference || `AFINIA-DEMO-${Date.now()}`,
    category: body.category || 'Servicios públicos',
    concept: body.concept || 'Factura de energía',
    documentType: 'bill',
    confidence: 0.9,
    requiresReview: false,
    warnings: []
  };
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

function extractBase64Image(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(',');
  const raw = trimmed.startsWith('data:') && commaIndex >= 0
    ? trimmed.slice(commaIndex + 1)
    : trimmed;
  return raw.replace(/\s/g, '');
}

function buildStorageUrl(bucket, fileKey) {
  const baseUrl = Deno.env.get('INSFORGE_BASE_URL') || 'https://eh28u6b7.us-east.insforge.app';
  return `${baseUrl}/api/storage/buckets/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(fileKey)}`;
}

function guessMimeType(path) {
  const lower = String(path).toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

function normalizeDate(value) {
  if (!value) return null;
  const asText = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(asText)) return asText;
  const date = new Date(asText);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeDocumentType(value) {
  const allowed = new Set(['bill', 'receipt', 'invoice', 'proof', 'unknown']);
  return allowed.has(value) ? value : 'bill';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
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

