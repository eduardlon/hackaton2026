export type User = {
  id: string;
  name: string;
  type: string;
  level: string;
  levelNumber: number;
  points: number;
  nextLevelPoints: number;
  verified: boolean;
  avatarUrl?: string;
  email: string;
};

export type Wallet = {
  balance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  freeMargin: number;
  sparkline: number[];
};

export type Credit = {
  estimatedAmount: number;
  safeMonthlyPayment: number;
  risk: 'bajo' | 'medio-bajo' | 'medio' | 'medio-alto' | 'alto';
  eligibility: number; // 0-100
  potentialAmount: number;
  level: string;
  activeLoan?: ActiveLoan | null;
};

export type ActiveLoan = {
  id: string;
  originalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  progressPercentage: number;
  nextPaymentAmount: number;
  termMonths: number;
  status: 'active' | 'paid' | string;
  disbursedAt?: string;
  updatedAt?: string;
};

export type Passport = {
  level: number;
  levelName: string;
  points: number;
  nextLevel: number;
  progress: number; // 0-100
  nextBenefit: string;
  monthlyPoints: number;
};

export type TransactionCategory =
  | 'Ingreso'
  | 'Gasto'
  | 'Factura'
  | 'Venta'
  | 'Gasto fijo'
  | 'Transferencia';

export type TransactionGroup = 'hoy' | 'ayer' | 'semana';

export type Transaction = {
  id: string;
  title: string;
  subtitle?: string;
  amount: number; // negativo gasto, positivo ingreso
  time: string;
  date?: string;
  points: number;
  category: TransactionCategory;
  icon: string; // nombre lucide
  group: TransactionGroup;
};

export type UpcomingPayment = {
  id: string;
  title: string;
  amount: number;
  status: 'hoy' | 'pronto' | 'futuro';
  statusLabel: string;
  pointsReward: number;
  icon: string;
};

export type ExpenseCategory = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
};

export type MonthlyEvolution = {
  month: string;
  income: number;
  expense: number;
};

export type AIInsight = {
  id: string;
  title: string;
  description: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
};

export type FinancialOverview = {
  status: 'Saludable' | 'Estable' | 'Atención';
  income: { value: number; deltaPct: number };
  expenses: { value: number; deltaPct: number };
  savings: { value: number; deltaPct: number };
  netBalance: { value: number; deltaPct: number };
};

export type SimulatorInput = {
  amount: number;
  months: number;
  reason: string;
};

export type SimulatorResult = {
  monthlyPayment: number;
  totalPayable: number;
  paymentCapacityPct: number;
  capacityLabel: 'Adecuada' | 'Ajustada' | 'Riesgosa';
  aiRecommendation: 'Aprobado' | 'Revisar' | 'No recomendado';
  aiNote: string;
  passportImpactPoints: number;
};

export type Preferences = {
  paymentAlerts: boolean;
  aiRecommendations: boolean;
  biometricLogin: boolean;
};

export type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
};
