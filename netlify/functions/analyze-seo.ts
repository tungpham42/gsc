// netlify/functions/analyze-seo.ts
import { Handler } from "@netlify/functions";
import { google } from "googleapis";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { accessToken, siteUrl, startDate, endDate } = JSON.parse(
      event.body || "{}"
    );

    if (!accessToken || !siteUrl) {
      return { statusCode: 400, body: "Missing tokens or siteUrl" };
    }

    // 1. Kết nối Google Search Console API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth });

    // 2. Lấy dữ liệu (Query top 50 keywords để tiết kiệm token cho LLM)
    const res = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate || "2023-12-01", // Logic động nên xử lý ở FE
        endDate: endDate || "2023-12-31",
        dimensions: ["query"],
        rowLimit: 50, // Lấy top 50 từ khóa
      },
    });

    const rows = res.data.rows || [];

    // Chuẩn bị dữ liệu dạng text để gửi cho AI
    const dataSummary = rows
      .map(
        (r) =>
          `- Kw: "${r.keys?.[0]}" | Clicks: ${r.clicks} | Impr: ${
            r.impressions
          } | Pos: ${r.position?.toFixed(1)}`
      )
      .join("\n");

    // 3. Gửi sang Groq để phân tích
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Bạn là một chuyên gia SEO lão luyện. Nhiệm vụ của bạn là phân tích dữ liệu Google Search Console và đưa ra các hành động cụ thể. Trả lời bằng tiếng Việt, định dạng Markdown.",
        },
        {
          role: "user",
          content: `Phân tích dữ liệu SEO dưới đây cho website ${siteUrl}.
                    
                    Dữ liệu (Top 50 Queries):
                    ${dataSummary}
                    
                    Hãy tìm ra:
                    1. Các từ khóa có tiềm năng cao (Impressions cao nhưng Clicks thấp).
                    2. Các từ khóa đang ở trang 2 (Position 11-20) cần tối ưu để lên trang 1.
                    3. Đề xuất content plan ngắn gọn.`,
        },
      ],
      model: "llama3-70b-8192", // Model mạnh và nhanh của Groq
      temperature: 0.5,
    });

    const analysis =
      chatCompletion.choices[0]?.message?.content || "Không thể phân tích.";

    return {
      statusCode: 200,
      body: JSON.stringify({
        raw_data: rows,
        ai_analysis: analysis,
      }),
    };
  } catch (error: any) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

export { handler };
