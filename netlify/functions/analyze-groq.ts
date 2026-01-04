import { Handler } from "@netlify/functions";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const handler: Handler = async (event) => {
  try {
    const { gscData } = JSON.parse(event.body || "{}");

    const prompt = `
      Analyze the following Google Search Console data (Top Queries):
      ${JSON.stringify(gscData)}
      
      Provide 3 brief, actionable SEO insights to improve click-through rates.
      Format as a JSON object with a key "insights" containing an array of strings.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
    });

    return {
      statusCode: 200,
      // FIX: Use '|| ""' to ensure body is a string, never null
      body: chatCompletion.choices[0].message.content || "",
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
