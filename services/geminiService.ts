
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from "../types";

// Safely retrieve the API key prevents crashes in environments where process is undefined
const getApiKey = () => {
  try {
    return process.env.API_KEY;
  } catch (error) {
    return undefined;
  }
};

const API_KEY = getApiKey();

export const getFinancialInsights = async (transactions: Transaction[], monthName: string) => {
  if (transactions.length === 0) return "Add some transactions to see smart insights!";

  // Gracefully handle missing API key
  if (!API_KEY) {
    return "Connect an API Key in settings to enable smart financial insights.";
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const summary = transactions.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const prompt = `
    Based on the following financial summary for ${monthName}:
    Total Income: $${summary.income}
    Total Expenses: $${summary.expense}
    Transaction Details: ${JSON.stringify(transactions.slice(0, 10).map(t => ({ cat: t.category, amt: t.amount, type: t.type })))}

    Provide a concise, premium-style financial insight (max 2 sentences). 
    Focus on savings potential or spending trends. Be encouraging but professional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Keep tracking to optimize your wealth.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return "Your financial journey is looking solid. Keep it up!";
  }
};

export const parseNaturalLanguageTransaction = async (text: string, categories: {income: string[], expense: string[]}) => {
  // Gracefully handle missing API key
  if (!API_KEY) {
    console.warn("Magic Entry requires an API Key.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    Extract transaction details from this text: "${text}"
    Available Income Categories: ${categories.income.join(', ')}
    Available Expense Categories: ${categories.expense.join(', ')}
    
    If the category doesn't perfectly match, pick the closest one from the list.
    If it's clearly income (received, salary, bonus), set type to 'income'. Otherwise 'expense'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING, description: "'income' or 'expense'" },
            category: { type: Type.STRING },
            note: { type: Type.STRING },
          },
          required: ["amount", "type", "category"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Parsing Error:", error);
    return null;
  }
};
