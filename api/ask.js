import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function sendJson(res, statusCode, data) {
  res.setHeader("Content-Type", "application/json");
  if (typeof res.status === "function") {
    res.status(statusCode).json(data);
  } else {
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null
    });
  }

  // 3) Check GEMINI_API_KEY before anything else
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "") {
    return sendJson(res, 503, {
      error: "GEMINI_API_KEY is not set. Add it in Vercel and redeploy."
    });
  }

  // Check question parameter
  const body = req.body || {};
  const question = typeof body === "string" ? body : body.question;
  if (!question || typeof question !== "string" || question.trim().length === 0 || question.length > 500) {
    return sendJson(res, 400, {
      error: "Question is required, must be a string, and cannot exceed 500 characters."
    });
  }

  const cleanQuestion = question.trim();

  // 4) Split process.env.MCP_SERVERS on commas and connect
  const rawServers = (process.env.MCP_SERVERS || "https://food-advisor-alpha.vercel.app/api/mcp")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const unavailable = [];
  const connectedClients = [];
  const allCreatedClients = [];

  try {
    for (const address of rawServers) {
      let client;
      let timer;
      try {
        const url = new URL(address);
        client = new Client({ name: "g8-agent", version: "1.0.0" });
        allCreatedClients.push(client);

        const transport = new StreamableHTTPClientTransport(url);

        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Connection timed out after 8 seconds")), 8000);
        });

        await Promise.race([client.connect(transport), timeoutPromise]);
        clearTimeout(timer);
        connectedClients.push(client);
      } catch (err) {
        if (timer) clearTimeout(timer);
        unavailable.push({
          address,
          reason: err.message || "Failed to connect to MCP server"
        });
      }
    }

    // 5) Call ai.models.generateContent
    const ai = new GoogleGenAI();
    const systemInstruction =
      "answer only from tool results; give the source and the fetched_at time for every figure; if a tool returns an error or nothing, say so in one sentence and do not guess; at most 120 words.";

    const config = {
      systemInstruction,
      automaticFunctionCalling: { maximumRemoteCalls: 6 }
    };

    if (connectedClients.length > 0) {
      config.tools = [mcpToTool(...connectedClients)];
    } else {
      config.tools = [];
    }

    let response;
    let geminiError;

    // Retry loop for temporary 503 spikes
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: cleanQuestion,
          config
        });
        geminiError = null;
        break;
      } catch (err) {
        geminiError = err;
        if (attempt < 2 && (err?.status === 503 || err?.code === 503)) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    if (geminiError || !response) {
      const status = geminiError?.status || geminiError?.code || 500;
      let reason = geminiError?.message || "Gemini generateContent call failed";
      try {
        const parsed = JSON.parse(reason);
        if (parsed?.error?.message) {
          reason = parsed.error.message;
        }
      } catch {}
      const oneLineReason = String(reason).replace(/\s+/g, " ").trim();
      return sendJson(res, 502, {
        error: `Gemini failure (${status}): ${oneLineReason}`,
        status,
        reason: oneLineReason
      });
    }

    // 6) Build tool_calls from response.automaticFunctionCallingHistory
    const tool_calls = [];
    if (Array.isArray(response.automaticFunctionCallingHistory)) {
      for (let i = 0; i < response.automaticFunctionCallingHistory.length; i++) {
        const item = response.automaticFunctionCallingHistory[i];
        const parts = item?.parts || [];
        for (let p = 0; p < parts.length; p++) {
          const part = parts[p];
          if (part?.functionCall) {
            const name = part.functionCall.name;
            const args = part.functionCall.args || {};
            let failed = false;

            // Look for matching functionResponse in subsequent history entries
            for (let j = i + 1; j < response.automaticFunctionCallingHistory.length; j++) {
              const nextItem = response.automaticFunctionCallingHistory[j];
              const nextParts = nextItem?.parts || [];
              const match = nextParts.find((np) => np?.functionResponse?.name === name);
              if (match?.functionResponse?.response) {
                const respObj = match.functionResponse.response;
                if (
                  respObj.error !== undefined ||
                  respObj.isError === true ||
                  (typeof respObj === "object" && respObj !== null && "error" in respObj)
                ) {
                  failed = true;
                }
                break;
              }
            }

            tool_calls.push({
              name,
              args,
              failed
            });
          }
        }
      }
    }

    // 7) Return 200 with result payload
    return sendJson(res, 200, {
      answer: response.text || "",
      tool_calls,
      unavailable,
      model: "gemini-3.8-flash",
      answered_at: new Date().toISOString()
    });
  } catch (err) {
    const status = err?.status || err?.code || 500;
    const reason = String(err?.message || "Internal server error")
      .replace(/\s+/g, " ")
      .trim();
    return sendJson(res, 502, {
      error: `Gemini failure (${status}): ${reason}`,
      status,
      reason
    });
  } finally {
    // Close every client in finally block
    await Promise.allSettled(allCreatedClients.map((c) => c.close().catch(() => {})));
  }
}
