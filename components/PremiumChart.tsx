
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Transaction } from '../types';

interface PremiumChartProps {
  transactions: Transaction[];
  type: 'income' | 'expense';
  currencySymbol: string;
}

export const PremiumChart: React.FC<PremiumChartProps> = ({ transactions, type, currencySymbol }) => {
  const filtered = transactions.filter(t => t.type === type);
  
  const dataMap = filtered.reduce((acc: any, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const data = Object.keys(dataMap).map(name => ({
    name,
    value: dataMap[name]
  }));

  const COLORS = type === 'income' 
    ? ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0'] 
    : ['#f43f5e', '#e11d48', '#fb7185', '#fda4af', '#fecdd3'];

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 italic text-[10px] font-black uppercase tracking-widest">
        No {type} data found
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={4}
            dataKey="value"
            animationBegin={0}
            animationDuration={1200}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            contentStyle={{ 
              borderRadius: '16px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              color: '#fff'
            }}
            itemStyle={{ color: '#fff' }}
            separator=": "
            formatter={(value: number, name: string) => [
              `${currencySymbol} ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
              name
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
