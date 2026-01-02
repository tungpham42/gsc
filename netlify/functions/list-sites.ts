// netlify/functions/list-sites.ts
import { Handler } from "@netlify/functions";
import { google } from "googleapis";

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { accessToken } = JSON.parse(event.body || "{}");

    if (!accessToken) {
      return { statusCode: 400, body: "Missing accessToken" };
    }

    // 1. Setup Auth
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const searchconsole = google.searchconsole({ version: "v1", auth });

    // 2. Gọi API lấy danh sách sites
    const res = await searchconsole.sites.list();
    const sites = res.data.siteEntry || [];

    // Lọc bớt dữ liệu rác nếu cần, chỉ trả về URL và quyền hạn
    return {
      statusCode: 200,
      body: JSON.stringify(sites),
    };
  } catch (error: any) {
    console.error("Error listing sites:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

export { handler };
