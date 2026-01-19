
import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Transaction } from '../types';

interface PremiumBarChartProps {
  transactions: Transaction[];
  period: 'day' | 'week' | 'month' | 'year';
  currencySymbol: string;
}

export const PremiumBarChart: React.FC<PremiumBarChartProps> = ({ transactions, period, currencySymbol }) => {
  // Group data based on period
  const data = React.useMemo(() => {
    const grouped: Record<string, { name: string; income: number; expense: number }> = {};
    
    // Helper to sort keys later
    const keys: string[] = [];

    transactions.forEach(t => {
      const date = new Date(t.date);
      let key = '';
      let label = '';

      if (period === 'year') {
        key = date.getMonth().toString();
        label = date.toLocaleString('default', { month: 'short' });
      } else if (period === 'month') {
        key = date.getDate().toString();
        label = date.getDate().toString();
      } else {
        // Week or Day view - group by day name
        key = date.getDay().toString();
        label = date.toLocaleString('default', { weekday: 'short' });
      }

      if (!grouped[key]) {
        grouped[key] = { name: label, income: 0, expense: 0 };
        keys.push(key);
      }

      if (t.type === 'income') grouped[key].income += t.amount;
      else grouped[key].expense += t.amount;
    });

    // Sort based on time (simple key sort works for numbers 0-31)
    return keys.sort((a, b) => parseInt(a) - parseInt(b)).map(k => grouped[k]);
  }, [transactions, period]);

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 italic text-[10px] font-black uppercase tracking-widest">
        Not enough data for trends
      </div>
    );
  }

  return (
    <div className="w-full h-56 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
            dy={10}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ 
              borderRadius: '16px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              padding: '12px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              color: '#fff'
            }}
            formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, '']}
          />
          <Bar dataKey="income" fill="#10b981" radius={[4, 4, 4, 4]} maxBarSize={40} />
          <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 4, 4]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
