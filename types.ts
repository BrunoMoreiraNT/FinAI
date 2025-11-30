export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export interface Transaction {
  id: string;
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
  category: string;
  limit: number;
  period: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  spent?: number; // Calculated field
}

export interface Goal {
  id: string;
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
  dailyExpenses: { date: string; amount: number; originalDate: string }[];
}

export interface DashboardProps {
  summary: FinancialSummary;
  budgets: Budget[];
  goals: Goal[];
  transactions: Transaction[];
  isLoading: boolean;
  onUpdateBudget: (budget: Budget) => void;
  onAddBudget: (budget: Budget) => void;
  onDeleteBudget: (id: string) => void;
  onUpdateGoal: (goal: Goal) => void;
  onAddGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onResetData: () => void;
}