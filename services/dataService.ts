import { Transaction, Budget, Goal, TransactionType } from '../types';

/**
 * NOTE: In a production environment, this service would interact with the Google Sheets API.
 * For this implementation, we are simulating the database using LocalStorage.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'finai_transactions',
  BUDGETS: 'finai_budgets',
  GOALS: 'finai_goals',
};

// Initial Seed Data (Portuguese)
const seedData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
    const today = new Date();
    const transactions: Transaction[] = [
      { id: '1', date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString(), type: TransactionType.INCOME, amount: 5000, category: 'Salário', description: 'Salário Mensal' },
      { id: '2', date: new Date(today.getFullYear(), today.getMonth(), 6).toISOString(), type: TransactionType.EXPENSE, amount: 120, category: 'Contas', description: 'Conta de Luz' },
      { id: '3', date: new Date(today.getFullYear(), today.getMonth(), 8).toISOString(), type: TransactionType.EXPENSE, amount: 65, category: 'Alimentação', description: 'Jantar no Mario\'s' },
      { id: '4', date: new Date(today.getFullYear(), today.getMonth(), 10).toISOString(), type: TransactionType.EXPENSE, amount: 200, category: 'Transporte', description: 'Uber' },
      { id: '5', date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString(), type: TransactionType.EXPENSE, amount: 450, category: 'Alimentação', description: 'Compras do Mês' },
      { id: '6', date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString(), type: TransactionType.EXPENSE, amount: 150, category: 'Lazer', description: 'Cinema e Pipoca' },
    ];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  if (!localStorage.getItem(STORAGE_KEYS.BUDGETS)) {
    const budgets: Budget[] = [
      { id: '1', category: 'Alimentação', limit: 800, period: 'MONTHLY' },
      { id: '2', category: 'Transporte', limit: 400, period: 'MONTHLY' },
      { id: '3', category: 'Lazer', limit: 300, period: 'MONTHLY' },
    ];
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  }

  if (!localStorage.getItem(STORAGE_KEYS.GOALS)) {
    const goals: Goal[] = [
      { id: '1', name: 'Viagem Europa', targetAmount: 5000, currentAmount: 1500, deadline: '2024-12-31' },
      { id: '2', name: 'Reserva de Emergência', targetAmount: 10000, currentAmount: 8000 },
    ];
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
  }
};

seedData();

export const DataService = {
  getTransactions: async (): Promise<Transaction[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  addTransaction: async (transaction: Transaction): Promise<void> => {
    const transactions = await DataService.getTransactions();
    transactions.push(transaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  updateTransaction: async (updatedTransaction: Transaction): Promise<void> => {
    const transactions = await DataService.getTransactions();
    const index = transactions.findIndex(t => t.id === updatedTransaction.id);
    if (index !== -1) {
      transactions[index] = updatedTransaction;
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    }
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const transactions = await DataService.getTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
  },

  getBudgets: async (): Promise<Budget[]> => {
    const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    return data ? JSON.parse(data) : [];
  },

  addBudget: async (budget: Budget): Promise<void> => {
    const budgets = await DataService.getBudgets();
    budgets.push(budget);
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  },

  updateBudget: async (updatedBudget: Budget): Promise<void> => {
    const budgets = await DataService.getBudgets();
    const index = budgets.findIndex(b => b.id === updatedBudget.id);
    if (index !== -1) {
      budgets[index] = updatedBudget;
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    }
  },

  deleteBudget: async (id: string): Promise<void> => {
    const budgets = await DataService.getBudgets();
    const filtered = budgets.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(filtered));
  },

  getGoals: async (): Promise<Goal[]> => {
    const data = localStorage.getItem(STORAGE_KEYS.GOALS);
    return data ? JSON.parse(data) : [];
  },

  addGoal: async (goal: Goal): Promise<void> => {
    const goals = await DataService.getGoals();
    goals.push(goal);
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
  },

  updateGoal: async (updatedGoal: Goal): Promise<void> => {
    const goals = await DataService.getGoals();
    const index = goals.findIndex(g => g.id === updatedGoal.id);
    if (index !== -1) {
      goals[index] = updatedGoal;
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    }
  },

  deleteGoal: async (id: string): Promise<void> => {
    const goals = await DataService.getGoals();
    const filtered = goals.filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(filtered));
  },
  
  resetData: async (): Promise<void> => {
    // We set them to empty arrays strings instead of removing keys
    // to prevent the seedData function from repopulating them on next load.
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([]));
  },
  
  calculateSummary: async () => {
    const transactions = await DataService.getTransactions();
    
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap: Record<string, number> = {};
    const monthlyData: Record<string, { income: number; expense: number }> = {};
    const dailyData: Record<string, number> = {};

    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = date.toLocaleString('pt-BR', { month: 'short' });

      if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expense: 0 };

      if (t.type === TransactionType.INCOME) {
        totalIncome += t.amount;
        monthlyData[monthKey].income += t.amount;
      } else {
        totalExpense += t.amount;
        monthlyData[monthKey].expense += t.amount;
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;

        // Daily expenses logic (sortable by ISO date key)
        const dayKey = date.toISOString().split('T')[0]; 
        dailyData[dayKey] = (dailyData[dayKey] || 0) + t.amount;
      }
    });

    const expensesByCategory = Object.keys(categoryMap).map(key => ({
      name: key,
      value: categoryMap[key]
    }));

    const monthlyCashflow = Object.keys(monthlyData).map(key => ({
      name: key,
      income: monthlyData[key].income,
      expense: monthlyData[key].expense
    }));

    // Sort daily expenses by date
    const dailyExpenses = Object.keys(dailyData).sort().map(key => {
        const [year, month, day] = key.split('-');
        return {
            date: `${day}/${month}`,
            originalDate: key,
            amount: dailyData[key]
        };
    });

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      expensesByCategory,
      monthlyCashflow,
      dailyExpenses
    };
  }
};