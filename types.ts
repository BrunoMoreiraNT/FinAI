
export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  DELETE = 'DELETE' // Novo tipo para ação via chat
}

export interface Transaction {
  id: string;
  userId: string;
  date: string; // ISO Date string
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  merchant?: string;
  paymentMethod?: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limit: number;
  period: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  spent?: number; // Calculated field
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  relatedTransactionId?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expensesByCategory: { name: string; value: number }[];
  monthlyCashflow: { name: string; income: number; expense: number }[];
  dailyHistory: { date: string; expense: number; income: number; originalDate: string }[];
}

// --- Investment Types ---

export enum InvestmentType {
  STOCK = 'Ação',
  FII = 'FII',
  FIXED_INCOME = 'Renda Fixa',
  CRYPTO = 'Cripto',
  FUND = 'Fundo',
  TREASURY = 'Tesouro Direto',
  ETF = 'ETF',
  OTHER = 'Outro'
}

export interface InvestmentAsset {
  id: string;
  userId: string;
  ticker: string; // Name/Ticker e.g., PETR4
  type: InvestmentType;
  broker: string; // e.g., XP, NuInvest
  quantity: number;
  averagePrice: number; // Preço Médio de Compra
  currentPrice: number; // Cotação Atual (Manual update for now)
  priceHistory: { date: string; price: number }[]; // History of price updates
  updatedAt: string;
}

export interface InvestmentTransaction {
  id: string;
  userId: string;
  assetId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  quantity: number;
  price: number; // Price per unit or Total Dividend
  date: string;
  fees?: number;
}

export interface InvestmentSummary {
  totalInvested: number; // Cost basis
  totalEquity: number; // Current market value
  totalProfit: number;
  profitability: number; // %
  allocationByType: { name: string; value: number }[];
  allocationByBroker: { name: string; value: number }[];
  dividendsTotal: number;
  dividendsHistory: { date: string; amount: number; sortIndex: number }[];
  recentDividends: { id: string; date: string; ticker: string; amount: number }[]; 
  portfolioHistory: { date: string; value: number }[];
  selic: number;
  ipca: number;
}

export interface DashboardProps {
  user: User | null;
  summary: FinancialSummary;
  budgets: Budget[];
  goals: Goal[];
  transactions: Transaction[];
  investments: InvestmentAsset[];
  investmentSummary: InvestmentSummary;
  investmentTransactions: InvestmentTransaction[];
  isLoading: boolean;
  // Existing Handlers
  onUpdateBudget: (budget: Budget) => void;
  onAddBudget: (budget: Budget) => void;
  onDeleteBudget: (id: string) => void;
  onUpdateGoal: (goal: Goal) => void;
  onAddGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onResetData: () => void;
  onLogout: () => void;
  // Investment Handlers
  onAddAsset: (asset: InvestmentAsset) => void;
  onUpdateAsset: (asset: InvestmentAsset) => void;
  onDeleteAsset: (id: string) => void;
  onRegisterInvestmentTransaction: (tx: InvestmentTransaction) => void;
  onUpdateInvestmentTransaction: (tx: InvestmentTransaction) => void;
  onDeleteInvestmentTransaction: (id: string) => void;
}
