
import { 
  Transaction, Budget, Goal, TransactionType, 
  InvestmentAsset, InvestmentTransaction, InvestmentSummary, FinancialSummary
} from '../types';
import { db } from './firebaseConfig';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, getDocs, writeBatch 
} from 'firebase/firestore';

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  BUDGETS: 'budgets',
  GOALS: 'goals',
  INVESTMENTS: 'investment_assets',
  INVESTMENT_TXS: 'investment_transactions'
};

const STORAGE_KEYS = {
  TRANSACTIONS: 'finai_transactions',
  BUDGETS: 'finai_budgets',
  GOALS: 'finai_goals',
  INVESTMENTS: 'finai_investments',
  INVESTMENT_TXS: 'finai_investment_txs'
};

// Helper to get local data for migration
const getLocal = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

export const DataService = {
  
  // Safe UUID generator that works in non-secure contexts (http)
  generateUUID: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch (e) {
        // Fallback if crypto.randomUUID fails (e.g. insecure context)
      }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // --- MIGRATION LOGIC ---
  migrateLocalDataToFirebase: async (userId: string): Promise<void> => {
    const batch = writeBatch(db);
    let hasData = false;

    // Transactions
    const localTxs = getLocal<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    localTxs.forEach(tx => {
      hasData = true;
      const ref = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      batch.set(ref, { ...tx, userId, id: ref.id }); // Use Firestore ID
    });

    // Budgets
    const localBudgets = getLocal<Budget>(STORAGE_KEYS.BUDGETS);
    localBudgets.forEach(b => {
      hasData = true;
      const ref = doc(collection(db, COLLECTIONS.BUDGETS));
      batch.set(ref, { ...b, userId, id: ref.id });
    });

    // Goals
    const localGoals = getLocal<Goal>(STORAGE_KEYS.GOALS);
    localGoals.forEach(g => {
      hasData = true;
      const ref = doc(collection(db, COLLECTIONS.GOALS));
      batch.set(ref, { ...g, userId, id: ref.id });
    });

    // Investments
    const localInvestments = getLocal<InvestmentAsset>(STORAGE_KEYS.INVESTMENTS);
    // Need to map old IDs to new IDs for transactions
    const assetIdMap: Record<string, string> = {}; 
    
    localInvestments.forEach(asset => {
      hasData = true;
      const ref = doc(collection(db, COLLECTIONS.INVESTMENTS));
      assetIdMap[asset.id] = ref.id; // Map old local ID to new Firestore ID
      batch.set(ref, { ...asset, userId, id: ref.id });
    });

    // Investment Transactions
    const localInvTxs = getLocal<InvestmentTransaction>(STORAGE_KEYS.INVESTMENT_TXS);
    localInvTxs.forEach(tx => {
      hasData = true;
      const ref = doc(collection(db, COLLECTIONS.INVESTMENT_TXS));
      // Update assetId to the new one
      const newAssetId = assetIdMap[tx.assetId] || tx.assetId;
      batch.set(ref, { ...tx, userId, assetId: newAssetId, id: ref.id });
    });

    if (hasData) {
      console.log("Migrating local data to Firebase...");
      await batch.commit();
      
      // Clear Local Storage after successful migration
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      console.log("Migration complete and local storage cleared.");
    }
  },

  // --- Transactions ---
  getTransactions: async (userId: string): Promise<Transaction[]> => {
    const q = query(collection(db, COLLECTIONS.TRANSACTIONS), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
  },

  addTransaction: async (transaction: Transaction): Promise<void> => {
    const { id, ...data } = transaction; // Let Firestore handle ID or use provided one
    await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), data);
  },

  updateTransaction: async (transaction: Transaction): Promise<void> => {
    const ref = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
    await updateDoc(ref, { ...transaction });
  },

  deleteTransaction: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, id));
  },

  // --- Budgets ---
  getBudgets: async (userId: string): Promise<Budget[]> => {
    const q = query(collection(db, COLLECTIONS.BUDGETS), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Budget));
  },

  addBudget: async (budget: Budget): Promise<void> => {
    const { id, ...data } = budget;
    await addDoc(collection(db, COLLECTIONS.BUDGETS), data);
  },

  updateBudget: async (updatedBudget: Budget): Promise<void> => {
    const ref = doc(db, COLLECTIONS.BUDGETS, updatedBudget.id);
    await updateDoc(ref, { ...updatedBudget });
  },

  deleteBudget: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.BUDGETS, id));
  },

  // --- Goals ---
  getGoals: async (userId: string): Promise<Goal[]> => {
    const q = query(collection(db, COLLECTIONS.GOALS), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Goal));
  },

  addGoal: async (goal: Goal): Promise<void> => {
    const { id, ...data } = goal;
    await addDoc(collection(db, COLLECTIONS.GOALS), data);
  },

  updateGoal: async (updatedGoal: Goal): Promise<void> => {
    const ref = doc(db, COLLECTIONS.GOALS, updatedGoal.id);
    await updateDoc(ref, { ...updatedGoal });
  },

  deleteGoal: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.GOALS, id));
  },

  // --- Investments ---
  getInvestments: async (userId: string): Promise<InvestmentAsset[]> => {
    const q = query(collection(db, COLLECTIONS.INVESTMENTS), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InvestmentAsset));
  },

  addInvestmentAsset: async (asset: InvestmentAsset): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    if (!asset.priceHistory || asset.priceHistory.length === 0) {
        asset.priceHistory = [{ date: today, price: asset.currentPrice }];
    }
    const { id, ...data } = asset;
    await addDoc(collection(db, COLLECTIONS.INVESTMENTS), data);
  },

  updateInvestmentAsset: async (asset: InvestmentAsset): Promise<void> => {
    const ref = doc(db, COLLECTIONS.INVESTMENTS, asset.id);
    await updateDoc(ref, { ...asset });
  },

  deleteInvestmentAsset: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.INVESTMENTS, id));
  },

  getInvestmentTransactions: async (userId: string): Promise<InvestmentTransaction[]> => {
    const q = query(collection(db, COLLECTIONS.INVESTMENT_TXS), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InvestmentTransaction));
  },

  registerInvestmentTransaction: async (tx: InvestmentTransaction, currentAsset: InvestmentAsset): Promise<void> => {
    // 1. Save Transaction
    const { id, ...data } = tx;
    await addDoc(collection(db, COLLECTIONS.INVESTMENT_TXS), data);

    if (tx.type === 'DIVIDEND') return;

    // 2. Update Asset (Simplified logic, same as local but on Firestore)
    // Note: In a real production app, this should be a Transaction (runTransaction)
    let newQuantity = currentAsset.quantity;
    let newAvgPrice = currentAsset.averagePrice;

    if (tx.type === 'BUY') {
      const totalCostOld = currentAsset.quantity * currentAsset.averagePrice;
      const totalCostNew = tx.quantity * tx.price;
      newQuantity = currentAsset.quantity + tx.quantity;
      if (newQuantity > 0) {
          newAvgPrice = (totalCostOld + totalCostNew) / newQuantity;
      }
    } else if (tx.type === 'SELL') {
      newQuantity = Math.max(0, currentAsset.quantity - tx.quantity);
    }

    const updatedAsset = {
      ...currentAsset,
      quantity: newQuantity,
      averagePrice: newAvgPrice,
      updatedAt: new Date().toISOString()
    };
    
    const assetRef = doc(db, COLLECTIONS.INVESTMENTS, currentAsset.id);
    await updateDoc(assetRef, updatedAsset);
  },

  updateInvestmentTransaction: async (updatedTx: InvestmentTransaction): Promise<void> => {
    const ref = doc(db, COLLECTIONS.INVESTMENT_TXS, updatedTx.id);
    await updateDoc(ref, { ...updatedTx });
  },

  deleteInvestmentTransaction: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTIONS.INVESTMENT_TXS, id));
  },

  // --- Summaries ---

  resetData: async (userId: string): Promise<void> => {
    // Implement batch delete for user if needed
    // For now, let's keep it simple as this is a dangerous operation in cloud
    const batch = writeBatch(db);
    
    const collections = Object.values(COLLECTIONS);
    for (const colName of collections) {
        const q = query(collection(db, colName), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
    await batch.commit();
  },
  
  // Reuse client-side calculation logic
  calculateSummary: (transactions: Transaction[]): FinancialSummary => {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap: Record<string, number> = {};
    const monthlyData: Record<string, { income: number; expense: number }> = {};
    const dailyData: Record<string, { income: number; expense: number }> = {};

    transactions.forEach(t => {
      const [year, month, day] = t.date.split('T')[0].split('-');
      const dateKey = `${year}-${month}-${day}`;
      const monthKey = new Date(Number(year), Number(month) - 1).toLocaleString('pt-BR', { month: 'short' });
      
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expense: 0 };
      if (!dailyData[dateKey]) dailyData[dateKey] = { income: 0, expense: 0 };

      if (t.type === TransactionType.INCOME) {
        totalIncome += t.amount;
        monthlyData[monthKey].income += t.amount;
        dailyData[dateKey].income += t.amount;
      } else {
        totalExpense += t.amount;
        monthlyData[monthKey].expense += t.amount;
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
        dailyData[dateKey].expense += t.amount;
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

    const dailyHistory = Object.keys(dailyData).sort().map(key => {
        const [year, month, day] = key.split('-');
        return {
            date: `${day}/${month}`,
            originalDate: key,
            income: dailyData[key].income,
            expense: dailyData[key].expense
        };
    });

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      expensesByCategory,
      monthlyCashflow,
      dailyHistory
    };
  },

  calculateInvestmentSummary: (assets: InvestmentAsset[], txs: InvestmentTransaction[]): InvestmentSummary => {
    let totalInvested = 0;
    let totalEquity = 0;
    const typeMap: Record<string, number> = {};
    const brokerMap: Record<string, number> = {};

    // 1. Current Snapshot Calculation
    assets.forEach(asset => {
      const invested = asset.quantity * asset.averagePrice;
      const equity = asset.quantity * asset.currentPrice;
      
      totalInvested += invested;
      totalEquity += equity;

      typeMap[asset.type] = (typeMap[asset.type] || 0) + equity;
      brokerMap[asset.broker] = (brokerMap[asset.broker] || 0) + equity;
    });

    // 2. Dividends Calculation
    let dividendsTotal = 0;
    const dividendsMap: Record<string, { amount: number, sortIndex: number }> = {};
    const recentDividends: { id: string; date: string; ticker: string; amount: number }[] = [];
    
    const sortedTxs = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedTxs.forEach(tx => {
        if (tx.type === 'DIVIDEND') {
            dividendsTotal += tx.price; 
            const d = new Date(tx.date);
            const utcMonth = d.getUTCMonth();
            const utcYear = d.getUTCFullYear();
            
            const displayDate = new Date(utcYear, utcMonth, 1);
            const monthLabel = displayDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            const sortIndex = utcYear * 100 + utcMonth;

            if (!dividendsMap[monthLabel]) {
                dividendsMap[monthLabel] = { amount: 0, sortIndex: sortIndex };
            }
            dividendsMap[monthLabel].amount += tx.price;

            const asset = assets.find(a => a.id === tx.assetId);
            const [y, m, da] = tx.date.split('T')[0].split('-');
            
            recentDividends.push({
                id: tx.id,
                date: `${da}/${m}/${y}`,
                ticker: asset ? asset.ticker : 'Desconhecido',
                amount: tx.price
            });
        }
    });

    const dividendsHistory = Object.keys(dividendsMap)
        .map(d => ({ date: d, amount: dividendsMap[d].amount, sortIndex: dividendsMap[d].sortIndex }))
        .sort((a, b) => a.sortIndex - b.sortIndex);


    // 3. Portfolio Evolution (Historical Replay)
    const portfolioHistory: { date: string; value: number }[] = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); // End of month
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const monthLabel = targetDate.toLocaleString('pt-BR', { month: 'short' });

        let monthlyEquity = 0;
        let monthlyDividendsAccumulated = 0;
        
        const assetQuantities: Record<string, number> = {};
        
        txs.forEach(tx => {
            const txDate = tx.date.split('T')[0];
            if (txDate <= targetDateStr) {
                if (tx.type === 'BUY') {
                    assetQuantities[tx.assetId] = (assetQuantities[tx.assetId] || 0) + tx.quantity;
                } else if (tx.type === 'SELL') {
                    assetQuantities[tx.assetId] = (assetQuantities[tx.assetId] || 0) - tx.quantity;
                } else if (tx.type === 'DIVIDEND') {
                    monthlyDividendsAccumulated += tx.price;
                }
            }
        });

        Object.keys(assetQuantities).forEach(assetId => {
            const qty = assetQuantities[assetId];
            if (qty > 0) {
                const asset = assets.find(a => a.id === assetId);
                if (asset) {
                    let historicalPrice = asset.averagePrice; // Fallback
                    // Check local priceHistory (safe check optional chain)
                    if (asset.priceHistory?.length > 0) {
                        const validPrices = asset.priceHistory
                            .filter(h => h.date <= targetDateStr)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        
                        if (validPrices.length > 0) {
                            historicalPrice = validPrices[0].price;
                        }
                    }
                    monthlyEquity += qty * historicalPrice;
                }
            }
        });

        portfolioHistory.push({
            date: monthLabel,
            value: monthlyEquity + monthlyDividendsAccumulated
        });
    }

    const totalProfit = totalEquity - totalInvested;
    const profitability = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalEquity,
      totalProfit,
      profitability,
      allocationByType: Object.keys(typeMap).map(k => ({ name: k, value: typeMap[k] })),
      allocationByBroker: Object.keys(brokerMap).map(k => ({ name: k, value: brokerMap[k] })),
      dividendsTotal,
      dividendsHistory,
      recentDividends: recentDividends.slice(0, 10),
      portfolioHistory,
      selic: 15.00,
      ipca: 4.65
    };
  }
};
