import { fetchEvidenceGuidelines } from "../lib/research.js";

export default async function handler(req, res) {
  try {
    const topic = req.query?.topic || "";
    const maxResults = req.query?.max_results
      ? parseInt(req.query.max_results, 10)
      : 10;

    if (!topic) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "topic parameter is required" }));
      return;
    }

    const data = await fetchEvidenceGuidelines(topic, maxResults);
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (err) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message }));
  }
}
