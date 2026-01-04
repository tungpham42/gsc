import { Handler } from "@netlify/functions";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Define the priority list of models
const AVAILABLE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
];

/**
 * Recursive function to attempt chat completion with fallback models.
 * It switches models only on 429 (Rate Limit) or >= 500 (Server Errors).
 */
async function attemptChatCompletion(
  messages: any[],
  modelIndex: number = 0
): Promise<string> {
  const currentModel = AVAILABLE_MODELS[modelIndex];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: currentModel,
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    return chatCompletion.choices[0].message.content || "{}";
  } catch (error: any) {
    const status = error.status || error.statusCode; // Handle various error shapes
    const isRetryable = status === 429 || (status >= 500 && status < 600);
    const hasNextModel = modelIndex < AVAILABLE_MODELS.length - 1;

    if (isRetryable && hasNextModel) {
      console.warn(
        `[Groq] Model ${currentModel} failed with status ${status}. Switching to ${
          AVAILABLE_MODELS[modelIndex + 1]
        }...`
      );
      // Recursive call with the next model index
      return attemptChatCompletion(messages, modelIndex + 1);
    }

    // If error is not retryable (e.g. 400 Bad Request) or no models left, throw it.
    throw error;
  }
}

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

    // Start the recursive attempt process
    const result = await attemptChatCompletion([
      { role: "user", content: prompt },
    ]);

    return {
      statusCode: 200,
      body: result,
    };
  } catch (error: any) {
    console.error("Groq Analysis Error (All models failed):", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
