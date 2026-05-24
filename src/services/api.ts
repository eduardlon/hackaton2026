import {
  getAccessToken,
  invokeFunction,
} from '@/services/insforge';
import type {
  Credit,
  Passport,
  SimulatorInput,
  SimulatorResult,
  Transaction,
  TransactionCategory,
  TransactionGroup,
  User,
  Wallet,
} from '@/types';

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

export type CreditProfileResponse = {
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

export type FinancialChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type FinancialChatResponse = {
  answer: string;
  riskLevel: string;
  cards: { title: string; value: string }[];
  suggestedActions: string[];
  disclaimer: string;
  model?: string;
  usedFallback?: boolean;
};

export type ProcessInvoiceResponse = {
  documentId: string;
  status: string;
  usedFallback: boolean;
  model: string;
  extracted: {
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
};

type ConfirmBillPaymentResponse = {
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
  if (d.toDateString() === now.toDateString()) return 'hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'ayer';
  return 'semana';
}

function timeFromIso(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

let walletHomeCache: ReturnType<typeof mapWalletHome> | null = null;
let walletHomeCachedAt = 0;
const CACHE_TTL_MS = 15_000;

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
    level: `Nivel ${res.passport.level} — ${res.passport.levelName}`,
    levelNumber: res.passport.level,
    points: res.passport.points,
    nextLevelPoints: res.passport.nextLevelPoints,
    verified: true,
    email: '',
  };

  const wallet: Wallet = {
    balance: res.wallet.balance,
    monthlyIncome: res.wallet.monthlyIncome,
    monthlyExpenses: res.wallet.monthlyExpenses,
    freeMargin: res.wallet.monthlyIncome - res.wallet.monthlyExpenses,
    sparkline: [],
  };

  const passport: Passport = {
    levelName: res.passport.levelName,
    points: res.passport.points,
    nextLevel: res.passport.nextLevelPoints,
    progress: res.passport.progressPercentage,
    nextBenefit: res.passport.nextBenefit,
    monthlyPoints: 0,
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

function currentUserId(): string | null {
  return getAccessToken() ? 'me' : null;
}

async function getWalletHome() {
  const now = Date.now();
  if (walletHomeCache && now - walletHomeCachedAt < CACHE_TTL_MS) {
    return walletHomeCache;
  }

  const userId = currentUserId();
  if (!userId) throw new Error('No hay sesión activa');

  const data = await invokeFunction<WalletHomeResponse>('get-wallet-home', {});
  const result = mapWalletHome(data);

  walletHomeCache = result;
  walletHomeCachedAt = now;
  return result;
}

export function invalidateWalletHomeCache() {
  walletHomeCache = null;
  walletHomeCachedAt = 0;
}

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
  const data = await invokeFunction<PassportResponse>('get-passport', {});
  return {
    levelName: data.levelName,
    points: data.points,
    nextLevel: data.nextLevelPoints,
    progress: data.progressPercentage,
    nextBenefit: data.nextBenefit,
    monthlyPoints: data.events ? data.events.reduce((acc, e) => acc + e.pointsDelta, 0) : 0,
  };
}

function mapCreditProfileToCredit(profile: CreditProfileResponse): Credit {
  return {
    estimatedAmount: profile.availableAmount,
    safeMonthlyPayment: profile.safeMonthlyPayment,
    risk: ['bajo', 'medio-bajo', 'medio', 'medio-alto', 'alto'].includes(String(profile.risk))
      ? (profile.risk as Credit['risk'])
      : 'medio-bajo',
    eligibility: profile.eligibility,
    potentialAmount: profile.nextTierAmount || profile.maxAmount,
    level: profile.level,
    activeLoan: profile.usedAmount > 0
      ? {
          id: '',
          originalAmount: profile.usedAmount,
          paidAmount: 0,
          outstandingBalance: profile.usedAmount,
          progressPercentage: 0,
          nextPaymentAmount: profile.safeMonthlyPayment,
          termMonths: 12,
          status: 'active',
        }
      : null,
  };
}

export async function getCredit(): Promise<Credit> {
  const profile = await invokeFunction<CreditProfileResponse>('get-credit-profile', {});
  return mapCreditProfileToCredit(profile);
}

export async function getCreditProfile(): Promise<CreditProfileResponse> {
  return invokeFunction<CreditProfileResponse>('get-credit-profile', {});
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
  return home.transactions;
}

function localSimulateLoan({ amount, months }: SimulatorInput): SimulatorResult {
  const rate = 0.02;
  const factor = Math.pow(1 + rate, months);
  const monthlyPayment = Math.round((amount * (rate * factor)) / (factor - 1));
  const totalPayable = monthlyPayment * months;
  const capacityRatio = monthlyPayment / ((3200000 - 2100000) || 1100000);
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
  return localSimulateLoan(input);
}

export type NfcTransferPayload = {
  fromUserId: string;
  fromName: string;
  amount: number;
  reference: string;
  createdAt: string;
  note?: string;
};

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

export async function askFinancialChat(
  message: string,
  history: FinancialChatHistoryItem[] = []
): Promise<FinancialChatResponse> {
  return invokeFunction<FinancialChatResponse>('financial-chat', { message, history });
}

export async function processInvoiceImage(
  input: { imageBase64: string; mimeType?: string; fileName?: string | null; source: string }
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
