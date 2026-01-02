
import { Category, Currency } from './types';

export const INITIAL_INCOME_CATEGORIES: Category[] = [
  { id: 'inc-1', name: 'Salary', icon: '💰', color: '#10b981', type: 'income' },
  { id: 'inc-2', name: 'Bonus', icon: '✨', color: '#3b82f6', type: 'income' },
  { id: 'inc-3', name: 'Freelance', icon: '💻', color: '#8b5cf6', type: 'income' },
  { id: 'inc-4', name: 'Business', icon: '💼', color: '#f59e0b', type: 'income' },
];

export const INITIAL_EXPENSE_CATEGORIES: Category[] = [
  { id: 'exp-1', name: 'Rent', icon: '🏠', color: '#f43f5e', type: 'expense' },
  { id: 'exp-2', name: 'Food', icon: '🍕', color: '#ec4899', type: 'expense' },
  { id: 'exp-3', name: 'Household', icon: '🛒', color: '#0ea5e9', type: 'expense' },
  { id: 'exp-4', name: 'Cig.', icon: '🚬', color: '#64748b', type: 'expense' },
  { id: 'exp-5', name: 'Transport', icon: '🚗', color: '#6366f1', type: 'expense' },
  { id: 'exp-6', name: 'Utilities', icon: '⚡', color: '#fbbf24', type: 'expense' },
  { id: 'exp-7', name: 'Health', icon: '🏥', color: '#14b8a6', type: 'expense' },
  { id: 'exp-8', name: 'Personal care', icon: '🧴', color: '#f472b6', type: 'expense' },
  { id: 'exp-9', name: 'Investments', icon: '📈', color: '#8b5cf6', type: 'expense' },
];

export const COMMON_EMOJIS = [
  '💰', '💸', '💎', '📈', '🏦', '🏠', '🛒', '🍔', '🍕', '☕', 
  '🚗', '🚌', '✈️', '⚡', '💻', '📱', '🎮', '🏥', '💊', '🎓', 
  '🏋️', '🎨', '🍿', '🎁', '🐾', '🌿', '🔒', '💼', '🛠️', '✨', '🚬', '🧴'
];

export const CURRENCIES: Currency[] = [
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
