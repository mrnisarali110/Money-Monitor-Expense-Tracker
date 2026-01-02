// Ensure this matches your package.json (usually @google/generative-ai)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Transaction } from "../types";

// Vite correctly reads this from Netlify Environment Variables
const API_KEY = import.meta.env.VITE_API_KEY;

export const getFinancialInsights = async (transactions: Transaction[], monthName: string) => {
  if (transactions.length === 0) return "Add some transactions to see smart insights!";

  if (!API_KEY) {
    return "Connect an API Key in Netlify settings to enable smart financial insights.";
  }

  // Use the correct Class Name from the SDK
  const genAI = new GoogleGenerativeAI(API_KEY);
  // Change to a stable model name
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "Keep tracking to optimize your wealth.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return "Your financial journey is looking solid. Keep it up!";
  }
};
