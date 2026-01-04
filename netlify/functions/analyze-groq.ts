import { Handler } from "@netlify/functions";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export const handler: Handler = async (event) => {
  try {
    const { gscData } = JSON.parse(event.body || "{}");

    // Enhanced Prompt Engineering
    const prompt = `
      You are an elite SEO Strategist and Data Analyst. 
      Your task is to analyze the following Google Search Console data for a specific website.
      
      **DATA INPUT (Top Queries):**
      ${JSON.stringify(gscData)}

      **ANALYSIS OBJECTIVES:**
      1. Identify "Low Hanging Fruit": Queries with high impressions but low CTR (opportunity for meta tag optimization).
      2. Spot "Striking Distance" keywords: Queries ranking in positions 4-10 that need a content boost to reach the top 3.
      3. Detect irrelevance: Queries that might be driving traffic but have poor engagement signals (if discernible).

      **OUTPUT REQUIREMENTS:**
      - Provide exactly 3 high-impact, professional insights.
      - Use direct, actionable language (e.g., "Optimize title tag for...", "Create new content targeting...").
      - Avoid generic advice like "improve content." Be specific to the data provided.
      
      **FORMAT:**
      Return strictly valid JSON with a single key "insights" containing an array of 3 strings.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      // 'llama-3.3-70b-versatile' is often better for complex reasoning than gpt-oss-120b,
      // but you can keep your preferred model if it supports JSON mode well.
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
      temperature: 0.5, // Lower temperature for more analytical/consistent results
    });

    return {
      statusCode: 200,
      body: chatCompletion.choices[0].message.content || "{}",
    };
  } catch (error: any) {
    console.error("Groq Analysis Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
