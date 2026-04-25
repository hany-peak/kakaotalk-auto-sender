import type { Express } from 'express';
import type { ServerContext } from '../types';
import { buildPreview, sendSelected } from './pipeline';

let stopFlag = false;

export function registerPaymentReminderRoutes(app: Express, ctx: ServerContext): void {
  app.get('/api/payment-reminder/preview', async (_req, res) => {
    try {
      const result = await buildPreview();
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logError(`[payment-reminder] preview failed: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/payment-reminder/send', async (req, res) => {
    const recordIds: string[] = Array.isArray(req.body?.recordIds) ? req.body.recordIds : [];
    if (recordIds.length === 0) {
      res.status(400).json({ error: 'recordIds required' });
      return;
    }
    stopFlag = false;
    try {
      const result = await sendSelected({
        recordIds,
        isStopped: () => stopFlag,
        log: (m) => ctx.log(`[payment-reminder] ${m}`),
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logError(`[payment-reminder] send failed: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/payment-reminder/stop', (_req, res) => {
    stopFlag = true;
    res.json({ stopped: true });
  });
}
