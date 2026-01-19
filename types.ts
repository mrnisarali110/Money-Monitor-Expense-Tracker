
export type TransactionType = 'income' | 'expense';
export type ThemeMode = 'light' | 'dark';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string; // ISO string YYYY-MM-DD
  note?: string;
  timestamp: number;
}

export interface Budget {
  categoryName: string;
  limit: number;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export interface UserSettings {
  userName: string;
  theme: ThemeMode;
  monthStartDay: number;
  enableRollover: boolean;
  stealthMode: boolean;
  dailyReminders: boolean; // New Field
  apiKey?: string;
}
