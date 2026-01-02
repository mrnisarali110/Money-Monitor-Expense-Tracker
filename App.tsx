
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Sparkles,
  X,
  Wallet,
  Settings as SettingsIcon,
  LayoutDashboard,
  CalendarDays,
  PieChart as PieIcon,
  PlusCircle,
  Clock,
  Moon,
  Sun,
  Eye,
  EyeOff,
  User,
  Trash2,
  Calendar,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { 
  Transaction, 
  Category, 
  TransactionType,
  Currency,
  Budget,
  UserSettings
} from './types';
import { 
  INITIAL_INCOME_CATEGORIES, 
  INITIAL_EXPENSE_CATEGORIES, 
  MONTHS, 
  CURRENCIES,
  COMMON_EMOJIS
} from './constants';
import { PremiumChart } from './components/PremiumChart';
import { getFinancialInsights } from './services/geminiService';

// Conflicting global interface declaration removed. 
// Using type assertion (window as any).aistudio to handle environment-provided tools.

type TabType = 'home' | 'journal' | 'stats';
type TimePeriod = 'day' | 'week' | 'month' | 'year';
type MigrationStatus = 'idle' | 'success' | 'error';

const App: React.FC = () => {
  // --- Persistent State ---
  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('onboarded') === 'true');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [journalPeriod, setJournalPeriod] = useState<TimePeriod>('month');
  const [statsPeriod, setStatsPeriod] = useState<TimePeriod>('month');

  // AI Connection State
  const [isAiAuthorized, setIsAiAuthorized] = useState(!!process.env.API_KEY);

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : {
      userName: 'Guest',
      theme: 'light',
      monthStartDay: 1,
      enableRollover: true,
      stealthMode: false
    };
  });

  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('currency');
    return saved ? JSON.parse(saved) : CURRENCIES[0];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('budgets');
    return saved ? JSON.parse(saved) : [];
  });

  const [incomeCategories, setIncomeCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('incomeCategories');
    return saved ? JSON.parse(saved) : INITIAL_INCOME_CATEGORIES;
  });

  const [expenseCategories, setExpenseCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('expenseCategories');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSE_CATEGORIES;
  });

  // --- UI & Utility State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [activeBudgetCategory, setActiveBudgetCategory] = useState<string | null>(null);
  
  const [insights, setInsights] = useState<string>('Analyzing your wealth...');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [hideBalances, setHideBalances] = useState(settings.stealthMode);

  // Form State
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newCategory, setNewCategory] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(COMMON_EMOJIS[0]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  // Migration State
  const [migrationText, setMigrationText] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('budgets', JSON.stringify(budgets));
    localStorage.setItem('currency', JSON.stringify(currency));
    localStorage.setItem('onboarded', isOnboarded.toString());
    localStorage.setItem('userSettings', JSON.stringify(settings));
    localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories));
    localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
    
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [transactions, budgets, currency, isOnboarded, settings, incomeCategories, expenseCategories]);

  // AI Connection Check using any cast to bypass Window type declaration conflicts
  useEffect(() => {
    const checkAi = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (hasKey) setIsAiAuthorized(true);
      }
    };
    checkAi();
  }, []);

  const handleAuthorizeAi = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setIsAiAuthorized(true); // Proceed immediately per race condition guidelines
    } else {
      alert("AI selection is only available in supported environments. Please use a .env file locally.");
    }
  };

  const getPeriodRange = (date: Date, startDay: number) => {
    const start = new Date(date.getFullYear(), date.getMonth(), startDay);
    if (date.getDate() < startDay) {
      start.setMonth(start.getMonth() - 1);
    }
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return { start, end };
  };

  const currentPeriod = useMemo(() => getPeriodRange(currentDate, settings.monthStartDay), [currentDate, settings.monthStartDay]);

  const getFilteredTransactions = (periodType: TimePeriod) => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);
      if (periodType === 'day') return d.toDateString() === now.toDateString();
      if (periodType === 'week') return (now.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      if (periodType === 'month') return d >= currentPeriod.start && d <= currentPeriod.end;
      if (periodType === 'year') return d.getFullYear() === currentDate.getFullYear();
      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  };

  const journalTransactions = useMemo(() => getFilteredTransactions(journalPeriod), [transactions, journalPeriod, currentPeriod]);
  const statsTransactions = useMemo(() => getFilteredTransactions(statsPeriod), [transactions, statsPeriod, currentPeriod]);
  
  const recentTransactions = useMemo(() => {
    return transactions.filter(t => Date.now() - t.timestamp < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions]);

  const periodStats = useMemo(() => {
    const filtered = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= currentPeriod.start && d <= currentPeriod.end;
    });
    return filtered.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions, currentPeriod]);

  const totalHistoricalBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);
  }, [transactions]);

  const statsBreakdown = useMemo(() => {
    return statsTransactions.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [statsTransactions]);

  // --- Smart Migration Logic ---
  const handleMigrateData = () => {
    if (!migrationText.trim()) return;
    setIsMigrating(true);
    setMigrationStatus('idle');
    setMigrationMessage(null);
    
    setTimeout(() => {
      try {
        const lines = migrationText.trim().split('\n');
        const importedTransactions: Transaction[] = [];

        lines.forEach((line) => {
          let parts = line.split('\t');
          if (parts.length < 3) parts = line.split(/\s{2,}/);
          parts = parts.map(p => p.trim()).filter(p => p.length > 0);
          
          if (parts.length < 3) return;

          let dateStr, category, note, typeDesc, amountStr;
          if (parts.length >= 7) {
            dateStr = parts[0]; category = parts[2]; note = parts[4]; typeDesc = parts[6]; amountStr = parts[7];
          } else {
            dateStr = parts[0]; category = parts[1]; note = parts[2]; amountStr = parts[3]; typeDesc = parts[4] || '';
          }

          const cleanAmountStr = amountStr?.replace(/[^\d.]/g, '') || '0';
          const amount = parseFloat(cleanAmountStr);

          if (dateStr && !isNaN(amount)) {
            const type: TransactionType = typeDesc?.toLowerCase().includes('income') || typeDesc?.toLowerCase().includes('salary') ? 'income' : 'expense';
            const dateParts = dateStr.split(/[/\s,.-]+/);
            let isoDate = new Date().toISOString().split('T')[0];
            
            if (dateParts.length >= 3) {
              let d, m, y;
              if (dateParts[0].length === 4) {
                y = parseInt(dateParts[0]); m = parseInt(dateParts[1]) - 1; d = parseInt(dateParts[2]);
              } else {
                d = parseInt(dateParts[0]); m = parseInt(dateParts[1]) - 1; y = parseInt(dateParts[2]);
              }
              if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                const parsedDate = new Date(y, m, d);
                if (!isNaN(parsedDate.getTime())) isoDate = parsedDate.toISOString().split('T')[0];
              }
            }

            importedTransactions.push({
              id: Math.random().toString(36).substr(2, 9),
              type,
              category: category || 'Miscellaneous',
              amount,
              date: isoDate,
              note: note || '',
              timestamp: new Date(isoDate).getTime() + (importedTransactions.length * 5)
            });
          }
        });

        if (importedTransactions.length > 0) {
          setTransactions(prev => [...importedTransactions, ...prev]);
          setMigrationText('');
          setMigrationStatus('success');
          setMigrationMessage(`Imported ${importedTransactions.length} items!`);
          setTimeout(() => setMigrationStatus('idle'), 4000);
        } else {
          setMigrationStatus('error');
          setMigrationMessage("No data detected. Retry with full rows.");
        }
      } catch (err) {
        setMigrationStatus('error');
        setMigrationMessage("Migration error. Please retry.");
      } finally {
        setIsMigrating(false);
      }
    }, 800);
  };

  // --- Handlers ---
  const handleSaveTransaction = () => {
    if (!newAmount || !newCategory) return;
    
    if (editingTransactionId) {
      setTransactions(prev => prev.map(t => t.id === editingTransactionId ? {
        ...t,
        type: newType,
        category: newCategory,
        amount: parseFloat(newAmount),
        note: newNote,
      } : t));
    } else {
      const transaction: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: newType,
        category: newCategory,
        amount: parseFloat(newAmount),
        date: new Date().toISOString().split('T')[0],
        note: newNote,
        timestamp: Date.now()
      };
      setTransactions(prev => [transaction, ...prev]);
    }
    
    setShowAddModal(false);
    resetForm();
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransactionId(t.id);
    setNewAmount(t.amount.toString());
    setNewType(t.type);
    setNewCategory(t.category);
    setNewNote(t.note || '');
    setShowAddModal(true);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm("Delete this transaction?")) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      if (editingTransactionId === id) {
        setShowAddModal(false);
        resetForm();
      }
    }
  };

  const handleSetBudget = (categoryName: string, limit: number) => {
    setBudgets(prev => {
      const filtered = prev.filter(b => b.categoryName !== categoryName);
      if (limit <= 0) return filtered;
      return [...filtered, { categoryName, limit }];
    });
  };

  const resetForm = () => {
    setNewAmount('');
    setNewCategory('');
    setNewNote('');
    setShowCustomCategoryInput(false);
    setCustomCategoryName('');
    setSelectedEmoji(COMMON_EMOJIS[0]);
    setEditingTransactionId(null);
  };

  const formatPrice = (val: number) => {
    if (hideBalances) return '••••••';
    return `${currency.symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (!isOnboarded || transactions.length === 0 || !isAiAuthorized) return;
    const fetchInsights = async () => {
      setLoadingInsights(true);
      const res = await getFinancialInsights(journalTransactions, MONTHS[currentDate.getMonth()]);
      setInsights(res);
      setLoadingInsights(false);
    };
    const timer = setTimeout(fetchInsights, 2000);
    return () => clearTimeout(timer);
  }, [journalTransactions, currentDate, isOnboarded, isAiAuthorized]);

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center transition-colors">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-8 animate-pulse">
          <Wallet className="text-white" size={48} />
        </div>
        <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-4 tracking-tighter">LUXE LEDGER</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-12 max-w-xs leading-relaxed text-sm font-medium">
          Premium wealth tracking. Select your primary currency to begin.
        </p>
        <div className="w-full max-w-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {CURRENCIES.map(curr => (
              <button key={curr.code} onClick={() => setCurrency(curr)} className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center ${currency.code === curr.code ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'border-white dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 shadow-sm'}`}>
                <span className="text-2xl font-black">{curr.symbol}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{curr.name}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setIsOnboarded(true)} className="w-full mt-8 bg-slate-900 dark:bg-indigo-600 text-white py-5 rounded-full font-black text-lg shadow-2xl active:scale-95">CONTINUE</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 flex flex-col max-w-lg mx-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative overflow-x-hidden ${settings.theme}`}>
      
      {/* Header */}
      <header className="sticky top-0 z-20 glass dark:bg-slate-900/80 px-6 py-4 flex items-center justify-between premium-shadow">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Wallet size={16} className="text-white" /></div>
           <h1 className="text-lg font-black tracking-tighter">LUXE</h1>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))} className="p-1"><ChevronLeft size={16} /></button>
            <span className="text-[9px] font-black w-24 text-center uppercase tracking-widest truncate">{MONTHS[currentDate.getMonth()]} '{currentDate.getFullYear().toString().slice(-2)}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))} className="p-1"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1"><SettingsIcon size={22}/></button>
        </div>
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        
        {/* Tab: Home */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-8 text-white premium-shadow relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all"></div>
              <div className="flex justify-between items-start mb-2">
                <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  {settings.enableRollover ? 'Net Financial Position' : 'Monthly Cashflow'}
                </p>
                <button onClick={() => setHideBalances(!hideBalances)} className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                  {hideBalances ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <h2 className="text-5xl font-black tracking-tighter transition-all">
                {formatPrice(settings.enableRollover ? totalHistoricalBalance : (periodStats.income - periodStats.expense))}
              </h2>
              <div className="flex mt-8 space-x-3">
                <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                  <TrendingUp size={14} className="text-emerald-400 mb-1" />
                  <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">Inflow</p>
                  <p className="text-md font-bold">{formatPrice(periodStats.income)}</p>
                </div>
                <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                  <TrendingDown size={14} className="text-rose-400 mb-1" />
                  <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">Outflow</p>
                  <p className="text-md font-bold">{formatPrice(periodStats.expense)}</p>
                </div>
              </div>
            </div>

            {/* Recently Added */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent Activity</h3>
                {transactions.length > 5 && <span className="text-[9px] font-black text-indigo-500 uppercase cursor-pointer" onClick={() => setActiveTab('journal')}>See Full Log</span>}
              </div>
              {recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
                  <Clock className="text-slate-300 dark:text-slate-700 mb-2" size={32} />
                  <p className="text-[11px] text-slate-400 italic">Financial logs are empty for today.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {recentTransactions.slice(0, 5).map(t => (
                    <div key={t.id} onClick={() => handleEditClick(t)} className="bg-white dark:bg-slate-900 p-4 rounded-3xl flex items-center justify-between premium-shadow border border-slate-50 dark:border-slate-800 active:scale-95 transition-all cursor-pointer group">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{(t.type === 'income' ? incomeCategories : expenseCategories).find(c => c.name === t.category)?.icon || '💸'}</span>
                        <div>
                          <p className="font-bold text-[11px]">{t.category}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{formatTime(t.timestamp)}</p>
                        </div>
                      </div>
                      <p className={`font-black text-[12px] ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatPrice(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Insights Card or Auth Card */}
            {isAiAuthorized ? (
              <div className="bg-indigo-600 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden group">
                 <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                 <div className="flex items-center space-x-2 mb-3">
                    <Sparkles size={16} className="text-indigo-200" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest">PLATINUM INSIGHTS</h3>
                 </div>
                 <p className={`text-[13px] leading-relaxed font-medium ${loadingInsights ? 'opacity-50 animate-pulse' : 'opacity-100'}`}>"{insights}"</p>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden group border border-slate-800">
                 <div className="absolute right-[-10%] bottom-[-10%] w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                 <div className="flex items-center space-x-2 mb-4">
                    <Lock size={14} className="text-indigo-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Features Disabled</h3>
                 </div>
                 <p className="text-[12px] leading-relaxed font-medium text-slate-300 mb-6">Authorize AI to unlock deep financial insights and automated patterns.</p>
                 <button onClick={handleAuthorizeAi} className="w-full bg-indigo-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg">
                   <ShieldCheck size={16} />
                   <span>Connect AI Engine</span>
                 </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Journal */}
        {activeTab === 'journal' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col space-y-4">
              <h3 className="text-2xl font-black tracking-tight px-1">Ledger Journal</h3>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-hidden">
                {(['day', 'week', 'month', 'year'] as TimePeriod[]).map(p => (
                  <button key={p} onClick={() => setJournalPeriod(p)} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${journalPeriod === p ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400'}`}>{p}</button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              {journalTransactions.length === 0 ? (
                <div className="text-center py-24 text-slate-400 space-y-4">
                   <CalendarDays className="mx-auto opacity-10" size={80} />
                   <p className="text-xs font-black uppercase tracking-widest">No transaction logs</p>
                </div>
              ) : (
                <div className="space-y-4 pb-12">
                  {journalTransactions.map((t, idx) => {
                    const showDateHeader = idx === 0 || t.date !== journalTransactions[idx - 1].date;
                    const cat = (t.type === 'income' ? incomeCategories : expenseCategories).find(c => c.name === t.category);
                    return (
                      <div key={t.id} className="space-y-2">
                        {showDateHeader && (
                          <div className="flex items-center space-x-2 mt-6 first:mt-0 px-2">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                              {new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800"></div>
                          </div>
                        )}
                        <div onClick={() => handleEditClick(t)} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] flex items-center justify-between premium-shadow border border-slate-50 dark:border-slate-800 active:scale-95 transition-transform cursor-pointer">
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600'}`}>
                               {cat?.icon || '📦'}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{t.category}</p>
                              <div className="flex items-center text-[10px] text-slate-400 font-bold space-x-2">
                                <span className="flex items-center"><Clock size={10} className="mr-1" /> {formatTime(t.timestamp)}</span>
                                <span className="italic truncate max-w-[120px]">{t.note || 'No description'}</span>
                              </div>
                            </div>
                          </div>
                          <p className={`font-black text-md ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === 'income' ? '+' : '-'}{formatPrice(t.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Stats */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-12">
            <div className="flex flex-col space-y-4">
              <h3 className="text-2xl font-black tracking-tight px-1 text-center">Inflow vs Outflow</h3>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-hidden">
                {(['day', 'week', 'month', 'year'] as TimePeriod[]).map(p => (
                  <button key={p} onClick={() => setStatsPeriod(p)} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${statsPeriod === p ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400'}`}>{p}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white dark:bg-slate-900 p-7 rounded-[2.5rem] premium-shadow border border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Period Volume</p>
                  <p className="text-3xl font-black">{formatPrice(statsBreakdown.income + statsBreakdown.expense)}</p>
                </div>
                <div className={`px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest ${statsBreakdown.income >= statsBreakdown.expense ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600'}`}>
                  {statsBreakdown.income >= statsBreakdown.expense ? 'SURPLUS' : 'DEFICIT'}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 premium-shadow border border-slate-50 dark:border-slate-800">
                <h4 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Distribution: Expenses</h4>
                <PremiumChart transactions={statsTransactions} type="expense" />
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 premium-shadow border border-slate-50 dark:border-slate-800">
                <h4 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Distribution: Inflow</h4>
                <PremiumChart transactions={statsTransactions} type="income" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 left-0 right-0 flex justify-center z-30 pointer-events-none">
        <button onClick={() => { resetForm(); setShowAddModal(true); }} className="pointer-events-auto bg-slate-900 dark:bg-indigo-600 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-slate-50 dark:border-slate-950">
          <Plus size={32} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 z-40 px-6 py-4">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <LayoutDashboard size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Dash</span>
          </button>
          <button onClick={() => setActiveTab('journal')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'journal' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <CalendarDays size={22} strokeWidth={activeTab === 'journal' ? 2.5 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Logs</span>
          </button>
          <div className="w-16 h-10"></div>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'stats' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <PieIcon size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">Stats</span>
          </button>
          <button onClick={() => setShowBudgetModal(true)} className="flex flex-col items-center space-y-1 text-slate-400 hover:text-indigo-500">
            <TrendingUp size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Limits</span>
          </button>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 animate-in slide-in-from-bottom duration-300 overflow-y-auto no-scrollbar">
          <div className="max-w-lg mx-auto p-8 space-y-8 pb-32">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tighter">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-3 bg-slate-100 dark:bg-slate-900 rounded-full transition-transform active:scale-90"><X size={24}/></button>
            </div>

            <section className="space-y-4">
               <div className="flex items-center space-x-2 text-slate-400 mb-2">
                 <User size={16} />
                 <h3 className="text-[10px] font-black uppercase tracking-widest">Profile</h3>
               </div>
               <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Display Name</label>
                    <input 
                      type="text" 
                      value={settings.userName} 
                      onChange={(e) => setSettings({...settings, userName: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 font-bold"
                    />
                  </div>
               </div>
            </section>

            {/* AI Setup Setting */}
            <section className="space-y-4">
               <div className="flex items-center space-x-2 text-slate-400 mb-2">
                 <Sparkles size={16} />
                 <h3 className="text-[10px] font-black uppercase tracking-widest">AI Connection</h3>
               </div>
               <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${isAiAuthorized ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                           {isAiAuthorized ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                        </div>
                        <span className="font-bold text-sm">{isAiAuthorized ? 'Connected' : 'Disconnected'}</span>
                     </div>
                     <button onClick={handleAuthorizeAi} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                        {isAiAuthorized ? 'Refresh' : 'Authorize'}
                     </button>
                  </div>
               </div>
            </section>

            <section className="space-y-4">
               <div className="flex items-center space-x-2 text-slate-400 mb-2">
                 <LayoutDashboard size={16} />
                 <h3 className="text-[10px] font-black uppercase tracking-widest">Preferences</h3>
               </div>
               <div className="bg-white dark:bg-slate-900 p-2 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl">
                        {settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                      </div>
                      <span className="font-bold text-sm">Dark Mode</span>
                    </div>
                    <button onClick={() => setSettings({...settings, theme: settings.theme === 'light' ? 'dark' : 'light'})} className={`w-12 h-6 rounded-full transition-all relative ${settings.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.theme === 'dark' ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl">
                        <TrendingUp size={18} />
                      </div>
                      <span className="font-bold text-sm">Wealth Rollover</span>
                    </div>
                    <button onClick={() => setSettings({...settings, enableRollover: !settings.enableRollover})} className={`w-12 h-6 rounded-full transition-all relative ${settings.enableRollover ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableRollover ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
               </div>
            </section>

            {/* Smart Migration Panel */}
            <section className="space-y-4">
               <div className="flex items-center space-x-2 text-slate-400 mb-2">
                 <Database size={16} />
                 <h3 className="text-[10px] font-black uppercase tracking-widest">Historical Migration</h3>
               </div>
               <div className="bg-white dark:bg-slate-900 p-7 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-2 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-2">
                       <CheckCircle2 size={14} className="text-emerald-500" />
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Bulk Import System</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Copy your Excel data and paste here. Supports all common layouts automatically.
                    </p>
                  </div>
                  
                  {migrationMessage && (
                    <div className={`flex items-center space-x-2 p-3 rounded-xl border animate-in zoom-in duration-300 ${migrationStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30' : 'bg-rose-50 border-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/30'}`}>
                       {migrationStatus === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                       <p className="text-[10px] font-black uppercase tracking-tight">{migrationMessage}</p>
                    </div>
                  )}

                  <textarea 
                    value={migrationText}
                    onChange={(e) => {
                      setMigrationText(e.target.value);
                      if (migrationStatus !== 'idle') setMigrationStatus('idle');
                      if (migrationMessage) setMigrationMessage(null);
                    }}
                    placeholder="Paste rows from Excel here..."
                    className="w-full h-40 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-[11px] font-mono border-none focus:ring-2 focus:ring-indigo-500 text-slate-600 dark:text-slate-300 no-scrollbar resize-none placeholder:opacity-30"
                  ></textarea>
                  
                  <button 
                    onClick={handleMigrateData}
                    disabled={!migrationText.trim() || isMigrating}
                    className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50 transition-all shadow-lg group overflow-hidden"
                  >
                    {isMigrating ? (
                      <Sparkles size={16} className="animate-spin" />
                    ) : (
                      <Database size={16} />
                    )}
                    <span>{isMigrating ? 'MIGRATING...' : 'IMPORT HISTORY'}</span>
                  </button>
               </div>
            </section>

            <div className="text-center pt-8">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Luxe Ledger Platinum Edition</p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Entry/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[3.5rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight">{editingTransactionId ? 'Modify Record' : 'New Entry'}</h2>
              <div className="flex items-center space-x-2">
                {editingTransactionId && (
                  <button onClick={() => handleDeleteTransaction(editingTransactionId)} className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-full text-rose-500 hover:bg-rose-100 transition-colors"><Trash2 size={20}/></button>
                )}
                <button onClick={() => { setShowAddModal(false); resetForm(); }} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
              </div>
            </div>
            
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
              <button onClick={() => setNewType('expense')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${newType === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-400'}`}>Expense</button>
              <button onClick={() => setNewType('income')} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${newType === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400'}`}>Income</button>
            </div>

            <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-2xl">{currency.symbol}</span>
               <input type="number" placeholder="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="w-full pl-12 pr-4 py-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border-none focus:ring-2 focus:ring-indigo-500 text-5xl font-black text-slate-800 dark:text-white" autoFocus />
            </div>

            <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-40 no-scrollbar py-2">
              {(newType === 'income' ? incomeCategories : expenseCategories).map(cat => (
                <button key={cat.id} onClick={() => setNewCategory(cat.name)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${newCategory === cat.name ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'}`}>
                  <span className="text-2xl mb-1">{cat.icon}</span>
                  <span className="text-[10px] font-black uppercase truncate w-full text-center">{cat.name}</span>
                </button>
              ))}
              <button onClick={() => setShowCustomCategoryInput(true)} className="flex flex-col items-center justify-center p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400">
                <PlusCircle size={22} className="mb-1" />
                <span className="text-[10px] font-black uppercase">Add Cat</span>
              </button>
            </div>

            {showCustomCategoryInput && (
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 animate-in zoom-in duration-200">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">New Category Label</p>
                <input type="text" placeholder="e.g. Shopping" value={customCategoryName} onChange={(e) => setCustomCategoryName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-xl text-sm font-bold border-none" />
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto no-scrollbar p-1">
                  {COMMON_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => setSelectedEmoji(emoji)} className={`text-xl p-2 rounded-xl transition-all ${selectedEmoji === emoji ? 'bg-indigo-600 shadow-lg scale-110' : 'bg-white dark:bg-slate-900'}`}>{emoji}</button>
                  ))}
                </div>
                <button onClick={() => {
                   if (customCategoryName) {
                     const newCat = { id: Date.now().toString(), name: customCategoryName, icon: selectedEmoji, color: '#6366f1', type: newType };
                     newType === 'income' ? setIncomeCategories(p => [...p, newCat]) : setExpenseCategories(p => [...p, newCat]);
                     setNewCategory(customCategoryName);
                     setShowCustomCategoryInput(false);
                     setCustomCategoryName('');
                   }
                }} className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest">Confirm</button>
              </div>
            )}

            <input type="text" placeholder="Memo..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none text-sm font-medium text-slate-600 dark:text-slate-300" />
            <button onClick={handleSaveTransaction} disabled={!newAmount || !newCategory} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 disabled:opacity-50 uppercase tracking-widest">
              {editingTransactionId ? 'SYNC CHANGES' : 'POST ENTRY'}
            </button>
          </div>
        </div>
      )}

      {/* Minimal Tile-based Limits (Budgets) Panel */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-t-[3.5rem] p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[85vh] no-scrollbar animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Period Caps</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Control your burn rate</p>
              </div>
              <button onClick={() => { setShowBudgetModal(false); setActiveBudgetCategory(null); }} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
            </div>

            {activeBudgetCategory && (
              <div className="p-6 bg-indigo-50 dark:bg-indigo-950/30 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900 animate-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{expenseCategories.find(c => c.name === activeBudgetCategory)?.icon}</span>
                    <span className="font-black text-indigo-900 dark:text-indigo-200 uppercase text-xs tracking-widest">{activeBudgetCategory}</span>
                  </div>
                  <button onClick={() => setActiveBudgetCategory(null)} className="text-indigo-400 hover:text-indigo-600"><X size={16}/></button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 font-black text-2xl">{currency.symbol}</span>
                  <input 
                    type="number" 
                    placeholder="Set Limit" 
                    defaultValue={budgets.find(b => b.categoryName === activeBudgetCategory)?.limit || ''}
                    onBlur={(e) => handleSetBudget(activeBudgetCategory, parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 text-3xl font-black text-slate-800 dark:text-white shadow-sm"
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {expenseCategories.map(cat => {
                const limit = budgets.find(b => b.categoryName === cat.name)?.limit || 0;
                const isActive = activeBudgetCategory === cat.name;
                return (
                  <button 
                    key={cat.id} 
                    onClick={() => setActiveBudgetCategory(cat.name)}
                    className={`flex flex-col items-center justify-center p-4 rounded-3xl transition-all border ${isActive ? 'bg-indigo-600 text-white border-indigo-600 scale-105 shadow-xl' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}
                  >
                    <span className="text-2xl mb-1">{cat.icon}</span>
                    <p className={`text-[9px] font-black uppercase truncate w-full text-center ${isActive ? 'text-white' : 'text-slate-500'}`}>{cat.name}</p>
                    {limit > 0 && (
                      <p className={`text-[8px] font-black mt-1 px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300'}`}>
                        {limit}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <button onClick={() => { setShowBudgetModal(false); setActiveBudgetCategory(null); }} className="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-transform">FINISH SETUP</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
