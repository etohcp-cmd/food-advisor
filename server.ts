import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import handler from './api/mcp.js';
import askHandler from './api/ask.js';
import { searchFoodNutrition } from './lib/nutrition.js';
import { getUserActivityData } from './lib/activity.js';
import { fetchEvidenceGuidelines } from './lib/research.js';

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Register MCP server endpoints as specified
  app.post('/api/mcp', handler);
  app.get('/api/mcp', handler);

  // Register Gemini MCP Agent endpoint as specified
  app.post('/api/ask', askHandler);

  // App data routes using shared lib functions
  app.get('/api/nutrition', async (req: Request, res: Response) => {
    try {
      const query = String(req.query.query || '');
      const brand = req.query.brand_filter ? String(req.query.brand_filter) : undefined;
      if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }
      const data = await searchFoodNutrition(query, brand);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get('/api/activity', async (req: Request, res: Response) => {
    try {
      const userId = String(req.query.user_id || '');
      const dateRange = String(req.query.date_range || '7d');
      const metric = req.query.metric ? String(req.query.metric) : undefined;
      if (!userId) {
        res.status(400).json({ error: 'user_id parameter is required' });
        return;
      }
      const data = await getUserActivityData(userId, dateRange, metric);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get('/api/research', async (req: Request, res: Response) => {
    try {
      const topic = String(req.query.topic || '');
      const maxResults = req.query.max_results ? parseInt(String(req.query.max_results), 10) : 10;
      if (!topic) {
        res.status(400).json({ error: 'topic parameter is required' });
        return;
      }
      const data = await fetchEvidenceGuidelines(topic, maxResults);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  // Vite dev server middlewares or static files for preview/production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
