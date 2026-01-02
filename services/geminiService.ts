
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getFinancialInsights = async (transactions: Transaction[], monthName: string) => {
  if (transactions.length === 0) return "Add some transactions to see smart insights!";

  // Create a new instance right before use to ensure it uses the latest process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const summary = transactions.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const prompt = `
    Based on the following financial summary for ${monthName}:
    Total Income: $${summary.income}
    Total Expenses: $${summary.expense}
    Transaction Details: ${JSON.stringify(transactions.map(t => ({ cat: t.category, amt: t.amount, type: t.type })))}

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
    // If key is missing or invalid, we handle it gracefully in the UI
    console.error("Gemini Error:", error);
    if (error?.message?.includes("entity was not found")) {
      return "AI connection needs re-authorization in settings.";
    }
    return "Your financial journey is looking solid. Keep it up!";
  }
};
