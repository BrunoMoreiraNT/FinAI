
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import AuthScreen from './components/AuthScreen';
import { DataService } from './services/dataService';
import { GeminiService } from './services/geminiService';
import { auth } from './services/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Transaction, Budget, Goal, FinancialSummary, ChatMessage, TransactionType, InvestmentAsset, InvestmentSummary, InvestmentTransaction, User } from './types';
import { Menu, X, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [investments, setInvestments] = useState<InvestmentAsset[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [investmentSummary, setInvestmentSummary] = useState<InvestmentSummary>({
      totalInvested: 0, 
      totalEquity: 0, 
      totalProfit: 0, 
      profitability: 0, 
      allocationByType: [], 
      allocationByBroker: [],
      dividendsTotal: 0,
      dividendsHistory: [],
      portfolioHistory: [],
      recentDividends: [],
      selic: 0,
      ipca: 0
  });

  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0, totalExpense: 0, balance: 0, expensesByCategory: [], monthlyCashflow: [], dailyHistory: []
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // MIGRATION STEP: If user logs in and has local data, upload it to Firebase
        await DataService.migrateLocalDataToFirebase(firebaseUser.uid);
        
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data only when user is logged in
  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // OPTIMIZATION: Fetch all collections in parallel ONCE
      const [txs, bgs, gls, invs, invTxs] = await Promise.all([
        DataService.getTransactions(user.uid),
        DataService.getBudgets(user.uid),
        DataService.getGoals(user.uid),
        DataService.getInvestments(user.uid),
        DataService.getInvestmentTransactions(user.uid)
      ]);
      
      // Set Raw Data
      setTransactions(txs);
      setBudgets(bgs);
      setGoals(gls);
      setInvestments(invs);
      setInvestmentTransactions(invTxs);
      
      // Calculate Summaries Locally (Instant)
      const summ = DataService.calculateSummary(txs);
      setSummary(summ);
      
      const invSumm = DataService.calculateInvestmentSummary(invs, invTxs);
      setInvestmentSummary(invSumm);

    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
        fetchData();
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: "Olá! Eu sou seu assistente FinAI. Me diga seus gastos ou receitas (ex: 'Gastei R$50 no mercado'), e eu registrarei para você.",
          timestamp: Date.now()
        }]);
    } else {
        // Clear data on logout
        setTransactions([]);
        setBudgets([]);
        setGoals([]);
        setInvestments([]);
        setInvestmentTransactions([]);
        setMessages([]);
    }
  }, [user, fetchData]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- Handlers for Dashboard actions (OPTIMISTIC UI) ---

  const handleResetData = async () => {
    if(!user) return;
    await DataService.resetData(user.uid);
    setMessages([{
      id: DataService.generateUUID(),
      role: 'assistant',
      content: "Todos os dados foram apagados. O sistema foi reiniciado.",
      timestamp: Date.now()
    }]);
    fetchData();
  };

  const handleUpdateBudget = async (budget: Budget) => {
    if(!user) return;
    setBudgets(prev => prev.map(b => b.id === budget.id ? budget : b));
    await DataService.updateBudget(budget);
  };

  const handleAddBudget = async (budget: Budget) => {
    if(!user) return;
    const newBudget = { ...budget, userId: user.uid };
    setBudgets(prev => [...prev, newBudget]);
    await DataService.addBudget(newBudget);
  };

  const handleDeleteBudget = async (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
    await DataService.deleteBudget(id);
  };

  const handleUpdateGoal = async (goal: Goal) => {
    setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
    await DataService.updateGoal(goal);
  };

  const handleAddGoal = async (goal: Goal) => {
    if(!user) return;
    const newGoal = { ...goal, userId: user.uid };
    setGoals(prev => [...prev, newGoal]);
    await DataService.addGoal(newGoal);
  };

  const handleDeleteGoal = async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    await DataService.deleteGoal(id);
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    const updatedTxs = transactions.map(t => t.id === transaction.id ? transaction : t);
    setTransactions(updatedTxs);
    setSummary(DataService.calculateSummary(updatedTxs));
    await DataService.updateTransaction(transaction);
  };

  const handleDeleteTransaction = async (id: string) => {
    const updatedTxs = transactions.filter(t => t.id !== id);
    setTransactions(updatedTxs);
    setSummary(DataService.calculateSummary(updatedTxs));
    await DataService.deleteTransaction(id);
  };

  // Investment Handlers (Optimistic)
  const handleAddAsset = async (asset: InvestmentAsset) => {
    if(!user) return;
    const newAsset = { ...asset, userId: user.uid };
    
    // Add Asset Local
    const updatedAssets = [...investments, newAsset];
    setInvestments(updatedAssets);

    // CRITICAL FIX: Create initial transaction if Quantity > 0 so History works
    let updatedInvTxs = investmentTransactions;
    if (newAsset.quantity > 0) {
        const initialTx: InvestmentTransaction = {
            id: DataService.generateUUID(),
            userId: user.uid,
            assetId: newAsset.id, // NOTE: In Firestore this ID might change if we relied on auto-id, but we are passing UUIDs in DataService so it's fine.
            type: 'BUY',
            quantity: newAsset.quantity,
            price: newAsset.averagePrice,
            date: new Date().toISOString()
        };
        updatedInvTxs = [...updatedInvTxs, initialTx];
        setInvestmentTransactions(updatedInvTxs);
        // Save initial tx in background
        DataService.registerInvestmentTransaction(initialTx, newAsset);
    } else {
        // Just save asset if no initial quantity
        DataService.addInvestmentAsset(newAsset);
    }
    
    setInvestmentSummary(DataService.calculateInvestmentSummary(updatedAssets, updatedInvTxs));
  };

  const handleUpdateAsset = async (asset: InvestmentAsset) => {
    const updatedAssets = investments.map(a => a.id === asset.id ? asset : a);
    setInvestments(updatedAssets);
    setInvestmentSummary(DataService.calculateInvestmentSummary(updatedAssets, investmentTransactions));
    await DataService.updateInvestmentAsset(asset);
  };

  const handleDeleteAsset = async (id: string) => {
    const updatedAssets = investments.filter(a => a.id !== id);
    const updatedInvTxs = investmentTransactions.filter(t => t.assetId !== id);
    setInvestments(updatedAssets);
    setInvestmentTransactions(updatedInvTxs);
    setInvestmentSummary(DataService.calculateInvestmentSummary(updatedAssets, updatedInvTxs));
    await DataService.deleteInvestmentAsset(id);
  };
  
  const handleRegisterInvestmentTransaction = async (tx: InvestmentTransaction) => {
    if(!user) return;
    const newTx = { ...tx, userId: user.uid };

    // 1. Add Tx to local state
    const updatedInvTxs = [...investmentTransactions, newTx];
    setInvestmentTransactions(updatedInvTxs);

    // 2. Update Asset locally (replicate DataService logic)
    const asset = investments.find(a => a.id === newTx.assetId);
    let updatedAssets = investments;

    if (asset && newTx.type !== 'DIVIDEND') {
       let newQuantity = asset.quantity;
       let newAvgPrice = asset.averagePrice;

       if (newTx.type === 'BUY') {
          const totalCostOld = asset.quantity * asset.averagePrice;
          const totalCostNew = newTx.quantity * newTx.price;
          newQuantity = asset.quantity + newTx.quantity;
          if(newQuantity > 0) newAvgPrice = (totalCostOld + totalCostNew) / newQuantity;
       } else if (newTx.type === 'SELL') {
          newQuantity = Math.max(0, asset.quantity - newTx.quantity);
       }

       const updatedAsset = { ...asset, quantity: newQuantity, averagePrice: newAvgPrice, updatedAt: new Date().toISOString() };
       updatedAssets = investments.map(a => a.id === asset.id ? updatedAsset : a);
       setInvestments(updatedAssets);
    }

    // 3. Recalc Summary
    setInvestmentSummary(DataService.calculateInvestmentSummary(updatedAssets, updatedInvTxs));

    // 4. Send to backend
    if (asset) await DataService.registerInvestmentTransaction(newTx, asset);
  };

  const handleUpdateInvestmentTransaction = async (tx: InvestmentTransaction) => {
      // Optimistic Update List
      const updatedInvTxs = investmentTransactions.map(t => t.id === tx.id ? tx : t);
      setInvestmentTransactions(updatedInvTxs);
      
      setInvestmentSummary(DataService.calculateInvestmentSummary(investments, updatedInvTxs));
      
      await DataService.updateInvestmentTransaction(tx);
  };

  const handleDeleteInvestmentTransaction = async (id: string) => {
      const updatedInvTxs = investmentTransactions.filter(t => t.id !== id);
      setInvestmentTransactions(updatedInvTxs);
      setInvestmentSummary(DataService.calculateInvestmentSummary(investments, updatedInvTxs));
      await DataService.deleteInvestmentTransaction(id);
  };

  // --- Chat Logic ---

  const handleSendMessage = async (text: string) => {
    if(!user) return;
    const userMsg: ChatMessage = {
      id: DataService.generateUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const parsedTransaction = await GeminiService.parseTransaction(text);

      // Check if it's a DELETE request
      if (parsedTransaction && parsedTransaction.type === TransactionType.DELETE) {
         const lastTx = transactions[transactions.length - 1];
         
         if (lastTx) {
             await handleDeleteTransaction(lastTx.id);
             
             const aiMsg: ChatMessage = {
                id: DataService.generateUUID(),
                role: 'assistant',
                content: `Entendido. Apaguei a última transação: ${lastTx.description} (${lastTx.type === 'EXPENSE' ? 'R$' + lastTx.amount : 'Receita'}).`,
                timestamp: Date.now()
             };
             setMessages(prev => [...prev, aiMsg]);
         } else {
             const aiMsg: ChatMessage = {
                id: DataService.generateUUID(),
                role: 'assistant',
                content: "Não encontrei nenhuma transação recente para apagar.",
                timestamp: Date.now()
             };
             setMessages(prev => [...prev, aiMsg]);
         }
      } 
      // Normal Add Transaction Logic
      else if (parsedTransaction && parsedTransaction.amount && parsedTransaction.category && parsedTransaction.type) {
        const newTransaction = { ...parsedTransaction, userId: user.uid } as Transaction;
        
        // 1. Send to Backend
        DataService.addTransaction(newTransaction);
        
        // 2. OPTIMISTIC UPDATE
        const updatedTransactions = [...transactions, newTransaction];
        setTransactions(updatedTransactions);
        
        // Recalculate summary locally
        const newSummary = DataService.calculateSummary(updatedTransactions);
        setSummary(newSummary);

        // 3. Generate Advice based on local data
        const budget = budgets.find(b => b.category.toLowerCase() === newTransaction.category.toLowerCase());
        let budgetStatus = "Nenhum orçamento específico para esta categoria.";
        
        if (budget && newTransaction.type === TransactionType.EXPENSE) {
          const categorySpend = newSummary.expensesByCategory.find(c => c.name === newTransaction.category)?.value || 0;
          const percentage = Math.round((categorySpend / budget.limit) * 100);
          const remaining = budget.limit - categorySpend;
          
          if (remaining < 0) {
            budgetStatus = `ALERTA: Você estourou o orçamento em R$${Math.abs(remaining)}. Total gasto: R$${categorySpend} (${percentage}% do limite).`;
          } else {
            budgetStatus = `Status do Orçamento: Você gastou R$${categorySpend} de R$${budget.limit} (${percentage}%). Restam: R$${remaining}.`;
          }
        } else if (newTransaction.type === TransactionType.INCOME) {
           budgetStatus = "Receita registrada. Saldo atualizado.";
        }

        const advice = await GeminiService.generateFinancialAdvice(newTransaction, budgetStatus);

        const aiMsg: ChatMessage = {
          id: DataService.generateUUID(),
          role: 'assistant',
          content: advice,
          timestamp: Date.now(),
          relatedTransactionId: newTransaction.id
        };
        setMessages(prev => [...prev, aiMsg]);

      } else {
        const aiMsg: ChatMessage = {
          id: DataService.generateUUID(),
          role: 'assistant',
          content: "Não consegui identificar uma transação na sua mensagem. Por favor, especifique o valor, categoria e a descrição. Exemplo: 'Gastei R$25 em Uber'.",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
      }

    } catch (error) {
      console.error("Chat Error", error);
      const errorMsg: ChatMessage = {
        id: DataService.generateUUID(),
        role: 'assistant',
        content: "Desculpe, encontrei um erro ao processar seu pedido. Tente novamente.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p className="text-slate-500 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative font-sans">
      
      {/* Mobile Toggle Button */}
      <div className="lg:hidden absolute top-4 right-4 z-50">
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          aria-label="Toggle Chat"
        >
          {isChatOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Left: Dashboard Area */}
      <div className="flex-1 h-full overflow-hidden flex flex-col w-full">
        <Dashboard 
          user={user}
          summary={summary}
          budgets={budgets}
          goals={goals}
          transactions={transactions}
          investments={investments}
          investmentSummary={investmentSummary}
          investmentTransactions={investmentTransactions}
          isLoading={isLoading}
          onUpdateBudget={handleUpdateBudget}
          onAddBudget={handleAddBudget}
          onDeleteBudget={handleDeleteBudget}
          onUpdateGoal={handleUpdateGoal}
          onAddGoal={handleAddGoal}
          onDeleteGoal={handleDeleteGoal}
          onUpdateTransaction={handleUpdateTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onResetData={handleResetData}
          onLogout={handleLogout}
          onAddAsset={handleAddAsset}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
          onRegisterInvestmentTransaction={handleRegisterInvestmentTransaction}
          onUpdateInvestmentTransaction={handleUpdateInvestmentTransaction}
          onDeleteInvestmentTransaction={handleDeleteInvestmentTransaction}
        />
      </div>

      {/* Right: Chat Interface (Sidebar/Drawer) */}
      <div className={`
        fixed inset-y-0 right-0 z-40 w-full md:w-[400px] 
        transform transition-transform duration-300 ease-in-out shadow-2xl
        lg:relative lg:translate-x-0 lg:shadow-none lg:border-l lg:border-slate-200
        ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <ChatInterface 
          messages={messages}
          onSendMessage={handleSendMessage}
          isProcessing={isProcessing}
        />
      </div>

      {/* Mobile Overlay */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsChatOpen(false)}
        />
      )}

    </div>
  );
};

export default App;
