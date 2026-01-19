
import React, { useState } from 'react';
import { 
  Sparkles, 
  Wallet, 
  PieChart, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Currency } from '../types';
import { CURRENCIES } from '../constants';

interface OnboardingFlowProps {
  onComplete: () => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ 
  onComplete, 
  currency, 
  setCurrency, 
  onOpenAuth 
}) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Master Your Wealth",
      desc: "Experience the ultimate clarity in financial tracking. Elegant, simple, and powerful.",
      icon: <Wallet size={48} className="text-white" />,
      color: "bg-indigo-600"
    },
    {
      title: "Magic AI Entry",
      desc: "Just type 'Lunch 20' and let our AI categorize and log it instantly. No more manual forms.",
      icon: <Sparkles size={48} className="text-white" />,
      color: "bg-emerald-500"
    },
    {
      title: "Crystal Clear Insights",
      desc: "Visualize your cash flow with stunning, interactive charts designed for decision makers.",
      icon: <PieChart size={48} className="text-white" />,
      color: "bg-rose-500"
    },
    {
      title: "Select Currency",
      desc: "Choose your primary currency for all transactions and global tracking.",
      icon: <span className="text-4xl">💱</span>,
      color: "bg-slate-900"
    },
    {
      title: "Secure Your Ledger",
      desc: "Sync across devices and keep your data safe. Or continue as a guest.",
      icon: <ShieldCheck size={48} className="text-white" />,
      color: "bg-indigo-600"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    // If skipping, go to currency selection if not done, else last step
    if (step < 3) setStep(3);
    else if (step === 3) setStep(4);
    else onComplete();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-between p-6 relative overflow-hidden transition-colors duration-500">
      
      {/* Skip Button */}
      <div className="w-full flex justify-end z-20 pt-4 px-2">
         {step < 4 && (
           <button onClick={handleSkip} className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-indigo-500 transition-colors">
             Skip
           </button>
         )}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm space-y-8 z-10">
         
         {/* Icon/Image */}
         <div key={`icon-${step}`} className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-4 transition-all duration-500 transform ${steps[step].color} ${step % 2 === 0 ? 'rotate-3' : '-rotate-3'}`}>
            {steps[step].icon}
         </div>

         {/* Text */}
         <div key={`text-${step}`} className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {steps[step].title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed px-4">
              {steps[step].desc}
            </p>
         </div>

         {/* Step 3: Currency Selector Special Render */}
         {step === 3 && (
            <div className="grid grid-cols-3 gap-3 w-full animate-in fade-in zoom-in duration-300">
               {CURRENCIES.map(curr => (
                  <button 
                    key={curr.code} 
                    onClick={() => setCurrency(curr)} 
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center ${currency.code === curr.code ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'}`}
                  >
                    <span className="text-xl font-black">{curr.symbol}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest">{curr.code}</span>
                  </button>
               ))}
            </div>
         )}

         {/* Step 4: Auth Special Render */}
         {step === 4 && (
            <div className="w-full space-y-3 animate-in fade-in zoom-in duration-300 pt-4">
               <button onClick={() => onOpenAuth('signup')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                 Create Free Account
               </button>
               <button onClick={() => onOpenAuth('signin')} className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
                 Log In
               </button>
               <button onClick={onComplete} className="w-full py-2 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                 Continue as Guest
               </button>
            </div>
         )}
      </div>

      {/* Footer Nav */}
      <div className="w-full max-w-sm z-20 pb-8">
         {/* Progress Bar */}
         <div className="flex space-x-2 justify-center mb-8">
            {steps.map((_, i) => (
               <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200 dark:bg-slate-800'}`} />
            ))}
         </div>

         {/* Next Button (Hide on last step as it has custom buttons) */}
         {step < 4 && (
           <button onClick={handleNext} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center space-x-2">
             <span>{step === 3 ? 'Confirm Currency' : 'Continue'}</span>
             <ChevronRight size={20} />
           </button>
         )}
      </div>
    </div>
  );
};
