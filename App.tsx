
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Download,
  Zap,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Lock,
  MessageSquare,
  Key,
  Upload,
  FileSpreadsheet,
  Save,
  Edit3,
  LogOut,
  ArrowRight,
  Cloud,
  CloudLightning,
  Loader2,
  RefreshCw
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
import { getFinancialInsights, parseNaturalLanguageTransaction } from './services/geminiService';
import { findAppDataFile, downloadAppData, createAppDataFile, updateAppDataFile } from './services/driveService';

// Fix for window.google TS error
declare global {
  interface Window {
    google: any;
  }
}

// --- CONFIGURATION ---
// User provided Client ID. 
// NOTE: Client Secret is NOT used in frontend applications for security reasons.
// Added .trim() to ensure no accidental whitespace causes errors.
const GOOGLE_CLIENT_ID = '122158674616-928aopvfdh0ckll166gkm7gdu89suoel.apps.googleusercontent.com'.trim();

type TabType = 'home' | 'journal' | 'stats';
type TimePeriod = 'day' | 'week' | 'month' | 'year';

const App: React.FC = () => {
  // --- Persistent State ---
  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('onboarded') === 'true');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [journalPeriod, setJournalPeriod] = useState<TimePeriod>('month');
  const [statsPeriod, setStatsPeriod] = useState<TimePeriod>('month');

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : {
      userName: 'Guest',
      theme: 'light',
      monthStartDay: 1,
      enableRollover: true,
      stealthMode: false,
      apiKey: ''
    };
  });

  // Calculate AI Authorization
  const isAiAuthorized = useMemo(() => {
    try { return !!process.env.API_KEY; } catch { return false; }
  }, []);

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

  // --- Google Drive Sync State ---
  const [userToken, setUserToken] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // --- UI & Utility State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  
  const [insights, setInsights] = useState<string>('Analyzing your wealth...');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [hideBalances, setHideBalances] = useState(settings.stealthMode);

  // Magic Entry State
  const [magicText, setMagicText] = useState('');
  const [isMagicParsing, setIsMagicParsing] = useState(false);

  // Form State
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newCategory, setNewCategory] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  // Custom Category Creation State
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('');
  const [newCustomCategoryEmoji, setNewCustomCategoryEmoji] = useState(COMMON_EMOJIS[0]);

  // Budget Editing State
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
  const [editingBudgetLimit, setEditingBudgetLimit] = useState('');

  // Migration State
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // --- GOOGLE SYNC LOGIC ---

  // Auto-save to Drive when data changes (debounced)
  useEffect(() => {
    if (!userToken || !driveFileId || syncStatus === 'syncing') return;

    const saveData = async () => {
      setSyncStatus('syncing');
      try {
        const payload = {
            version: 1,
            timestamp: Date.now(),
            settings,
            currency,
            transactions,
            budgets,
            incomeCategories,
            expenseCategories
        };
        await updateAppDataFile(userToken, driveFileId, payload);
        setSyncStatus('success');
        setLastSyncTime(Date.now());
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (e) {
        console.error("Auto-save failed", e);
        setSyncStatus('error');
      }
    };

    const timer = setTimeout(saveData, 3000); // 3-second debounce
    return () => clearTimeout(timer);
  }, [transactions, budgets, settings, currency, incomeCategories, expenseCategories, userToken, driveFileId]);


  const handleGoogleLogin = () => {
    if (!window.google) {
      alert("Google Identity Services not loaded. Please refresh the page.");
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (response: any) => {
          if (response.access_token) {
            setUserToken(response.access_token);
            setIsSyncing(true);
            setSyncStatus('syncing');
            try {
               // 1. Look for existing file
               const existingFile = await findAppDataFile(response.access_token);
               
               if (existingFile) {
                 // 2a. Found: Download and merge
                 setDriveFileId(existingFile.id);
                 const cloudData = await downloadAppData(response.access_token, existingFile.id);
                 
                 if (cloudData) {
                    // Merge logic: Prioritize Cloud if it exists.
                    if (confirm("Found backup in Google Drive. Load it? This will overwrite local changes made since last sync.")) {
                        if (cloudData.transactions) setTransactions(cloudData.transactions);
                        if (cloudData.budgets) setBudgets(cloudData.budgets);
                        if (cloudData.settings) setSettings(cloudData.settings);
                        if (cloudData.currency) setCurrency(cloudData.currency);
                        if (cloudData.incomeCategories) setIncomeCategories(cloudData.incomeCategories);
                        if (cloudData.expenseCategories) setExpenseCategories(cloudData.expenseCategories);
                    }
                 }
               } else {
                 // 2b. Not Found: Create new file with current local data
                 const payload = {
                   version: 1,
                   timestamp: Date.now(),
                   settings,
                   currency,
                   transactions,
                   budgets,
                   incomeCategories,
                   expenseCategories
                 };
                 const newFile = await createAppDataFile(response.access_token, payload);
                 setDriveFileId(newFile.id);
               }
               setSyncStatus('success');
               setLastSyncTime(Date.now());
            } catch (error) {
              console.error("Sync init failed", error);
              setSyncStatus('error');
              alert("Failed to sync with Drive. Please check your network or try again.");
            } finally {
              setIsSyncing(false);
            }
          } else if (response.error) {
             console.error("Google Auth Error:", response);
             alert(`Google Login Failed: ${response.error_description || response.error}`);
          }
        },
      });
      client.requestAccessToken();
    } catch (e: any) {
        console.error("Token Client Init Error", e);
        alert(`Could not initialize Google Login: ${e.message}`);
    }
  };

  // --- Helpers ---
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
  
  const dailyActivity = useMemo(() => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toDateString();
    }).reverse();

    const stats = last7Days.map(dayStr => {
      const dayTotal = transactions
        .filter(t => new Date(t.date).toDateString() === dayStr && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      return dayTotal;
    });

    return stats;
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return transactions.filter(t => Date.now() - t.timestamp < 48 * 60 * 60 * 1000)
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

  // --- Handlers ---
  const handleCreateCustomCategory = () => {
    if (!newCustomCategoryName.trim()) return;
    
    const newCat: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCustomCategoryName.trim(),
      icon: newCustomCategoryEmoji,
      color: '#6366f1', // default indigo
      type: newType
    };

    if (newType === 'income') {
      setIncomeCategories([...incomeCategories, newCat]);
    } else {
      setExpenseCategories([...expenseCategories, newCat]);
    }

    setNewCategory(newCat.name);
    setIsCreatingCategory(false);
    setNewCustomCategoryName('');
    setNewCustomCategoryEmoji(COMMON_EMOJIS[0]);
  };

  const handleMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicText.trim() || isMagicParsing) return;
    if (!isAiAuthorized) {
        alert("API Key is missing in environment variables.");
        return;
    }
    setIsMagicParsing(true);
    const parsed = await parseNaturalLanguageTransaction(magicText, {
      income: incomeCategories.map(c => c.name),
      expense: expenseCategories.map(c => c.name)
    });

    if (parsed && parsed.amount > 0) {
      const transaction: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: parsed.type as TransactionType,
        category: parsed.category,
        amount: parsed.amount,
        date: new Date().toISOString().split('T')[0],
        note: parsed.note || magicText,
        timestamp: Date.now()
      };
      setTransactions(prev => [transaction, ...prev]);
      setMagicText('');
    } else {
      alert("Could not process transaction. Please try again or enter manually.");
    }
    setIsMagicParsing(false);
  };

  const handleExportData = () => {
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Note'];
    const rows = transactions.map(t => [
      t.date,
      t.type,
      t.category,
      t.amount.toString(),
      t.note || ''
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `luxe_ledger_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Note'];
    const example = [`${new Date().toISOString().split('T')[0]}`, 'expense', 'Food', '50', 'Lunch'];
    const csvContent = [headers, example].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `luxe_ledger_template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n');
      const newTransactions: Transaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 4) {
          const [date, type, category, amount, note] = parts;
          if ((type === 'income' || type === 'expense') && !isNaN(parseFloat(amount))) {
             newTransactions.push({
               id: Math.random().toString(36).substr(2, 9),
               date: date.trim(),
               type: type as TransactionType,
               category: category.trim(),
               amount: parseFloat(amount),
               note: note ? note.trim() : '',
               timestamp: new Date(date).getTime()
             });
          }
        }
      }
      if (newTransactions.length > 0) {
        setTransactions(prev => [...prev, ...newTransactions]);
        alert(`Successfully imported ${newTransactions.length} transactions.`);
      } else {
        alert('No valid transactions found in file. Please use the template.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  const handleSaveBudget = () => {
    if (!editingBudgetCategory) return;
    const limit = parseFloat(editingBudgetLimit);
    if (limit > 0) {
      setBudgets(prev => {
        const existing = prev.filter(b => b.categoryName !== editingBudgetCategory);
        return [...existing, { categoryName: editingBudgetCategory, limit }];
      });
    } else {
      setBudgets(prev => prev.filter(b => b.categoryName !== editingBudgetCategory));
    }
    setEditingBudgetCategory(null);
  };

  const resetForm = () => {
    setNewAmount('');
    setNewCategory('');
    setNewNote('');
    setIsCreatingCategory(false);
    setNewCustomCategoryName('');
    setEditingTransactionId(null);
  };

  const formatPrice = (val: number) => {
    if (hideBalances) return '••••••';
    return `${currency.symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    if (!isOnboarded || transactions.length === 0 || !isAiAuthorized) return;
    const fetchInsights = async () => {
      setLoadingInsights(true);
      const res = await getFinancialInsights(transactions, MONTHS[currentDate.getMonth()]);
      setInsights(res);
      setLoadingInsights(false);
    };
    const timer = setTimeout(fetchInsights, 2000);
    return () => clearTimeout(timer);
  }, [transactions.length, isAiAuthorized, isOnboarded]);

  const getBudgetProgress = (catName: string) => {
    const limit = budgets.find(b => b.categoryName === catName)?.limit || 0;
    const spent = transactions
      .filter(t => t.category === catName && t.type === 'expense')
      .filter(t => {
        const d = new Date(t.date);
        return d >= currentPeriod.start && d <= currentPeriod.end;
      })
      .reduce((sum, t) => sum + t.amount, 0);
    return { limit, spent };
  };

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
          <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1 relative">
            <SettingsIcon size={22}/>
            {syncStatus === 'error' && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
          </button>
        </div>
      </header>

      <main className="px-6 pt-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
        {/* SYNC STATUS BANNER (Only if connected) */}
        {userToken && (
            <div className={`flex items-center justify-between px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${syncStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
               <div className="flex items-center space-x-2">
                  {syncStatus === 'syncing' ? <RefreshCw size={12} className="animate-spin" /> : <CloudLightning size={12} />}
                  <span>{syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync Error' : 'Drive Connected'}</span>
               </div>
               {lastSyncTime && syncStatus !== 'syncing' && (
                   <span className="opacity-50">{new Date(lastSyncTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
               )}
            </div>
        )}

        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Balance Card */}
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

            {/* Magic Entry Bar */}
            <div className="relative group">
              <form onSubmit={handleMagicSubmit} className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500">
                  {isMagicParsing ? <Sparkles size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                </div>
                <input 
                  type="text" 
                  value={magicText}
                  onChange={(e) => setMagicText(e.target.value)}
                  placeholder="Magic add: 'Spent 50 on dinner'..."
                  disabled={!isAiAuthorized}
                  className="w-full bg-white dark:bg-slate-900 pl-12 pr-12 py-5 rounded-3xl border border-slate-100 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-sm font-bold premium-shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button 
                  type="submit" 
                  disabled={!isAiAuthorized}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900 dark:bg-indigo-600 text-white p-2 rounded-xl active:scale-90 transition-all disabled:opacity-50"
                >
                  <Zap size={14} />
                </button>
              </form>
            </div>

            {/* Daily Momentum */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] premium-shadow border border-slate-50 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Velocity</h3>
                <div className="flex items-center space-x-1 text-emerald-500 font-bold text-[10px]">
                  <TrendingUp size={12} />
                  <span>OPTIMAL</span>
                </div>
              </div>
              <div className="flex items-end justify-between h-20 px-2">
                {dailyActivity.map((val, i) => {
                  const max = Math.max(...dailyActivity, 1);
                  const height = (val / max) * 100;
                  return (
                    <div key={i} className="flex flex-col items-center group w-full">
                       <div 
                         className="w-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full h-16 relative overflow-hidden"
                       >
                         <div 
                           className="absolute bottom-0 left-0 right-0 bg-indigo-600 rounded-full transition-all duration-1000" 
                           style={{ height: `${height}%` }}
                         ></div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recently Added */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Activity</h3>
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
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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

            {/* AI Insights Card */}
            {isAiAuthorized && (
              <div className="bg-indigo-600 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden group">
                 <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                 <div className="flex items-center space-x-2 mb-3">
                    <Sparkles size={16} className="text-indigo-200" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest">PLATINUM INSIGHTS</h3>
                 </div>
                 <p className={`text-[13px] leading-relaxed font-medium ${loadingInsights ? 'opacity-50 animate-pulse' : 'opacity-100'}`}>"{insights}"</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Journal (Existing Code Structure Preserved) */}
        {activeTab === 'journal' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-12">
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
                <div className="space-y-4">
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
                                <span className="flex items-center"><Clock size={10} className="mr-1" /> {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

        {/* Tab: Stats (Existing Code Structure Preserved) */}
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
                  <p className="text-3xl font-black">{formatPrice(statsTransactions.reduce((acc, t) => acc + t.amount, 0))}</p>
                </div>
                <div className={`px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest ${periodStats.income >= periodStats.expense ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600'}`}>
                  {periodStats.income >= periodStats.expense ? 'SURPLUS' : 'DEFICIT'}
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
          <button onClick={() => setShowBudgetModal(true)} className="flex flex-col items-center space-y-1 text-slate-400 hover:text-indigo-500 transition-colors">
            <TrendingUp size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Limits</span>
          </button>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-lg h-full overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
            <div className="p-8 space-y-8 pb-32">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-3 bg-slate-100 dark:bg-slate-900 rounded-full transition-transform active:scale-90"><X size={24}/></button>
              </div>

              {/* Cloud Sync Section - Google Drive */}
              <section className="space-y-4">
                 <div className="flex items-center space-x-2 text-slate-400 mb-2">
                   <Cloud size={16} />
                   <h3 className="text-[10px] font-black uppercase tracking-widest">Cloud Sync</h3>
                 </div>
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    {userToken ? (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl">
                                <CheckCircle2 size={24} />
                                <div>
                                    <p className="font-bold text-sm">Synced with Drive</p>
                                    <p className="text-[10px] opacity-70">Data is automatically backed up.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    if(confirm("Log out of Drive? Local data will remain.")) {
                                        setUserToken(null);
                                        setDriveFileId(null);
                                    }
                                }}
                                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                Connect Google Drive to sync your financial data across devices for free.
                            </p>
                            <button 
                                onClick={handleGoogleLogin}
                                className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg active:scale-95 transition-all"
                            >
                                <CloudLightning size={16} />
                                <span>Connect Google Drive</span>
                            </button>
                        </div>
                    )}
                 </div>
              </section>

              {/* Data Import / Export */}
              <section className="space-y-4">
                 <div className="flex items-center space-x-2 text-slate-400 mb-2">
                   <Database size={16} />
                   <h3 className="text-[10px] font-black uppercase tracking-widest">Data & Migration</h3>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleExportData}
                      className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all"
                    >
                      <Download size={24} className="text-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Export CSV</span>
                    </button>
                    
                    <button 
                      onClick={handleDownloadTemplate}
                      className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all"
                    >
                      <FileSpreadsheet size={24} className="text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Get Template</span>
                    </button>
                 </div>

                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                   <div className="text-center space-y-3">
                     <p className="text-xs font-bold text-slate-500">Restore from CSV</p>
                     <input 
                       type="file" 
                       accept=".csv"
                       ref={fileInputRef}
                       onChange={handleFileUpload}
                       className="hidden"
                     />
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 transition-all"
                     >
                       <Upload size={16} />
                       <span>Upload & Restore</span>
                     </button>
                   </div>
                 </div>
              </section>

              {/* User Info */}
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

              {/* Preferences */}
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
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-md">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[3.5rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
            {isCreatingCategory ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-black tracking-tight">New Category</h2>
                   <button onClick={() => setIsCreatingCategory(false)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400"><ChevronLeft size={20}/></button>
                </div>
                <div className="space-y-4">
                   <div>
                     <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Name</label>
                     <input 
                       type="text"
                       value={newCustomCategoryName}
                       onChange={(e) => setNewCustomCategoryName(e.target.value)}
                       placeholder="e.g., Subscriptions"
                       className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none text-lg font-bold"
                       autoFocus
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Icon</label>
                     <div className="grid grid-cols-6 gap-2 mt-2 h-40 overflow-y-auto no-scrollbar">
                       {COMMON_EMOJIS.map(emoji => (
                         <button 
                           key={emoji}
                           onClick={() => setNewCustomCategoryEmoji(emoji)}
                           className={`aspect-square flex items-center justify-center text-2xl rounded-2xl transition-all ${newCustomCategoryEmoji === emoji ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800'}`}
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                   </div>
                   <button 
                     onClick={handleCreateCustomCategory}
                     disabled={!newCustomCategoryName.trim()}
                     className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                   >
                     Create Category
                   </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black tracking-tight">{editingTransactionId ? 'Modify Record' : 'New Entry'}</h2>
                  <div className="flex items-center space-x-2">
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
                  <button onClick={() => setIsCreatingCategory(true)} className="flex flex-col items-center justify-center p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    <Plus size={24} className="mb-1" />
                    <span className="text-[10px] font-black uppercase truncate w-full text-center">Add New</span>
                  </button>
                </div>

                <input type="text" placeholder="Memo..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none text-sm font-medium text-slate-600 dark:text-slate-300" />
                <button onClick={handleSaveTransaction} disabled={!newAmount || !newCategory} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                  {editingTransactionId ? 'SYNC CHANGES' : 'POST ENTRY'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-[60] flex justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-lg h-full overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300">
             <div className="p-6 space-y-6 pb-32">
                <div className="flex justify-between items-center sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 py-4">
                  <h2 className="text-3xl font-black tracking-tighter">Budget Limits</h2>
                  <button onClick={() => setShowBudgetModal(false)} className="p-3 bg-slate-100 dark:bg-slate-900 rounded-full transition-transform active:scale-90"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                   {expenseCategories.map(cat => {
                     const { limit, spent } = getBudgetProgress(cat.name);
                     const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                     const isEditing = editingBudgetCategory === cat.name;

                     return (
                       <div key={cat.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                          <div 
                            className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-1000" 
                            style={{ width: `${percent}%`, backgroundColor: percent >= 100 ? '#f43f5e' : '#4f46e5' }}
                          ></div>

                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="text-3xl bg-slate-50 dark:bg-slate-800 w-12 h-12 flex items-center justify-center rounded-2xl">{cat.icon}</div>
                              <div>
                                <h3 className="font-bold text-sm">{cat.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                                  {limit > 0 ? `${Math.round(percent)}% Used` : 'No Limit Set'}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                if (isEditing) handleSaveBudget();
                                else {
                                  setEditingBudgetCategory(cat.name);
                                  setEditingBudgetLimit(limit.toString());
                                }
                              }}
                              className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                            >
                              {isEditing ? <CheckCircle2 size={18} /> : <Edit3 size={18} />}
                            </button>
                          </div>

                          {isEditing ? (
                            <div className="animate-in fade-in slide-in-from-top-2">
                               <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
                                  <input 
                                    type="number" 
                                    autoFocus
                                    value={editingBudgetLimit}
                                    onChange={(e) => setEditingBudgetLimit(e.target.value)}
                                    placeholder="Set limit"
                                    className="w-full bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-3 rounded-xl font-black text-lg"
                                  />
                               </div>
                               <p className="text-[9px] text-slate-400 mt-2 ml-2">Set to 0 to remove limit.</p>
                            </div>
                          ) : (
                            <div className="flex justify-between items-end">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spent</p>
                                <p className="text-lg font-black">{formatPrice(spent)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cap</p>
                                <p className={`text-lg font-black ${limit > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300'}`}>
                                  {limit > 0 ? formatPrice(limit) : '∞'}
                                </p>
                              </div>
                            </div>
                          )}
                       </div>
                     );
                   })}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
