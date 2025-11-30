import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { DataService } from './services/dataService';
import { GeminiService } from './services/geminiService';
import { Transaction, Budget, Goal, FinancialSummary, ChatMessage, TransactionType } from './types';
import { Menu, X } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    expensesByCategory: [],
    monthlyCashflow: [],
    dailyExpenses: []
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false); // Mobile chat toggle
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initial Data Fetch
  const fetchData = useCallback(async () => {
    try {
      // Fetch all data in parallel
      const [txs, bgs, gls, summ] = await Promise.all([
        DataService.getTransactions(),
        DataService.getBudgets(),
        DataService.getGoals(),
        DataService.calculateSummary()
      ]);
      
      setTransactions(txs);
      setBudgets(bgs);
      setGoals(gls);
      setSummary(summ);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Add initial welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Olá! Eu sou seu assistente FinAI. Me diga seus gastos ou receitas (ex: 'Gastei R$50 no mercado'), e eu registrarei para você.",
      timestamp: Date.now()
    }]);
  }, [fetchData]);

  // --- Handlers for Dashboard actions ---

  const handleResetData = async () => {
    await DataService.resetData();
    setMessages([{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "Todos os dados foram apagados. O sistema foi reiniciado.",
      timestamp: Date.now()
    }]);
    fetchData();
  };

  const handleUpdateBudget = async (budget: Budget) => {
    await DataService.updateBudget(budget);
    fetchData(); 
  };
  const handleAddBudget = async (budget: Budget) => {
    await DataService.addBudget(budget);
    fetchData();
  };
  const handleDeleteBudget = async (id: string) => {
    await DataService.deleteBudget(id);
    fetchData();
  };

  const handleUpdateGoal = async (goal: Goal) => {
    await DataService.updateGoal(goal);
    fetchData();
  };
  const handleAddGoal = async (goal: Goal) => {
    await DataService.addGoal(goal);
    fetchData();
  };
  const handleDeleteGoal = async (id: string) => {
    await DataService.deleteGoal(id);
    fetchData();
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
      await DataService.updateTransaction(transaction);
      fetchData();
  };
  const handleDeleteTransaction = async (id: string) => {
      await DataService.deleteTransaction(id);
      fetchData();
  };

  // --- Chat Logic ---

  const handleSendMessage = async (text: string) => {
    // Add user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 1. Try to parse transaction using Gemini
      const parsedTransaction = await GeminiService.parseTransaction(text);

      if (parsedTransaction && parsedTransaction.amount && parsedTransaction.category && parsedTransaction.type) {
        // We have a valid transaction
        const newTransaction = parsedTransaction as Transaction;
        
        // 2. Save to Data Service
        await DataService.addTransaction(newTransaction);
        
        // 3. Refresh Dashboard Data
        await fetchData();

        // 4. Calculate Context for AI Advice
        // We need fresh summary data to give accurate budget advice
        const updatedSummary = await DataService.calculateSummary();
        
        const budget = budgets.find(b => b.category.toLowerCase() === newTransaction.category.toLowerCase());
        let budgetStatus = "Nenhum orçamento específico para esta categoria.";
        
        if (budget && newTransaction.type === TransactionType.EXPENSE) {
          const categorySpend = updatedSummary.expensesByCategory.find(c => c.name === newTransaction.category)?.value || 0;
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

        // 5. Generate AI Advice
        const advice = await GeminiService.generateFinancialAdvice(newTransaction, budgetStatus);

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: advice,
          timestamp: Date.now(),
          relatedTransactionId: newTransaction.id
        };
        setMessages(prev => [...prev, aiMsg]);

      } else {
        // Fallback: Gemini couldn't parse it as a transaction
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Não consegui identificar uma transação na sua mensagem. Por favor, especifique o valor, categoria e a descrição. Exemplo: 'Gastei R$25 em Uber'.",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
      }

    } catch (error) {
      console.error("Chat Error", error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Desculpe, encontrei um erro ao processar seu pedido. Tente novamente.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

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
          summary={summary}
          budgets={budgets}
          goals={goals}
          transactions={transactions}
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