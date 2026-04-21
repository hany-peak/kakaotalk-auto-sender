import type { Express } from 'express';
import type { ServerContext } from '../types';
import { loadConfig } from './config';
import { validateInput } from './validate';
import { readAll, append } from './storage';
import { notifyNewClient } from './slack';

export function registerNewClientRoutes(app: Express, ctx: ServerContext): void {
  app.post('/api/new-client/submit', async (req, res) => {
    const validated = validateInput(req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const cfg = loadConfig();
    let record;
    try {
      record = await append(cfg.dataFile, validated.value);
    } catch (err: any) {
      ctx.logError(`[new-client] storage failed: ${err.message || err}`);
      return res.status(500).json({ error: 'failed to save submission' });
    }

    ctx.log(`[new-client] registered: ${record.companyName}`);

    const slackNotified = await notifyNewClient(record, ctx.logError);

    return res.json({ ok: true, id: record.id, slackNotified });
  });

  app.get('/api/new-client/list', async (_req, res) => {
    const cfg = loadConfig();
    try {
      const records = await readAll(cfg.dataFile);
      res.json(records);
    } catch (err: any) {
      ctx.logError(`[new-client] list failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to read records' });
    }
  });
}
