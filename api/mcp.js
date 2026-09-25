import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { searchFoodNutrition } from "../lib/nutrition.js";
import { getUserActivityData } from "../lib/activity.js";
import { fetchEvidenceGuidelines } from "../lib/research.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    if (typeof res.status === "function") {
      res.status(405);
    } else {
      res.statusCode = 405;
    }
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed"
        },
        id: null
      })
    );
    return;
  }

  // Ensure accept header includes text/event-stream for Streamable HTTP transport compliance
  if (!req.headers.accept || !req.headers.accept.includes("text/event-stream")) {
    req.headers.accept = req.headers.accept
      ? `${req.headers.accept}, application/json, text/event-stream`
      : "application/json, text/event-stream";
  }

  const server = new McpServer({ name: "g8-server", version: "1.0.0" });

  server.registerTool(
    "g8_search_food_nutrition",
    {
      description:
        "Returns up to 20 food items containing detailed macronutrients, calories, micronutrients, serving sizes, and product metadata. Data is read directly from upstream nutritional registries including OpenFoodFacts and USDA FoodData Central. Use this tool when evaluating ingredients, calculating meal nutritional profiles, or verifying specific branded product nutrient facts. It does not provide individual daily calorie burn estimates or user physiological expenditure.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Natural language food search query, ingredient name, or product barcode (e.g. 'rolled oats' or 'greek yogurt')."
          ),
        brand_filter: z
          .string()
          .optional()
          .describe(
            "Optional brand name or manufacturer to filter food products (e.g. 'Chobani' or 'Quaker')."
          )
      },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ query, brand_filter }) => {
      try {
        const result = await searchFoodNutrition(query, brand_filter);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to search food nutrition from OpenFoodFacts: ${err.message}.`
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    "g8_get_user_activity_data",
    {
      description:
        "Returns historical exercise metrics, workout sessions, step counts, and active calorie expenditure records up to 20 entries. Data is retrieved from connected fitness platform providers such as Pace, Garmin, and Strava. Use this tool to analyze a user's recent energy expenditure, workout intensity, and baseline activity levels for calorie balancing. It does not generate dietary meal plans or evaluate nutrient composition of meals.",
      inputSchema: {
        user_id: z
          .string()
          .describe(
            "Unique user identifier registered with the fitness provider (e.g. 'usr_102' or 'pace_user_1')."
          ),
        date_range: z
          .string()
          .describe(
            "Date or date interval for activity retrieval, specified as an ISO date, range 'YYYY-MM-DD/YYYY-MM-DD', or relative period like '7d'."
          ),
        metric: z
          .string()
          .optional()
          .describe(
            "Specific fitness metric filter, such as 'calories', 'steps', 'heart_rate', 'workouts', or 'all'."
          )
      },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ user_id, date_range, metric }) => {
      try {
        const result = await getUserActivityData(user_id, date_range, metric);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to retrieve user activity data from Pace fitness provider: ${err.message}.`
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    "g8_fetch_evidence_guidelines",
    {
      description:
        "Returns up to 20 peer-reviewed medical publications, clinical nutrition guidelines, and dietary research summaries. Data is read directly from upstream biomedical literature indexes at NCBI PubMed and Healthcare Data Hub. Use this tool to find evidence-based clinical recommendations for specific health conditions, dietary patterns, or nutrient interactions. It does not retrieve real-time user biometric logs or commercial grocery product inventories.",
      inputSchema: {
        topic: z
          .string()
          .describe(
            "Medical or nutritional science topic to search, such as 'mediterranean diet cardiovascular' or 'protein intake sarcopenia'."
          ),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe(
            "Maximum number of publication records to retrieve, between 1 and 20 (defaults to 10)."
          )
      },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ topic, max_results }) => {
      try {
        const result = await fetchEvidenceGuidelines(topic, max_results);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to fetch evidence guidelines from NCBI PubMed: ${err.message}.`
            }
          ]
        };
      }
    }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
