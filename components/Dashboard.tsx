
import React, { useState, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  AreaChart, Area, CartesianGrid, XAxis, YAxis, BarChart, Bar, Legend
} from 'recharts';
import { FinancialSummary, Budget, Goal, Transaction, InvestmentAsset, InvestmentSummary, InvestmentTransaction, InvestmentType, DashboardProps } from '../types';
import { Wallet, TrendingUp, TrendingDown, Target, Edit2, Check, X, Plus, Trash2, Calendar, LayoutDashboard, List, ArrowRight, LineChart as IconLineChart, DollarSign, Building, Percent, History, LogOut, User } from 'lucide-react';
import { DataService } from '../services/dataService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const Dashboard: React.FC<DashboardProps> = ({ 
  user, summary, budgets, goals, transactions, 
  investments, investmentSummary, investmentTransactions, isLoading,
  onUpdateBudget, onAddBudget, onDeleteBudget,
  onUpdateGoal, onAddGoal, onDeleteGoal,
  onUpdateTransaction, onDeleteTransaction,
  onResetData, onLogout,
  onAddAsset, onUpdateAsset, onDeleteAsset, onRegisterInvestmentTransaction,
  onUpdateInvestmentTransaction, onDeleteInvestmentTransaction
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'investments'>('overview');
  
  // Budget/Goal States
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [tempBudget, setTempBudget] = useState<Partial<Budget>>({});
  const [tempGoal, setTempGoal] = useState<Partial<Goal>>({});

  // Transaction States
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyTransactions, setDailyTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [tempTransaction, setTempTransaction] = useState<Partial<Transaction>>({});

  // Investment States
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [tempAsset, setTempAsset] = useState<Partial<InvestmentAsset>>({});
  const [snapshotDate, setSnapshotDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Update Price Modal State
  const [isUpdatingPrice, setIsUpdatingPrice] = useState<string | null>(null); // Asset ID
  const [updatePriceVal, setUpdatePriceVal] = useState<number>(0);
  const [updatePriceDate, setUpdatePriceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [selectedAssetForChart, setSelectedAssetForChart] = useState<string>(''); // For Individual Chart
  
  // Trade/History Modal
  const [tradeAsset, setTradeAsset] = useState<InvestmentAsset | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL' | 'DIVIDEND'>('BUY');
  const [tradeQuantity, setTradeQuantity] = useState<number>(0);
  const [tradePrice, setTradePrice] = useState<number>(0);
  const [tradeDate, setTradeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingInvTxId, setEditingInvTxId] = useState<string | null>(null);
  const [tempInvTx, setTempInvTx] = useState<Partial<InvestmentTransaction>>({});

  // --- Derived State for Snapshot Logic ---
  const snapshot = useMemo(() => {
    const targetDate = snapshotDate;
    let equity = 0;
    let invested = 0;
    let divTotal = 0;

    // 1. Determine Quantity Held at Target Date based on Transactions
    const assetQtys: Record<string, number> = {};
    
    investmentTransactions.forEach(tx => {
        const txDate = tx.date.split('T')[0];
        if (txDate <= targetDate) {
            if (tx.type === 'BUY') assetQtys[tx.assetId] = (assetQtys[tx.assetId] || 0) + tx.quantity;
            else if (tx.type === 'SELL') assetQtys[tx.assetId] = (assetQtys[tx.assetId] || 0) - tx.quantity;
            else if (tx.type === 'DIVIDEND') divTotal += tx.price;
        }
    });

    // 2. Value Assets using Price History at Target Date
    const todayStr = new Date().toISOString().split('T')[0];
    
    investments.forEach(asset => {
        const qty = assetQtys[asset.id] || 0;
        if (qty > 0) {
            // Find price closest to targetDate (but not after)
            let historicalPrice = asset.averagePrice; // Default Fallback
            
            // Fix: If looking at today or future, prefer currentPrice
            if (targetDate >= todayStr) {
                historicalPrice = asset.currentPrice;
            } else {
                // If looking at past, check history
                if (asset.priceHistory && asset.priceHistory.length > 0) {
                    const validHistory = asset.priceHistory
                        .filter(h => h.date <= targetDate)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    
                    if (validHistory.length > 0) {
                        historicalPrice = validHistory[0].price;
                    }
                }
            }
            
            equity += qty * historicalPrice;
            invested += qty * asset.averagePrice; // Cost basis approximation
        }
    });

    const profit = equity - invested;
    const profitability = invested > 0 ? (profit / invested) * 100 : 0;

    return { equity, invested, profit, profitability, dividends: divTotal };
  }, [snapshotDate, investments, investmentTransactions]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Carregando Dashboard...</div>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(val);

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    // Handle YYYY-MM-DD manually to prevent UTC shift
    const [year, month, day] = isoString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  };

  // --- Handlers ---
  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const clickedData = data.activePayload[0].payload;
      const dateStr = clickedData.originalDate;
      const txs = transactions.filter(t => t.date.startsWith(dateStr));
      setDailyTransactions(txs);
      setSelectedDate(clickedData.date);
      setIsModalOpen(true);
    }
  };

  // Budget
  const startEditBudget = (budget: Budget) => { setEditingBudget(budget.id); setTempBudget({ ...budget }); };
  const saveBudget = () => { if (editingBudget && tempBudget.id) { onUpdateBudget(tempBudget as Budget); setEditingBudget(null); } };
  const cancelEditBudget = () => { setEditingBudget(null); setIsAddingBudget(false); };
  const saveNewBudget = () => { if (tempBudget.category && tempBudget.limit) { onAddBudget({ ...tempBudget, id: DataService.generateUUID() } as Budget); setIsAddingBudget(false); } };
  
  // Goal
  const startEditGoal = (goal: Goal) => { setEditingGoal(goal.id); setTempGoal({ ...goal }); };
  const saveGoal = () => { if (editingGoal && tempGoal.id) { onUpdateGoal(tempGoal as Goal); setEditingGoal(null); } };
  const cancelEditGoal = () => { setEditingGoal(null); setIsAddingGoal(false); };
  const saveNewGoal = () => { if (tempGoal.name && tempGoal.targetAmount) { onAddGoal({ ...tempGoal, id: DataService.generateUUID(), currentAmount: 0 } as Goal); setIsAddingGoal(false); } };

  // Transaction Edit
  const startEditTransaction = (tx: Transaction) => { setEditingTransactionId(tx.id); setTempTransaction({...tx}); };
  const saveTransaction = () => { 
    if (editingTransactionId && tempTransaction.id) { 
        onUpdateTransaction(tempTransaction as Transaction); 
        setEditingTransactionId(null); 
        setDailyTransactions(prev => prev.map(t => t.id === tempTransaction.id ? (tempTransaction as Transaction) : t));
    } 
  };
  const deleteTransaction = (id: string) => { onDeleteTransaction(id); setDailyTransactions(prev => prev.filter(t => t.id !== id)); };

  // Investment Handlers
  const handleSaveNewAsset = () => {
    if (tempAsset.ticker && tempAsset.type && tempAsset.broker && tempAsset.quantity !== undefined && tempAsset.averagePrice !== undefined) {
      onAddAsset({
        id: DataService.generateUUID(),
        ticker: tempAsset.ticker.toUpperCase(),
        type: tempAsset.type,
        broker: tempAsset.broker,
        quantity: Number(tempAsset.quantity),
        averagePrice: Number(tempAsset.averagePrice),
        currentPrice: Number(tempAsset.averagePrice), // Start with same price
        updatedAt: new Date().toISOString()
      } as InvestmentAsset);
      setIsAddingAsset(false);
      setTempAsset({});
    }
  };

  const handleOpenUpdatePrice = (asset: InvestmentAsset) => {
    setIsUpdatingPrice(asset.id);
    setUpdatePriceVal(asset.currentPrice);
    setUpdatePriceDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmUpdatePrice = () => {
    if (isUpdatingPrice) {
        const asset = investments.find(a => a.id === isUpdatingPrice);
        if (asset) {
            // Append to history manually here to ensure the modal date is used
            const newHistory = asset.priceHistory ? [...asset.priceHistory] : [];
            // Remove any existing entry for this date to avoid dupes
            const filteredHistory = newHistory.filter(h => h.date !== updatePriceDate);
            filteredHistory.push({ date: updatePriceDate, price: updatePriceVal });
            
            // Sort history
            filteredHistory.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            onUpdateAsset({ 
                ...asset, 
                currentPrice: updatePriceVal,
                priceHistory: filteredHistory,
                updatedAt: new Date().toISOString()
            });
        }
        setIsUpdatingPrice(null);
    }
  };

  const handleExecuteTrade = () => {
    if (tradeAsset && tradePrice > 0 && user) {
      onRegisterInvestmentTransaction({
        id: DataService.generateUUID(),
        userId: user.uid,
        assetId: tradeAsset.id,
        type: tradeType,
        quantity: Number(tradeQuantity), // For dividend, this is 0
        price: Number(tradePrice),
        date: new Date(tradeDate).toISOString()
      });
      setTradeAsset(null);
      setTradeQuantity(0);
      setTradePrice(0);
      setTradeDate(new Date().toISOString().split('T')[0]);
    }
  };

  // Investment History Edit
  const startEditInvTx = (tx: InvestmentTransaction) => { setEditingInvTxId(tx.id); setTempInvTx({...tx, date: tx.date.split('T')[0]}); };
  const saveInvTx = () => {
      if(editingInvTxId && tempInvTx.id) {
          onUpdateInvestmentTransaction({...tempInvTx, date: new Date(tempInvTx.date!).toISOString()} as InvestmentTransaction);
          setEditingInvTxId(null);
      }
  };
  const deleteInvTx = (id: string) => { onDeleteInvestmentTransaction(id); };

  // Helper for Asset Evolution Chart
  const getSelectedAssetHistory = () => {
      if (!selectedAssetForChart) return [];
      const asset = investments.find(a => a.id === selectedAssetForChart);
      if (!asset || !asset.priceHistory || asset.priceHistory.length === 0) return [];
      
      return asset.priceHistory.map(h => ({
          date: formatDate(h.date), // Format for X-axis
          price: h.price
      }));
  };

  const getProjection = () => {
      if(!isUpdatingPrice) return null;
      const asset = investments.find(a => a.id === isUpdatingPrice);
      if(!asset) return null;
      const profit = (updatePriceVal - asset.averagePrice) * asset.quantity;
      const profitPerc = asset.averagePrice > 0 ? ((updatePriceVal - asset.averagePrice) / asset.averagePrice) * 100 : 0;
      return { profit, profitPerc };
  };

  return (
    <div className="p-3 md:p-6 space-y-6 overflow-y-auto h-full bg-slate-50 relative">
      
      {/* Transaction Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Calendar className="text-indigo-600" size={20}/> Transações de {selectedDate}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {dailyTransactions.length === 0 ? <p className="text-center text-slate-400 py-4">Nenhuma transação.</p> : dailyTransactions.map(tx => (
                 <div key={tx.id} className="border border-slate-100 p-3 rounded-lg">
                    {editingTransactionId === tx.id ? (
                      <div className="space-y-2">
                         <input className="w-full border rounded px-2 py-1 text-sm" value={tempTransaction.description} onChange={e => setTempTransaction({...tempTransaction, description: e.target.value})}/>
                         <div className="flex gap-2">
                           <input type="number" className="w-1/2 border rounded px-2 py-1 text-sm" value={tempTransaction.amount} onChange={e => setTempTransaction({...tempTransaction, amount: parseFloat(e.target.value)})}/>
                           <input className="w-1/2 border rounded px-2 py-1 text-sm" value={tempTransaction.category} onChange={e => setTempTransaction({...tempTransaction, category: e.target.value})}/>
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
                          <p className={`font-bold ${tx.type === 'EXPENSE' ? 'text-rose-500' : 'text-emerald-500'}`}>{tx.type === 'EXPENSE' ? '-' : '+'} {formatCurrency(tx.amount)}</p>
                          <div className="flex justify-end gap-2 mt-1 opacity-50 hover:opacity-100">
                            <button onClick={() => startEditTransaction(tx)} className="text-indigo-500"><Edit2 size={14}/></button>
                            <button onClick={() => deleteTransaction(tx.id)} className="text-rose-500"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      </div>
                    )}
                 </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {tradeAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-600"/> 
              Registrar: {tradeAsset.ticker}
            </h3>
            <div className="space-y-4">
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                <button onClick={() => setTradeType('BUY')} className={`flex-1 py-1 text-sm font-medium rounded-md ${tradeType === 'BUY' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Comprar</button>
                <button onClick={() => setTradeType('SELL')} className={`flex-1 py-1 text-sm font-medium rounded-md ${tradeType === 'SELL' ? 'bg-white shadow text-rose-600' : 'text-slate-500'}`}>Vender</button>
                <button onClick={() => setTradeType('DIVIDEND')} className={`flex-1 py-1 text-sm font-medium rounded-md ${tradeType === 'DIVIDEND' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Proventos</button>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 block mb-1">Data</label>
                <input type="date" className="w-full border-slate-200 border rounded-lg px-3 py-2 text-sm font-bold text-slate-900" value={tradeDate} onChange={e => setTradeDate(e.target.value)} />
              </div>

              {tradeType !== 'DIVIDEND' && (
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Quantidade</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2" value={tradeQuantity || ''} onChange={e => setTradeQuantity(Number(e.target.value))} />
                </div>
              )}
              
              <div>
                <label className="text-xs text-slate-500 block mb-1">{tradeType === 'DIVIDEND' ? 'Valor Total Recebido (R$)' : 'Preço Unitário (R$)'}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2" value={tradePrice || ''} onChange={e => setTradePrice(Number(e.target.value))} />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button onClick={handleExecuteTrade} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Confirmar</button>
                <button onClick={() => setTradeAsset(null)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Price Modal (New) */}
      {isUpdatingPrice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp size={20} className="text-blue-600"/> Atualizar Cotação
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">Data da Cotação</label>
                          <input type="date" className="w-full border-slate-200 border rounded-lg px-3 py-2 text-sm font-bold text-slate-900" value={updatePriceDate} onChange={e => setUpdatePriceDate(e.target.value)}/>
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">Novo Preço (R$)</label>
                          <input type="number" autoFocus className="w-full border rounded-lg px-3 py-2 font-bold text-lg" value={updatePriceVal || ''} onChange={e => setUpdatePriceVal(Number(e.target.value))}/>
                      </div>
                      
                      {/* Profit/Loss Projection */}
                      {getProjection() && (
                          <div className={`p-3 rounded-lg text-sm ${getProjection()!.profit >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                              <p className="font-semibold text-xs uppercase mb-1">Resultado Estimado</p>
                              <div className="flex justify-between items-end">
                                  <span className="font-bold text-lg">{formatCurrency(getProjection()!.profit)}</span>
                                  <span className="font-medium">{getProjection()!.profitPerc.toFixed(2)}%</span>
                              </div>
                          </div>
                      )}

                      <div className="pt-2 flex justify-end gap-2">
                          <button onClick={handleConfirmUpdatePrice} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
                          <button onClick={() => setIsUpdatingPrice(null)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">Cancelar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                  <div className="p-5 border-b flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800">Histórico de Transações de Investimento</h3>
                      <button onClick={() => setIsHistoryModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <div className="overflow-y-auto p-6 flex-1">
                      <table className="w-full text-left text-sm text-slate-600">
                          <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-800">
                              <tr>
                                  <th className="px-4 py-3">Data</th>
                                  <th className="px-4 py-3">Ativo</th>
                                  <th className="px-4 py-3">Tipo</th>
                                  <th className="px-4 py-3">Qtd</th>
                                  <th className="px-4 py-3 text-right">Preço/Valor</th>
                                  <th className="px-4 py-3 text-center">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {investmentTransactions.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-400">Nenhum registro.</td></tr>}
                              {investmentTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => {
                                  const asset = investments.find(a => a.id === tx.assetId);
                                  return (
                                      <tr key={tx.id} className="hover:bg-slate-50">
                                          {editingInvTxId === tx.id ? (
                                              <>
                                                  <td className="px-4 py-3"><input type="date" value={tempInvTx.date} onChange={e => setTempInvTx({...tempInvTx, date: e.target.value})} className="border rounded px-2 py-1 w-32 font-bold text-slate-900"/></td>
                                                  <td className="px-4 py-3 text-slate-500">{asset?.ticker || 'N/A'}</td>
                                                  <td className="px-4 py-3 text-slate-500">{tx.type}</td>
                                                  <td className="px-4 py-3"><input type="number" value={tempInvTx.quantity} onChange={e => setTempInvTx({...tempInvTx, quantity: Number(e.target.value)})} className="border rounded px-2 py-1 w-20"/></td>
                                                  <td className="px-4 py-3 text-right"><input type="number" value={tempInvTx.price} onChange={e => setTempInvTx({...tempInvTx, price: Number(e.target.value)})} className="border rounded px-2 py-1 w-24 text-right"/></td>
                                                  <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                      <button onClick={saveInvTx} className="text-emerald-500"><Check size={16}/></button>
                                                      <button onClick={() => setEditingInvTxId(null)} className="text-slate-400"><X size={16}/></button>
                                                  </td>
                                              </>
                                          ) : (
                                              <>
                                                  <td className="px-4 py-3">{formatDate(tx.date)}</td>
                                                  <td className="px-4 py-3 font-medium text-slate-800">{asset?.ticker || 'Removido'}</td>
                                                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${tx.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : tx.type === 'SELL' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>{tx.type === 'BUY' ? 'Compra' : tx.type === 'SELL' ? 'Venda' : 'Provento'}</span></td>
                                                  <td className="px-4 py-3">{tx.type !== 'DIVIDEND' ? tx.quantity : '-'}</td>
                                                  <td className="px-4 py-3 text-right">{formatCurrency(tx.price)}</td>
                                                  <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                      <button onClick={() => startEditInvTx(tx)} className="text-indigo-500"><Edit2 size={16}/></button>
                                                      <button onClick={() => deleteInvTx(tx.id)} className="text-rose-500"><Trash2 size={16}/></button>
                                                  </td>
                                              </>
                                          )}
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">
            {activeTab === 'investments' ? 'Investimentos' : 'Finanças'}
          </h1>
          <p className="text-slate-500 text-xs md:text-sm">
            {activeTab === 'investments' 
              ? 'Gerencie sua carteira.' 
              : 'Fluxo de caixa.'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
           {/* Tab Navigation */}
           <div className="flex flex-wrap justify-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto">
             <button onClick={() => setActiveTab('overview')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
               <LayoutDashboard size={16}/> Resumo
             </button>
             <button onClick={() => setActiveTab('transactions')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
               <List size={16}/> Transações
             </button>
             <button onClick={() => setActiveTab('investments')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'investments' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
               <IconLineChart size={16}/> Investimentos
             </button>
           </div>
           
           {/* User Profile / Logout */}
           <div className="flex w-full md:w-auto justify-between md:justify-start items-center gap-3 pl-2 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0">
              <div className="flex items-center gap-2">
                 <div className="p-1 bg-indigo-100 rounded-full md:hidden"><User size={16} className="text-indigo-600"/></div>
                 <div className="text-left md:text-right">
                    <p className="text-xs font-bold text-slate-700">{user?.email?.split('@')[0] || 'Usuário'}</p>
                    <p className="text-[10px] text-slate-400">Online</p>
                 </div>
              </div>
              <button 
                onClick={onLogout} 
                className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm font-medium"
                title="Sair"
              >
                <LogOut size={18} />
                <span className="md:inline">Sair</span>
              </button>
           </div>
        </div>
      </div>

      {/* --- OVERVIEW TAB --- */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Wallet size={24} /></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Saldo</p><p className="text-xl font-bold text-slate-800">{formatCurrency(summary.balance)}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp size={24} /></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Receita</p><p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalIncome)}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full"><TrendingDown size={24} /></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Despesas</p><p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalExpense)}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><Target size={24} /></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Economia</p><p className="text-xl font-bold text-slate-800">{summary.totalIncome > 0 ? ((summary.totalIncome - summary.totalExpense) / summary.totalIncome * 100).toFixed(0) : 0}%</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Despesas por Categoria</h3>
              <div className="flex flex-col sm:flex-row items-center h-auto sm:h-64">
                <div className="w-full sm:w-1/3 flex flex-col justify-center space-y-3 pr-0 sm:pr-2 overflow-y-auto max-h-40 sm:max-h-full scrollbar-hide mb-4 sm:mb-0">
                  {summary.expensesByCategory.map((entry, index) => (
                       <div key={`legend-${index}`} className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                             <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                             <span className="text-sm text-slate-600 truncate" title={entry.name}>{entry.name}</span>
                          </div>
                          <span className="text-sm font-bold text-slate-800 flex-shrink-0">{((entry.value / summary.totalExpense) * 100).toFixed(0)}%</span>
                       </div>
                  ))}
                  {summary.expensesByCategory.length === 0 && <p className="text-sm text-slate-400 italic">Sem dados</p>}
                </div>
                <div className="w-full sm:w-2/3 h-64 sm:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.expensesByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {summary.expensesByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-semibold text-slate-800">Evolução de Receita e Despesas</h3>
                 <button onClick={() => setActiveTab('transactions')} className="text-xs text-indigo-500 hover:bg-indigo-50 px-2 py-1 rounded flex items-center">Ver detalhes <ArrowRight size={12} className="ml-1"/></button>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.dailyHistory} onClick={handleChartClick} style={{cursor: 'pointer'}}>
                    <defs>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val}`} />
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Despesa" />
                    <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" name="Receita" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Orçamentos Mensais</h3>
                <button onClick={() => { setTempBudget({ category: '', limit: 0, period: 'MONTHLY' }); setIsAddingBudget(true); }} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={20} /></button>
              </div>
              <div className="space-y-4">
                {isAddingBudget && (
                  <div className="bg-indigo-50 p-3 rounded-lg mb-4 space-y-2 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700">Novo Orçamento</p>
                     <div className="flex flex-col sm:flex-row gap-2">
                        <input className="border rounded px-2 py-1 w-full sm:w-1/2 text-sm" placeholder="Categoria" value={tempBudget.category} onChange={(e) => setTempBudget({...tempBudget, category: e.target.value})}/>
                        <input type="number" className="border rounded px-2 py-1 w-full sm:w-1/2 text-sm" placeholder="Limite" value={tempBudget.limit || ''} onChange={(e) => setTempBudget({...tempBudget, limit: Number(e.target.value)})}/>
                     </div>
                     <div className="flex justify-end gap-2"><button onClick={saveNewBudget} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">Adicionar</button><button onClick={cancelEditBudget} className="bg-white text-slate-600 text-xs px-3 py-1 rounded border">Cancelar</button></div>
                  </div>
                )}
                {budgets.map((budget) => {
                  const spent = summary.expensesByCategory.find(c => c.name === budget.category)?.value || 0;
                  const percentage = Math.min((spent / budget.limit) * 100, 100);
                  const isOver = spent > budget.limit;
                  return (
                    <div key={budget.id} className="group relative">
                      {editingBudget === budget.id ? (
                         <div className="flex items-center space-x-2 mb-2 bg-slate-50 p-2 rounded-lg">
                           <input className="border rounded px-2 py-1 w-1/3 text-sm" value={tempBudget.category} onChange={(e) => setTempBudget({...tempBudget, category: e.target.value})}/>
                           <input type="number" className="border rounded px-2 py-1 w-1/3 text-sm" value={tempBudget.limit} onChange={(e) => setTempBudget({...tempBudget, limit: Number(e.target.value)})}/>
                           <button onClick={saveBudget} className="text-emerald-500"><Check size={16}/></button><button onClick={cancelEditBudget} className="text-slate-500"><X size={16}/></button>
                         </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm mb-1 items-end">
                            <span className="font-medium text-slate-700 flex items-center">{budget.category} <div className="ml-2 flex"><button onClick={() => startEditBudget(budget)} className="text-indigo-500 mr-1"><Edit2 size={12} /></button><button onClick={() => onDeleteBudget(budget.id)} className="text-rose-500"><Trash2 size={12}/></button></div></span>
                            <span className={`font-medium ${isOver ? 'text-red-500' : 'text-slate-500'}`}>{formatCurrency(spent)} / {formatCurrency(budget.limit)} <span className="ml-1 text-xs opacity-80">({percentage.toFixed(0)}%)</span></span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${isOver ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${percentage}%` }}></div></div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-semibold text-slate-800">Metas Financeiras</h3>
                 <button onClick={() => { setTempGoal({ name: '', targetAmount: 0 }); setIsAddingGoal(true); }} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Plus size={20} /></button>
              </div>
              <div className="space-y-6">
                {isAddingGoal && (
                   <div className="bg-indigo-50 p-3 rounded-lg mb-4 space-y-2 border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-700">Nova Meta</p>
                      <input className="border rounded px-2 py-1 w-full text-sm" placeholder="Nome" value={tempGoal.name} onChange={(e) => setTempGoal({...tempGoal, name: e.target.value})}/>
                      <input type="number" className="border rounded px-2 py-1 w-full text-sm" placeholder="Alvo" value={tempGoal.targetAmount || ''} onChange={(e) => setTempGoal({...tempGoal, targetAmount: Number(e.target.value)})}/>
                      <div className="flex justify-end gap-2"><button onClick={saveNewGoal} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">Adicionar</button><button onClick={cancelEditGoal} className="bg-white text-slate-600 text-xs px-3 py-1 rounded border">Cancelar</button></div>
                   </div>
                )}
                {goals.map((goal) => {
                  const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                  return (
                    <div key={goal.id} className="flex items-center space-x-4 group">
                      {editingGoal === goal.id ? (
                        <div className="flex-1 flex items-center space-x-2 bg-slate-50 p-2 rounded-lg">
                           <div className="flex-1 space-y-2">
                             <input className="border rounded px-2 py-1 w-full text-sm" value={tempGoal.name} onChange={(e) => setTempGoal({...tempGoal, name: e.target.value})}/>
                             <input type="number" className="border rounded px-2 py-1 w-full text-sm" value={tempGoal.targetAmount} onChange={(e) => setTempGoal({...tempGoal, targetAmount: Number(e.target.value)})}/>
                           </div>
                           <div className="flex flex-col space-y-1"><button onClick={saveGoal} className="text-emerald-500"><Check size={16}/></button><button onClick={cancelEditGoal} className="text-rose-500"><X size={16}/></button></div>
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
                            <div className="flex justify-between items-center"><h4 className="text-sm font-medium text-slate-800">{goal.name}</h4><div className="flex"><button onClick={() => startEditGoal(goal)} className="text-indigo-500 mr-1"><Edit2 size={12}/></button><button onClick={() => onDeleteGoal(goal.id)} className="text-rose-500"><Trash2 size={12}/></button></div></div>
                            <p className="text-xs text-slate-500">{formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)} <span className="ml-1 font-semibold text-slate-600">({percentage.toFixed(0)}%)</span></p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- TRANSACTIONS TAB --- */}
      {activeTab === 'transactions' && (
         <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="p-4 md:p-6 border-b border-slate-100"><h3 className="text-lg font-semibold text-slate-800">Histórico Completo</h3></div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-600 min-w-[600px]">
               <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs"><tr><th className="px-3 md:px-6 py-4">Data</th><th className="px-3 md:px-6 py-4">Descrição</th><th className="px-3 md:px-6 py-4">Categoria</th><th className="px-3 md:px-6 py-4 text-right">Valor</th><th className="px-3 md:px-6 py-4 text-center">Ações</th></tr></thead>
               <tbody className="divide-y divide-slate-100">
                 {transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                   <tr key={tx.id} className="hover:bg-slate-50 group">
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-3 md:px-6 py-4 font-medium">{tx.description}</td>
                      <td className="px-3 md:px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-medium">{tx.category}</span></td>
                      <td className={`px-3 md:px-6 py-4 text-right font-bold ${tx.type === 'EXPENSE' ? 'text-rose-500' : 'text-emerald-500'}`}>{tx.type === 'EXPENSE' ? '-' : '+'} {formatCurrency(tx.amount)}</td>
                      <td className="px-3 md:px-6 py-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => startEditTransaction(tx)} className="text-indigo-500"><Edit2 size={16}/></button><button onClick={() => deleteTransaction(tx.id)} className="text-rose-500"><Trash2 size={16}/></button></div></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}

      {/* --- INVESTMENTS TAB --- */}
      {activeTab === 'investments' && (
        <>
           {/* Date Selector Header */}
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4 flex items-center gap-3">
              <Calendar size={18} className="text-indigo-600"/>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Data de Referência:
              </span>
              <input 
                type="date" 
                className="bg-transparent border-none text-slate-900 text-sm font-semibold uppercase tracking-wide focus:ring-0 p-0 cursor-pointer"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
              />
           </div>

          {/* Investment KPI Cards (Using Snapshot Data) */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Building size={24} /></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Patrimônio Investido</p><p className="text-xl font-bold text-slate-800">{formatCurrency(snapshot.equity)}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className={`p-3 rounded-full ${snapshot.profit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><TrendingUp size={24} /></div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Rentabilidade</p>
                <p className={`text-xl font-bold ${snapshot.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {snapshot.profitability.toFixed(2)}% <span className="text-sm font-normal text-slate-500">({formatCurrency(snapshot.profit)})</span>
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
               <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><DollarSign size={24} /></div>
               <div><p className="text-xs text-slate-500 uppercase font-semibold">Total Proventos</p><p className="text-xl font-bold text-slate-800">{formatCurrency(snapshot.dividends)}</p></div>
            </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
               <div className="p-3 bg-orange-100 text-orange-600 rounded-full"><Percent size={24} /></div>
               <div>
                 <p className="text-xs text-slate-500 uppercase font-semibold">Indicadores</p>
                 <div className="flex gap-3 text-sm font-bold text-slate-800">
                   <span>Selic: {investmentSummary.selic}%</span>
                   <span>IPCA (12m): {investmentSummary.ipca}%</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Investment Charts (Modified Top Row) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
               <h3 className="text-lg font-semibold text-slate-800 mb-4">Proventos Mensais</h3>
               <div className="flex-1 min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={investmentSummary.dividendsHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
               
               {/* List of recent dividends */}
               <div className="mt-4 border-t border-slate-100 pt-3">
                 <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Últimos Proventos</h4>
                 <div className="max-h-24 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {investmentSummary.recentDividends && investmentSummary.recentDividends.length > 0 ? (
                        investmentSummary.recentDividends.map(div => (
                            <div key={div.id} className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 text-xs">{div.date}</span>
                                <span className="text-slate-800 font-medium flex-1 mx-2">{div.ticker}</span>
                                <span className="text-emerald-600 font-bold text-xs">+{formatCurrency(div.amount)}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic">Nenhum provento registrado recentemente.</p>
                    )}
                 </div>
               </div>
             </div>
             
             {/* Individual Asset Evolution Chart (Moved Up) */}
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                      <h3 className="text-lg font-semibold text-slate-800">Evolução do Ativo</h3>
                      <div className="relative w-full sm:w-auto">
                          <select 
                            className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 pr-8"
                            value={selectedAssetForChart}
                            onChange={e => setSelectedAssetForChart(e.target.value)}
                          >
                              <option value="">Selecione um ativo...</option>
                              {investments.map(a => <option key={a.id} value={a.id}>{a.ticker} ({a.broker})</option>)}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                          </div>
                      </div>
                  </div>
                  <div className="h-64">
                      {selectedAssetForChart && getSelectedAssetHistory().length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={getSelectedAssetHistory()}>
                                  <defs>
                                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                  <YAxis axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Area type="monotone" dataKey="price" stroke="#10b981" fillOpacity={1} fill="url(#colorPrice)" name="Preço" />
                              </AreaChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="flex items-center justify-center h-full text-slate-400 italic">
                              {selectedAssetForChart ? 'Sem histórico suficiente para este ativo.' : 'Selecione um ativo acima para ver sua evolução.'}
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Investment Charts (Bottom Row: Allocation) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
               <h3 className="text-lg font-semibold text-slate-800 mb-4">Alocação por Tipo</h3>
               <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={investmentSummary.allocationByType} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {investmentSummary.allocationByType.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
             </div>
             <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
               <h3 className="text-lg font-semibold text-slate-800 mb-4">Alocação por Corretora</h3>
               <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={investmentSummary.allocationByBroker} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 12}} />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}/>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
             </div>
          </div>

          {/* Assets Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
             <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
               <h3 className="text-lg font-semibold text-slate-800">Meus Ativos</h3>
               <div className="flex gap-2">
                   <button onClick={() => setIsHistoryModalOpen(true)} className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50"><History size={16}/> Histórico</button>
                   <button onClick={() => setIsAddingAsset(true)} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700"><Plus size={16}/> Novo Ativo</button>
               </div>
             </div>
             
             {isAddingAsset && (
               <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-700 mb-2">Adicionar Novo Ativo</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                     <input className="border rounded px-2 py-1 text-sm" placeholder="Ticker (Ex: PETR4)" value={tempAsset.ticker || ''} onChange={e => setTempAsset({...tempAsset, ticker: e.target.value})}/>
                     <select className="border rounded px-2 py-1 text-sm" value={tempAsset.type || ''} onChange={e => setTempAsset({...tempAsset, type: e.target.value as any})}>
                        <option value="">Tipo</option>
                        {Object.values(InvestmentType).map(t => <option key={t} value={t}>{t}</option>)}
                     </select>
                     <input className="border rounded px-2 py-1 text-sm" placeholder="Corretora" value={tempAsset.broker || ''} onChange={e => setTempAsset({...tempAsset, broker: e.target.value})}/>
                     <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Qtd" value={tempAsset.quantity || ''} onChange={e => setTempAsset({...tempAsset, quantity: Number(e.target.value)})}/>
                     <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Preço Médio" value={tempAsset.averagePrice || ''} onChange={e => setTempAsset({...tempAsset, averagePrice: Number(e.target.value)})}/>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                     <button onClick={handleSaveNewAsset} className="bg-emerald-600 text-white text-xs px-3 py-1 rounded">Salvar</button>
                     <button onClick={() => setIsAddingAsset(false)} className="bg-slate-200 text-slate-600 text-xs px-3 py-1 rounded">Cancelar</button>
                  </div>
               </div>
             )}

             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-slate-600 min-w-[800px]">
                 <thead className="bg-slate-50 text-slate-800 font-semibold uppercase text-xs">
                   <tr>
                     <th className="px-3 md:px-6 py-4">Ativo</th>
                     <th className="px-3 md:px-6 py-4">Tipo</th>
                     <th className="px-3 md:px-6 py-4 text-center">Qtd</th>
                     <th className="px-3 md:px-6 py-4 text-right">Preço Médio</th>
                     <th className="px-3 md:px-6 py-4 text-right">Cotação Atual</th>
                     <th className="px-3 md:px-6 py-4 text-right">Total</th>
                     <th className="px-3 md:px-6 py-4 text-right">Lucro/Prej</th>
                     <th className="px-3 md:px-6 py-4 text-center">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {investments.map(asset => {
                      const total = asset.quantity * asset.currentPrice;
                      const profit = (asset.currentPrice - asset.averagePrice) * asset.quantity;
                      const profitPerc = asset.averagePrice > 0 ? ((asset.currentPrice - asset.averagePrice) / asset.averagePrice) * 100 : 0;
                      
                      return (
                        <tr key={asset.id} className="hover:bg-slate-50">
                          <td className="px-3 md:px-6 py-4 font-bold text-slate-800">{asset.ticker} <span className="block text-[10px] text-slate-400 font-normal">{asset.broker}</span></td>
                          <td className="px-3 md:px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{asset.type}</span></td>
                          <td className="px-3 md:px-6 py-4 text-center">{asset.quantity}</td>
                          <td className="px-3 md:px-6 py-4 text-right">{formatCurrency(asset.averagePrice)}</td>
                          <td className="px-3 md:px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-2 font-medium">
                                {formatCurrency(asset.currentPrice)}
                                <button onClick={() => handleOpenUpdatePrice(asset)} className="text-blue-500 hover:bg-blue-50 p-1 rounded-full" title="Atualizar Cotação">
                                    {asset.currentPrice >= asset.averagePrice ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                                </button>
                             </div>
                          </td>
                          <td className="px-3 md:px-6 py-4 text-right font-medium text-slate-800">{formatCurrency(total)}</td>
                          <td className={`px-3 md:px-6 py-4 text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {formatCurrency(profit)} <span className="text-xs block">({profitPerc.toFixed(1)}%)</span>
                          </td>
                          <td className="px-3 md:px-6 py-4 text-center flex justify-center gap-2">
                             <button onClick={() => { setTradeAsset(asset); setTradeType('BUY'); }} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded text-xs border border-emerald-200" title="Comprar">C</button>
                             <button onClick={() => { setTradeAsset(asset); setTradeType('SELL'); }} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded text-xs border border-rose-200" title="Vender">V</button>
                             <button onClick={() => { setTradeAsset(asset); setTradeType('DIVIDEND'); }} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded text-xs border border-indigo-200" title="Proventos">$</button>
                             <button onClick={() => onDeleteAsset(asset.id)} className="text-slate-400 hover:text-rose-500 p-1.5"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      );
                    })}
                    {investments.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-slate-400">Nenhum ativo cadastrado.</td></tr>}
                 </tbody>
               </table>
             </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Dashboard;
