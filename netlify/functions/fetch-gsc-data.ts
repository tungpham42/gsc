import { Handler } from "@netlify/functions";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  "postmessage"
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const {
      code,
      tokens: providedTokens,
      siteUrl,
    } = JSON.parse(event.body || "{}");
    const searchConsole = google.searchconsole({
      version: "v1",
      auth: oauth2Client,
    });

    // SCENARIO 1: Exchange Code for Token & List Sites
    if (code) {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const sitesRes = await searchConsole.sites.list();

      return {
        statusCode: 200,
        body: JSON.stringify({
          // Return tokens to frontend so we can use them for the next step (stateless)
          tokens,
          sites: sitesRes.data.siteEntry || [],
        }),
      };
    }

    // SCENARIO 2: Fetch Analytics using existing Token & Selected Site
    if (providedTokens && siteUrl) {
      oauth2Client.setCredentials(providedTokens);

      const res = await searchConsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          endDate: new Date().toISOString().split("T")[0],
          dimensions: ["query"],
          rowLimit: 10,
        },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ data: res.data.rows || [] }),
      };
    }

    return { statusCode: 400, body: "Missing code or tokens/siteUrl" };
  } catch (error: any) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
