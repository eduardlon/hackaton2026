/**
 * Capa de datos del frontend.
 *
 * Estrategia: cada función intenta primero la edge function de Insforge.
 * Si la function no está desplegada o devuelve error, hace fallback al
 * mock local. Así Expo Go siempre tiene UI mientras el backend se cocina.
 */
import {
  mockCredit,
  mockEvolution,
  mockExpenseCategories,
  mockInsights,
  mockOverview,
  mockPassport,
  mockTransactions,
  mockUpcomingPayments,
  mockUser,
  mockWallet,
} from '@/data/mock';
import {
  getAccessToken,
  invokeFunction,
  isInsforgeConfigured,
} from '@/services/insforge';
import type {
  AIInsight,
  Credit,
  ExpenseCategory,
  FinancialOverview,
  MonthlyEvolution,
  Passport,
  SimulatorInput,
  SimulatorResult,
  Transaction,
  TransactionCategory,
  TransactionGroup,
  UpcomingPayment,
  User,
  Wallet,
} from '@/types';

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const delay = (ms = 120) => new Promise<void>((res) => setTimeout(res, ms));

/** Envuelve una llamada a Insforge: si falla, log y retorna `fallback`. */
async function withFallback<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isInsforgeConfigured()) {
    return fallback;
  }
  try {
    return await fn();
  } catch (err) {
    if (__DEV__) {
      console.warn(`[api:${label}] fallback al mock —`, (err as Error).message);
    }
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────
// Tipos del contrato (BACKEND-CONTRACT.md)
// ──────────────────────────────────────────────────────────

type WalletHomeResponse = {
  user: { id: string; name: string; type: string };
  wallet: {
    balance: number;
    currency: 'COP';
    monthlyIncome: number;
    monthlyExpenses: number;
    pendingBills: number;
  };
  passport: {
    points: number;
    level: number;
    levelName: string;
    nextLevelPoints: number;
    progressPercentage: number;
    nextBenefit: string;
  };
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string;
    status: string;
    createdAt: string;
  }[];
};

type PassportResponse = {
  points: number;
  level: number;
  levelName: string;
  nextLevelPoints: number;
  progressPercentage: number;
  nextBenefit: string;
  recommendations: string[];
  events: {
    id: string;
    eventType: string;
    pointsDelta: number;
    reason: string;
    createdAt: string;
  }[];
};

type SimulateLoanResponse = {
  requestedAmount: number;
  termMonths: number;
  estimatedMonthlyPayment: number;
  paymentCapacity: number;
  riskLevel: 'low' | 'medium' | 'high' | string;
  responsibleAmount: number;
  recommendation: string;
  assumptions: string[];
  suggestedActions: string[];
};

type RepayCreditResponse = {
  payment: {
    id: string;
    amount: number;
    paidAt: string;
    status: string;
  };
  wallet: ConfirmBillPaymentResponse['wallet'];
  activeLoan: NonNullable<Credit['activeLoan']>;
};

type CreditProfileResponse = {
  availableAmount: number;
  maxAmount: number;
  usedAmount: number;
  safeMonthlyPayment: number;
  risk: Credit['risk'] | string;
  eligibility: number;
  level: string;
  nextTierAmount: number;
  pointsToNextTier: number;
};

type ObtainCreditResponse = {
  loan: {
    id: string;
    amount: number;
    termMonths: number;
    purpose: string;
    monthlyPayment: number;
    status: string;
    createdAt: string;
  };
  credit: CreditProfileResponse;
  wallet: {
    previousBalance: number;
    currentBalance: number;
    currency: string;
  };
};

type TransferNfcResponse = {
  transferId: string;
  status: 'completed' | 'pending' | string;
  amount: number;
  from: { id: string; name: string };
  to: { id: string; name: string };
};

type BrebPaymentResponse = {
  payment: {
    id: string;
    reference: string;
    recipient: string;
    amount: number;
    status: string;
    paidAt: string;
  };
  wallet: ConfirmBillPaymentResponse['wallet'];
};

type FinancialChatResponse = {
  answer: string;
  riskLevel: string;
  cards: { title: string; value: string }[];
  suggestedActions: string[];
  disclaimer: string;
};

type InvoiceExtraction = {
  provider: string | null;
  amount: number | null;
  currency: string;
  dueDate: string | null;
  reference: string | null;
  category: string | null;
  concept: string | null;
  documentType: string;
  confidence: number;
  requiresReview: boolean;
  warnings: string[];
};

export type ProcessInvoiceResponse = {
  documentId: string;
  status: string;
  usedFallback: boolean;
  model: string;
  extracted: InvoiceExtraction;
};

export type ConfirmBillPaymentResponse = {
  payment: {
    id: string;
    status: string;
    provider: string;
    amount: number;
    reference: string;
    paidAt: string;
  };
  transaction: {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string;
    status: string;
  };
  passportUpdate: {
    eventId: string;
    pointsAdded: number;
    reason: string;
    currentPoints: number;
    level: number;
    levelName: string;
    progressPercentage: number;
  };
  wallet: {
    previousBalance: number;
    currentBalance: number;
    currency: string;
  };
};

export type ProcessInvoiceImageInput = {
  imageBase64: string;
  mimeType?: string;
  fileName?: string | null;
  source?: 'camera' | 'library';
};

type RecordFinancialActivityResponse = {
  transaction: {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string;
    status: string;
    createdAt: string;
  };
  passportUpdate: ConfirmBillPaymentResponse['passportUpdate'];
  wallet: ConfirmBillPaymentResponse['wallet'];
};

// ──────────────────────────────────────────────────────────
// Mapeos (contrato → tipos del frontend)
// ──────────────────────────────────────────────────────────

function levelNumberToLabel(n: number, name: string): string {
  return `Nivel ${n} — ${name}`;
}

function categoryFromBackend(type: string): TransactionCategory {
  switch (type) {
    case 'bill_payment':
      return 'Factura';
    case 'sale':
      return 'Venta';
    case 'income':
    case 'transfer_in':
      return 'Ingreso';
    case 'transfer_out':
      return 'Transferencia';
    case 'fixed_expense':
      return 'Gasto fijo';
    default:
      return 'Gasto';
  }
}

function iconForCategory(cat: TransactionCategory): string {
  switch (cat) {
    case 'Venta':
      return 'ShoppingCart';
    case 'Ingreso':
      return 'Building2';
    case 'Factura':
      return 'Droplet';
    case 'Gasto fijo':
      return 'Home';
    case 'Transferencia':
      return 'Send';
    default:
      return 'ShoppingBag';
  }
}

function groupForDate(iso: string): TransactionGroup {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'ayer';
  return 'semana';
}

function timeFromIso(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function mapWalletHome(res: WalletHomeResponse): {
  user: User;
  wallet: Wallet;
  passport: Passport;
  transactions: Transaction[];
} {
  const user: User = {
    id: res.user.id,
    name: res.user.name,
    type: res.user.type,
    level: levelNumberToLabel(res.passport.level, res.passport.levelName),
    levelNumber: res.passport.level,
    points: res.passport.points,
    nextLevelPoints: res.passport.nextLevelPoints,
    verified: true,
    email: mockUser.email,
  };

  const wallet: Wallet = {
    balance: res.wallet.balance,
    monthlyIncome: res.wallet.monthlyIncome,
    monthlyExpenses: res.wallet.monthlyExpenses,
    freeMargin: res.wallet.monthlyIncome - res.wallet.monthlyExpenses,
    sparkline: mockWallet.sparkline,
  };

  const passport: Passport = {
    levelName: res.passport.levelName,
    points: res.passport.points,
    nextLevel: res.passport.nextLevelPoints,
    progress: res.passport.progressPercentage,
    nextBenefit: res.passport.nextBenefit,
    monthlyPoints: mockPassport.monthlyPoints,
  };

  const transactions: Transaction[] = res.recentTransactions.map((t) => {
    const category = categoryFromBackend(t.type);
    return {
      id: t.id,
      title: t.description,
      amount: ['bill_payment', 'expense', 'transfer_out', 'loan_payment'].includes(t.type)
        ? -Math.abs(t.amount)
        : Math.abs(t.amount),
      time: timeFromIso(t.createdAt),
      points: 0,
      category,
      icon: iconForCategory(category),
      group: groupForDate(t.createdAt),
    };
  });

  return { user, wallet, passport, transactions };
}

function mapPassport(res: PassportResponse): Passport {
  return {
    levelName: res.levelName,
    points: res.points,
    nextLevel: res.nextLevelPoints,
    progress: res.progressPercentage,
    nextBenefit: res.nextBenefit,
    monthlyPoints:
      res.events.reduce((acc, e) => acc + e.pointsDelta, 0) || mockPassport.monthlyPoints,
  };
}

function mapSimulatorResponse(res: SimulateLoanResponse): SimulatorResult {
  const totalPayable = res.estimatedMonthlyPayment * res.termMonths;
  const paymentCapacityPct = res.paymentCapacity
    ? Math.min(100, Math.round((res.estimatedMonthlyPayment / res.paymentCapacity) * 100))
    : 0;

  const capacityLabel: SimulatorResult['capacityLabel'] =
    res.riskLevel === 'low' ? 'Adecuada' : res.riskLevel === 'high' ? 'Riesgosa' : 'Ajustada';

  const aiRecommendation: SimulatorResult['aiRecommendation'] =
    res.riskLevel === 'low' ? 'Aprobado' : res.riskLevel === 'high' ? 'No recomendado' : 'Revisar';

  const passportImpactPoints = res.riskLevel === 'low' ? 25 : res.riskLevel === 'high' ? 5 : 15;

  return {
    monthlyPayment: res.estimatedMonthlyPayment,
    totalPayable,
    paymentCapacityPct,
    capacityLabel,
    aiRecommendation,
    aiNote: res.recommendation,
    passportImpactPoints,
  };
}

// ──────────────────────────────────────────────────────────
// Cache de la respuesta `get-wallet-home`
// ──────────────────────────────────────────────────────────

let walletHomeCache: ReturnType<typeof mapWalletHome> | null = null;
let walletHomeCachedAt = 0;
const CACHE_TTL_MS = 15_000;

function currentUserId(): string | null {
  // El backend identifica el contexto con el access_token. No usamos un ID
  // hardcodeado: si no hay token, no llamamos a las functions.
  return getAccessToken() ? 'me' : null;
}

async function getWalletHome() {
  const now = Date.now();
  if (walletHomeCache && now - walletHomeCachedAt < CACHE_TTL_MS) {
    return walletHomeCache;
  }

  const fallback = {
    user: mockUser,
    wallet: mockWallet,
    passport: mockPassport,
    transactions: mockTransactions,
  };

  const userId = currentUserId();
  if (!userId) {
    walletHomeCache = fallback;
    walletHomeCachedAt = now;
    return fallback;
  }

  const result = await withFallback(
    'get-wallet-home',
    async () => {
      const data = await invokeFunction<WalletHomeResponse>('get-wallet-home', {});
      return mapWalletHome(data);
    },
    fallback
  );

  walletHomeCache = result;
  walletHomeCachedAt = now;
  return result;
}

export function invalidateWalletHomeCache() {
  walletHomeCache = null;
  walletHomeCachedAt = 0;
}

// ──────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────

export async function getUser(): Promise<User> {
  const home = await getWalletHome();
  return home.user;
}

export async function getWallet(): Promise<Wallet> {
  const home = await getWalletHome();
  return home.wallet;
}

export async function getPassport(): Promise<Passport> {
  if (walletHomeCache && Date.now() - walletHomeCachedAt < CACHE_TTL_MS) {
    return walletHomeCache.passport;
  }
  return withFallback(
    'get-passport',
    async () => {
      const data = await invokeFunction<PassportResponse>('get-passport', {});
      return mapPassport(data);
    },
    mockPassport
  );
}

export async function getCredit(): Promise<Credit> {
  return withFallback(
    'get-credit-profile',
    async () => {
      const data = await invokeFunction<CreditProfileResponse>('get-credit-profile', {});
      return {
        estimatedAmount: data.availableAmount,
        safeMonthlyPayment: data.safeMonthlyPayment,
        risk: ['bajo', 'medio-bajo', 'medio', 'medio-alto', 'alto'].includes(String(data.risk))
          ? (data.risk as Credit['risk'])
          : mockCredit.risk,
        eligibility: data.eligibility,
        potentialAmount: data.nextTierAmount || data.maxAmount,
        level: data.level,
      };
    },
    mockCredit
  );
}

export async function getCreditProfile(): Promise<CreditProfileResponse> {
  return withFallback(
    'get-credit-profile',
    async () => invokeFunction<CreditProfileResponse>('get-credit-profile', {}),
    {
      availableAmount: mockCredit.estimatedAmount,
      maxAmount: mockCredit.estimatedAmount,
      usedAmount: 0,
      safeMonthlyPayment: mockCredit.safeMonthlyPayment,
      risk: mockCredit.risk,
      eligibility: mockCredit.eligibility,
      level: mockCredit.level,
      nextTierAmount: mockCredit.potentialAmount,
      pointsToNextTier: Math.max(0, mockUser.nextLevelPoints - mockUser.points),
    }
  );
}

export async function obtainCreditAmount(input: {
  amount: number;
  months: number;
  reason: string;
  simulation: SimulatorResult;
}): Promise<ObtainCreditResponse> {
  const result = await invokeFunction<ObtainCreditResponse>('obtain-credit', {
    amount: input.amount,
    termMonths: input.months,
    purpose: input.reason,
    simulation: input.simulation,
  });
  invalidateWalletHomeCache();
  return result;
}

export async function getTransactions(): Promise<Transaction[]> {
  const home = await getWalletHome();
  if (home.transactions.length >= 5) return home.transactions;
  return [...home.transactions, ...mockTransactions.slice(home.transactions.length)];
}

export async function getUpcomingPayments(): Promise<UpcomingPayment[]> {
  await delay();
  return mockUpcomingPayments;
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  await delay();
  return mockExpenseCategories;
}

export async function getMonthlyEvolution(): Promise<MonthlyEvolution[]> {
  await delay();
  return mockEvolution;
}

export async function getInsights(): Promise<AIInsight[]> {
  await delay();
  return mockInsights;
}

export async function getOverview(): Promise<FinancialOverview> {
  await delay();
  return mockOverview;
}

/** Cálculo local determinístico de cuota — fallback si Insforge no responde. */
function localSimulateLoan({ amount, months, reason }: SimulatorInput): SimulatorResult {
  const rate = 0.02;
  const factor = Math.pow(1 + rate, months);
  const monthlyPayment = Math.round((amount * (rate * factor)) / (factor - 1));
  const totalPayable = monthlyPayment * months;
  const capacityRatio = monthlyPayment / mockWallet.freeMargin;
  const paymentCapacityPct = Math.min(100, Math.round(capacityRatio * 100));

  let capacityLabel: SimulatorResult['capacityLabel'] = 'Adecuada';
  let aiRecommendation: SimulatorResult['aiRecommendation'] = 'Aprobado';
  let aiNote = 'Muy buena probabilidad';

  if (capacityRatio > 0.45 && capacityRatio <= 0.7) {
    capacityLabel = 'Ajustada';
    aiRecommendation = 'Revisar';
    aiNote = 'Probabilidad media — ajusta el monto';
  } else if (capacityRatio > 0.7) {
    capacityLabel = 'Riesgosa';
    aiRecommendation = 'No recomendado';
    aiNote = 'Cuota muy alta para tu flujo';
  }

  void reason;
  const passportImpactPoints =
    aiRecommendation === 'Aprobado' ? 25 : aiRecommendation === 'Revisar' ? 15 : 5;

  return {
    monthlyPayment,
    totalPayable,
    paymentCapacityPct,
    capacityLabel,
    aiRecommendation,
    aiNote,
    passportImpactPoints,
  };
}

export async function simulateLoan(input: SimulatorInput): Promise<SimulatorResult> {
  return withFallback(
    'simulate-loan',
    async () => {
      const data = await invokeFunction<SimulateLoanResponse>('simulate-loan', {
        requestedAmount: input.amount,
        termMonths: input.months,
        purpose: input.reason,
      });
      return mapSimulatorResponse(data);
    },
    localSimulateLoan(input)
  );
}

// ──────────────────────────────────────────────────────────
// Transferencias NFC
// ──────────────────────────────────────────────────────────

export type NfcTransferPayload = {
  /** id del usuario que envía */
  fromUserId: string;
  /** nombre legible del que envía */
  fromName: string;
  /** monto en COP */
  amount: number;
  /** identificador único de la transferencia (idempotencia) */
  reference: string;
  /** ISO timestamp */
  createdAt: string;
  /** opcional: nota */
  note?: string;
};

/** Confirma la recepción NFC contra el backend para mover saldo real. */
export async function confirmNfcTransfer(
  payload: NfcTransferPayload
): Promise<TransferNfcResponse> {
  const data = await invokeFunction<TransferNfcResponse>('confirm-nfc-transfer', {
    fromUserId: payload.fromUserId,
    amount: payload.amount,
    reference: payload.reference,
    note: payload.note,
    createdAt: payload.createdAt,
  });
  invalidateWalletHomeCache();
  return data;
}

export async function payBreb(input: {
  amount: number;
  recipient: string;
  note?: string;
}): Promise<BrebPaymentResponse> {
  const result = await invokeFunction<BrebPaymentResponse>('pay-breb', input);
  invalidateWalletHomeCache();
  return result;
}

export async function askFinancialChat(message: string): Promise<FinancialChatResponse> {
  return invokeFunction<FinancialChatResponse>('financial-chat', { message });
}

export async function processInvoiceDemo(): Promise<ProcessInvoiceResponse> {
  return invokeFunction<ProcessInvoiceResponse>('process-invoice', {
    demoMode: true,
    provider: 'Afinia',
    amount: 185400,
    currency: 'COP',
    dueDate: '2026-05-28',
    reference: `AFINIA-DEMO-${Date.now()}`,
    category: 'Servicios públicos',
  });
}

export async function processInvoiceImage(
  input: ProcessInvoiceImageInput
): Promise<ProcessInvoiceResponse> {
  return invokeFunction<ProcessInvoiceResponse>('process-invoice', {
    imageBase64: input.imageBase64,
    mimeType: input.mimeType || 'image/jpeg',
    fileName: input.fileName || undefined,
    source: input.source,
  });
}

export async function confirmBillPaymentFromInvoice(
  invoice: ProcessInvoiceResponse
): Promise<ConfirmBillPaymentResponse> {
  const { extracted } = invoice;
  if (!extracted.provider || !extracted.amount || !extracted.reference) {
    throw new Error('La factura necesita proveedor, valor y referencia antes de pagar.');
  }

  const result = await invokeFunction<ConfirmBillPaymentResponse>('confirm-bill-payment', {
    documentId: invoice.documentId,
    provider: extracted.provider,
    amount: extracted.amount,
    currency: extracted.currency || 'COP',
    dueDate: extracted.dueDate,
    reference: extracted.reference,
    category: extracted.category || 'Servicios públicos',
    confirmedByUser: true,
    pinConfirmed: true,
  });
  invalidateWalletHomeCache();
  return result;
}

export async function recordFinancialActivity(input: {
  type: 'income' | 'sale';
  amount: number;
  category: string;
  description: string;
}): Promise<RecordFinancialActivityResponse> {
  const result = await invokeFunction<RecordFinancialActivityResponse>('record-financial-activity', input);
  invalidateWalletHomeCache();
  return result;
}

export async function repayCredit(amount: number): Promise<RepayCreditResponse> {
  const result = await invokeFunction<RepayCreditResponse>('repay-credit', { amount });
  invalidateWalletHomeCache();
  return result;
}
