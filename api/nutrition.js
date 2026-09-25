import { searchFoodNutrition } from "../lib/nutrition.js";

export default async function handler(req, res) {
  try {
    const query = req.query?.query || "";
    const brand = req.query?.brand_filter || undefined;

    if (!query) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "query parameter is required" }));
      return;
    }

    const data = await searchFoodNutrition(query, brand);
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (err) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message }));
  }
}
