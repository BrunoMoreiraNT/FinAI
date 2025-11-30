import React, { useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Legend
} from 'recharts';
import { FinancialSummary, Budget, Goal, Transaction } from '../types';
import { Wallet, TrendingUp, TrendingDown, Target, AlertCircle, Edit2, Check, X, Plus, Trash2, Calendar, LayoutDashboard, List, RefreshCcw, ArrowRight } from 'lucide-react';

interface DashboardProps {
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<DashboardProps> = ({ 
  summary, budgets, goals, transactions, isLoading, 
  onUpdateBudget, onAddBudget, onDeleteBudget,
  onUpdateGoal, onAddGoal, onDeleteGoal,
  onUpdateTransaction, onDeleteTransaction,
  onResetData
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  
  // Temporary state for edits
  const [tempBudget, setTempBudget] = useState<Partial<Budget>>({});
  const [tempGoal, setTempGoal] = useState<Partial<Goal>>({});

  // Chart Click & Modal State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyTransactions, setDailyTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [tempTransaction, setTempTransaction] = useState<Partial<Transaction>>({});

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Carregando Dashboard...</div>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // --- Budget Logic ---
  const startEditBudget = (budget: Budget) => {
    setEditingBudget(budget.id);
    setTempBudget({ ...budget });
  };
  const saveBudget = () => {
    if (editingBudget && tempBudget.id) {
      onUpdateBudget(tempBudget as Budget);
      setEditingBudget(null);
    }
  };
  const cancelEditBudget = () => {
    setEditingBudget(null);
    setIsAddingBudget(false);
  };
  const startAddBudget = () => {
    setTempBudget({ category: '', limit: 0, period: 'MONTHLY' });
    setIsAddingBudget(true);
  };
  const saveNewBudget = () => {
    if (tempBudget.category && tempBudget.limit) {
      onAddBudget({ ...tempBudget, id: crypto.randomUUID() } as Budget);
      setIsAddingBudget(false);
    }
  };

  // --- Goal Logic ---
  const startEditGoal = (goal: Goal) => {
    setEditingGoal(goal.id);
    setTempGoal({ ...goal });
  };
  const saveGoal = () => {
    if (editingGoal && tempGoal.id) {
      onUpdateGoal(tempGoal as Goal);
      setEditingGoal(null);
    }
  };
  const cancelEditGoal = () => {
    setEditingGoal(null);
    setIsAddingGoal(false);
  };
  const startAddGoal = () => {
    setTempGoal({ name: '', targetAmount: 0, currentAmount: 0 });
    setIsAddingGoal(true);
  };
  const saveNewGoal = () => {
    if (tempGoal.name && tempGoal.targetAmount) {
      onAddGoal({ ...tempGoal, id: crypto.randomUUID(), currentAmount: 0 } as Goal);
      setIsAddingGoal(false);
    }
  };

  // --- Transaction Logic ---
  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const clickedData = data.activePayload[0].payload;
      const dateStr = clickedData.originalDate; // "YYYY-MM-DD"
      
      const txs = transactions.filter(t => t.date.startsWith(dateStr));
      setDailyTransactions(txs);
      setSelectedDate(clickedData.date); // "DD/MM"
      setIsModalOpen(true);
    }
  };

  const startEditTransaction = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setTempTransaction({...tx});
  };

  const saveTransaction = () => {
    if (editingTransactionId && tempTransaction.id) {
      onUpdateTransaction(tempTransaction as Transaction);
      setEditingTransactionId(null);
      // Update local list to reflect changes immediately in modal/list
      setDailyTransactions(prev => prev.map(t => t.id === tempTransaction.id ? (tempTransaction as Transaction) : t));
    }
  };
  
  const deleteTransaction = (id: string) => {
      onDeleteTransaction(id);
      setDailyTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Custom label for Pie Chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const RADIAN = Math.PI / 180;
    // Calculate radius to be exactly in the middle of the slice
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    // Only render if percent is significant to avoid clutter
    if (percent < 0.01) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="#000000" 
        textAnchor="middle" 
        dominantBaseline="central" 
        fontSize={10} 
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50 relative">
      
      {/* Transaction Modal (Daily View) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={20}/> 
                Transações de {selectedDate}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {dailyTransactions.length === 0 ? (
                <p className="text-center text-slate-400 py-4">Nenhuma transação encontrada.</p>
              ) : (
                dailyTransactions.map(tx => (
                   <div key={tx.id} className="border border-slate-100 p-3 rounded-lg hover:shadow-sm transition-shadow">
                    {/* Reusing edit logic for modal content */}
                    {editingTransactionId === tx.id ? (
                      <div className="space-y-2">
                         <input 
                           className="w-full border rounded px-2 py-1 text-sm"
                           value={tempTransaction.description}
                           onChange={e => setTempTransaction({...tempTransaction, description: e.target.value})}
                         />
                         <div className="flex gap-2">
                           <input 
                             type="number"
                             className="w-1/2 border rounded px-2 py-1 text-sm"
                             value={tempTransaction.amount}
                             onChange={e => setTempTransaction({...tempTransaction, amount: parseFloat(e.target.value)})}
                           />
                           <input 
                             className="w-1/2 border rounded px-2 py-1 text-sm"
                             value={tempTransaction.category}
                             onChange={e => setTempTransaction({...tempTransaction, category: e.target.value})}
                           />
                         </div>
                         <div className="flex justify-end gap-2 mt-2">
                            <button onClick={saveTransaction} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Salvar</button>
                            <button onClick={() => setEditingTransactionId(null)} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Cancelar</button>
                         </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-800">{tx.description}</p>
                          <p className="text-xs text-slate-500">{tx.category} • {new Date(tx.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${tx.type === 'EXPENSE' ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {tx.type === 'EXPENSE' ? '-' : '+'} {formatCurrency(tx.amount)}
                          </p>
                          <div className="flex justify-end gap-2 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditTransaction(tx)} className="text-indigo-500"><Edit2 size={14}/></button>
                            <button onClick={() => deleteTransaction(tx.id)} className="text-rose-500"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visão Geral</h1>
          <p className="text-slate-500 text-sm">Acompanhe seu patrimônio e hábitos de consumo.</p>
        </div>
        
        <div className="flex gap-2">
           <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
             <button 
               onClick={() => setActiveTab('overview')}
               className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <LayoutDashboard size={16}/> Resumo
             </button>
             <button 
               onClick={() => setActiveTab('transactions')}
               className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <List size={16}/> Transações
             </button>
           </div>
        </div>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Wallet size={24} /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Saldo</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.balance)}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp size={24} /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Receita</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalIncome)}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full"><TrendingDown size={24} /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Despesas</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalExpense)}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><Target size={24} /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Economia</p>
                <p className="text-xl font-bold text-slate-800">{summary.totalIncome > 0 ? ((summary.totalIncome - summary.totalExpense) / summary.totalIncome * 100).toFixed(0) : 0}%</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Expense Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Despesas por Categoria</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.expensesByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {summary.expensesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Spending Trend (Evolução de Gastos) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-semibold text-slate-800">Evolução de Gastos (Diário)</h3>
                 <button 
                    onClick={() => setActiveTab('transactions')}
                    className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                 >
                    Ver detalhes <ArrowRight size={12} className="ml-1"/>
                 </button>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.dailyExpenses} onClick={handleChartClick} style={{cursor: 'pointer'}}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val}`} />
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="amount" stroke="#ef4444" fillOpacity={1} fill="url(#colorAmount)" name="Gasto" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Budgets & Goals Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            
            {/* Budget Status */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Orçamentos Mensais</h3>
                <button onClick={startAddBudget} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={20} /></button>
              </div>
              
              <div className="space-y-4">
                {isAddingBudget && (
                  <div className="bg-indigo-50 p-3 rounded-lg mb-4 space-y-2 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700">Novo Orçamento</p>
                     <div className="flex gap-2">
                        <input 
                          className="border rounded px-2 py-1 w-1/2 text-sm"
                          placeholder="Categoria (ex: Lazer)"
                          value={tempBudget.category}
                          onChange={(e) => setTempBudget({...tempBudget, category: e.target.value})}
                        />
                        <input 
                          type="number"
                          className="border rounded px-2 py-1 w-1/2 text-sm"
                          placeholder="Limite Mensal"
                          value={tempBudget.limit || ''}
                          onChange={(e) => setTempBudget({...tempBudget, limit: Number(e.target.value)})}
                        />
                     </div>
                     <div className="flex justify-end gap-2">
                       <button onClick={saveNewBudget} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">Adicionar</button>
                       <button onClick={cancelEditBudget} className="bg-white text-slate-600 text-xs px-3 py-1 rounded border">Cancelar</button>
                     </div>
                  </div>
                )}

                {budgets.map((budget) => {
                  const spent = summary.expensesByCategory.find(c => c.name === budget.category)?.value || 0;
                  const percentage = Math.min((spent / budget.limit) * 100, 100);
                  const isOver = spent > budget.limit;
                  const isEditing = editingBudget === budget.id;
                  
                  return (
                    <div key={budget.id} className="group relative">
                      {isEditing ? (
                         <div className="flex items-center space-x-2 mb-2 bg-slate-50 p-2 rounded-lg">
                           <input 
                             className="border rounded px-2 py-1 w-1/3 text-sm"
                             value={tempBudget.category}
                             onChange={(e) => setTempBudget({...tempBudget, category: e.target.value})}
                             placeholder="Categoria"
                           />
                           <input 
                             type="number"
                             className="border rounded px-2 py-1 w-1/3 text-sm"
                             value={tempBudget.limit}
                             onChange={(e) => setTempBudget({...tempBudget, limit: Number(e.target.value)})}
                             placeholder="Limite"
                           />
                           <button onClick={saveBudget} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded"><Check size={16}/></button>
                           <button onClick={cancelEditBudget} className="text-slate-500 hover:bg-slate-50 p-1 rounded"><X size={16}/></button>
                         </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm mb-1 items-end">
                            <span className="font-medium text-slate-700 flex items-center">
                              {budget.category}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex">
                                <button onClick={() => startEditBudget(budget)} className="text-slate-400 hover:text-indigo-500 mr-1"><Edit2 size={12} /></button>
                                <button onClick={() => onDeleteBudget(budget.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                              </div>
                            </span>
                            <span className={`font-medium ${isOver ? 'text-red-500' : 'text-slate-500'}`}>
                              {formatCurrency(spent)} / {formatCurrency(budget.limit)} 
                              <span className="ml-1 text-xs opacity-80">({percentage.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 relative">
                            <div 
                              className={`h-2.5 rounded-full ${isOver ? 'bg-red-500' : 'bg-blue-600'}`} 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          {isOver && (
                            <p className="text-xs text-red-500 mt-1 flex items-center">
                              <AlertCircle size={12} className="mr-1" /> Estourou o orçamento
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {budgets.length === 0 && !isAddingBudget && <p className="text-slate-400 text-sm italic">Nenhum orçamento definido.</p>}
              </div>
            </div>

            {/* Goals Progress */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-semibold text-slate-800">Metas Financeiras</h3>
                 <button onClick={startAddGoal} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={20} /></button>
              </div>
              
              <div className="space-y-6">
                {isAddingGoal && (
                   <div className="bg-indigo-50 p-3 rounded-lg mb-4 space-y-2 border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-700">Nova Meta</p>
                      <input 
                        className="border rounded px-2 py-1 w-full text-sm"
                        placeholder="Nome da Meta"
                        value={tempGoal.name}
                        onChange={(e) => setTempGoal({...tempGoal, name: e.target.value})}
                      />
                      <input 
                        type="number"
                        className="border rounded px-2 py-1 w-full text-sm"
                        placeholder="Valor Alvo"
                        value={tempGoal.targetAmount || ''}
                        onChange={(e) => setTempGoal({...tempGoal, targetAmount: Number(e.target.value)})}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={saveNewGoal} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">Adicionar</button>
                        <button onClick={cancelEditGoal} className="bg-white text-slate-600 text-xs px-3 py-1 rounded border">Cancelar</button>
                      </div>
                   </div>
                )}

                {goals.map((goal) => {
                  const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                  const isEditing = editingGoal === goal.id;

                  return (
                    <div key={goal.id} className="flex items-center space-x-4 group">
                      {isEditing ? (
                        <div className="flex-1 flex items-center space-x-2 bg-slate-50 p-2 rounded-lg">
                          <div className="flex-1 space-y-2">
                            <input 
                               className="border rounded px-2 py-1 w-full text-sm"
                               value={tempGoal.name}
                               onChange={(e) => setTempGoal({...tempGoal, name: e.target.value})}
                               placeholder="Nome da Meta"
                             />
                             <input 
                               type="number"
                               className="border rounded px-2 py-1 w-full text-sm"
                               value={tempGoal.targetAmount}
                               onChange={(e) => setTempGoal({...tempGoal, targetAmount: Number(e.target.value)})}
                               placeholder="Alvo"
                             />
                          </div>
                           <div className="flex flex-col space-y-1">
                              <button onClick={saveGoal} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded"><Check size={16}/></button>
                              <button onClick={cancelEditGoal} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><X size={16}/></button>
                           </div>
                        </div>
                      ) : (
                        <>
                          <div className="relative w-14 h-14 flex-shrink-0">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                              <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3" />
                              <path className="text-indigo-600" strokeDasharray={`${percentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-800">{percentage.toFixed(0)}%</div>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                               <h4 className="text-sm font-medium text-slate-800">{goal.name}</h4>
                               <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                                 <button onClick={() => startEditGoal(goal)} className="text-slate-400 hover:text-indigo-500 mr-1"><Edit2 size={12}/></button>
                                 <button onClick={() => onDeleteGoal(goal.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={12}/></button>
                               </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)} 
                                <span className="ml-1 font-semibold text-slate-600">({percentage.toFixed(0)}%)</span>
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {goals.length === 0 && !isAddingGoal && <p className="text-slate-400 text-sm italic">Nenhuma meta definida.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB CONTENT: TRANSACTIONS LIST */}
      {activeTab === 'transactions' && (
         <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="p-6 border-b border-slate-100">
             <h3 className="text-lg font-semibold text-slate-800">Histórico Completo de Transações</h3>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                 <tr>
                   <th className="px-6 py-4">Data</th>
                   <th className="px-6 py-4">Descrição</th>
                   <th className="px-6 py-4">Categoria</th>
                   <th className="px-6 py-4 text-right">Valor</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                   <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                      {editingTransactionId === tx.id ? (
                        <>
                           <td className="px-6 py-4">{formatDate(tx.date)}</td>
                           <td className="px-6 py-4">
                             <input 
                               className="border rounded px-2 py-1 w-full"
                               value={tempTransaction.description}
                               onChange={e => setTempTransaction({...tempTransaction, description: e.target.value})}
                             />
                           </td>
                           <td className="px-6 py-4">
                              <input 
                               className="border rounded px-2 py-1 w-full"
                               value={tempTransaction.category}
                               onChange={e => setTempTransaction({...tempTransaction, category: e.target.value})}
                             />
                           </td>
                           <td className="px-6 py-4 text-right">
                              <input 
                               type="number"
                               className="border rounded px-2 py-1 w-full text-right"
                               value={tempTransaction.amount}
                               onChange={e => setTempTransaction({...tempTransaction, amount: parseFloat(e.target.value)})}
                             />
                           </td>
                           <td className="px-6 py-4 text-center flex justify-center gap-2">
                              <button onClick={saveTransaction} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded"><Check size={18}/></button>
                              <button onClick={() => setEditingTransactionId(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={18}/></button>
                           </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{tx.description}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">{tx.category}</span>
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${tx.type === 'EXPENSE' ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {tx.type === 'EXPENSE' ? '-' : '+'} {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditTransaction(tx)} className="text-indigo-500 hover:bg-indigo-50 p-1 rounded"><Edit2 size={16}/></button>
                              <button onClick={() => deleteTransaction(tx.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </>
                      )}
                   </tr>
                 ))}
                 {transactions.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">Nenhuma transação registrada.</td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
         </div>
      )}

    </div>
  );
};

export default Dashboard;