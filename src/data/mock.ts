import type {
  AIInsight,
  Credit,
  ExpenseCategory,
  FinancialOverview,
  MonthlyEvolution,
  Passport,
  Transaction,
  UpcomingPayment,
  User,
  Wallet,
} from '@/types';

export const mockUser: User = {
  id: 'u-001',
  name: 'Laura Martínez',
  type: 'Microempresaria',
  level: 'Nivel 3 — Confiable',
  levelNumber: 3,
  points: 420,
  nextLevelPoints: 700,
  verified: true,
  email: 'demo@credigrow.app',
};

export const mockWallet: Wallet = {
  balance: 4362036,
  monthlyIncome: 3200000,
  monthlyExpenses: 2100000,
  freeMargin: 1100000,
  sparkline: [
    2.8, 3.0, 2.95, 3.1, 3.0, 3.15, 3.3, 3.25, 3.4, 3.55, 3.75, 3.9, 4.05, 4.15, 4.25, 4.36,
  ],
};

export const mockCredit: Credit = {
  estimatedAmount: 800000,
  safeMonthlyPayment: 180000,
  risk: 'medio-bajo',
  eligibility: 67,
  potentialAmount: 1200000,
  level: 'Nivel 3 — Confiable',
};

export const mockPassport: Passport = {
  levelName: 'Confiable',
  points: 420,
  nextLevel: 700,
  progress: 60,
  nextBenefit: 'microcrédito hasta $1.200.000',
  monthlyPoints: 35,
};

export const mockTransactions: Transaction[] = [
  {
    id: 't-1',
    title: 'Pago factura Afinia',
    amount: -185400,
    time: '09:25',
    points: 20,
    category: 'Factura',
    icon: 'Droplet',
    group: 'hoy',
  },
  {
    id: 't-2',
    title: 'Venta registrada',
    amount: 320000,
    time: '08:47',
    points: 10,
    category: 'Venta',
    icon: 'ShoppingCart',
    group: 'hoy',
  },
  {
    id: 't-3',
    title: 'Transferencia recibida',
    subtitle: 'Banco de Bogotá',
    amount: 150000,
    time: '16:30',
    points: 10,
    category: 'Ingreso',
    icon: 'Building2',
    group: 'ayer',
  },
  {
    id: 't-4',
    title: 'Arriendo',
    amount: -750000,
    time: '10:15',
    points: 0,
    category: 'Gasto fijo',
    icon: 'Home',
    group: 'ayer',
  },
  {
    id: 't-5',
    title: 'Compra inventario',
    amount: -210000,
    time: '14:22',
    date: 'Mar 20',
    points: 0,
    category: 'Gasto',
    icon: 'ShoppingBag',
    group: 'semana',
  },
  {
    id: 't-6',
    title: 'Registro de ingreso',
    amount: 500000,
    time: '11:05',
    date: 'Mar 20',
    points: 20,
    category: 'Ingreso',
    icon: 'Lightbulb',
    group: 'semana',
  },
  {
    id: 't-7',
    title: 'Pago a proveedor',
    amount: -120000,
    time: '17:40',
    date: 'Mar 19',
    points: 0,
    category: 'Gasto',
    icon: 'Send',
    group: 'semana',
  },
];

export const mockUpcomingPayments: UpcomingPayment[] = [
  {
    id: 'p-1',
    title: 'Arriendo',
    amount: 750000,
    status: 'hoy',
    statusLabel: 'Vence hoy',
    pointsReward: 20,
    icon: 'Home',
  },
  {
    id: 'p-2',
    title: 'Factura de luz',
    amount: 185400,
    status: 'pronto',
    statusLabel: 'Vence en 3 días',
    pointsReward: 20,
    icon: 'Lightbulb',
  },
];

export const mockExpenseCategories: ExpenseCategory[] = [
  { name: 'Servicios', amount: 720000, percentage: 34, color: '#8ED000' },
  { name: 'Inventario', amount: 630000, percentage: 30, color: '#A7E800' },
  { name: 'Transporte', amount: 420000, percentage: 20, color: '#C7F25A' },
  { name: 'Comida', amount: 210000, percentage: 10, color: '#F4A53A' },
  { name: 'Otros', amount: 120000, percentage: 6, color: '#B8C0CC' },
];

export const mockEvolution: MonthlyEvolution[] = [
  { month: 'Ene', income: 1800000, expense: 1500000 },
  { month: 'Feb', income: 2000000, expense: 1600000 },
  { month: 'Mar', income: 2400000, expense: 1750000 },
  { month: 'Abr', income: 2700000, expense: 1850000 },
  { month: 'May', income: 3100000, expense: 1950000 },
  { month: 'Jun', income: 3200000, expense: 2100000 },
];

export const mockInsights: AIInsight[] = [
  {
    id: 'i-1',
    title: 'Tus gastos en inventario crecieron 12%',
    description: 'Revisa tus proveedores o negocia mejores precios.',
    icon: 'ShoppingCart',
    trend: 'up',
  },
  {
    id: 'i-2',
    title: 'Puedes ahorrar $180.000 este mes',
    description: 'Reduciendo gastos en transporte y servicios.',
    icon: 'PiggyBank',
    trend: 'down',
  },
  {
    id: 'i-3',
    title: 'Si mantienes este ritmo podrías subir de nivel',
    description: 'A 700 puntos y acceder a mejores beneficios.',
    icon: 'TrendingUp',
    trend: 'up',
  },
];

export const mockOverview: FinancialOverview = {
  status: 'Saludable',
  income: { value: 3200000, deltaPct: 18 },
  expenses: { value: 2100000, deltaPct: 9 },
  savings: { value: 1100000, deltaPct: 30 },
  netBalance: { value: 4362036, deltaPct: 22 },
};
