import { getUserActivityData } from "../lib/activity.js";

export default async function handler(req, res) {
  try {
    const userId = req.query?.user_id || "";
    const range = req.query?.date_range || "7d";
    const metric = req.query?.metric || undefined;

    if (!userId) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "user_id parameter is required" }));
      return;
    }

    const data = await getUserActivityData(userId, range, metric);
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (err) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message }));
  }
}
