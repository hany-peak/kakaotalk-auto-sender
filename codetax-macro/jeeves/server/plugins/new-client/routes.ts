import type { Express } from 'express';
import type { ServerContext } from '../types';
import { loadConfig } from './config';
import { validateInput, validateChecklistUpdate } from './validate';
import {
  readAll,
  readOne,
  append,
  updateChecklistItem,
} from './storage';
import { notifyNewClient } from './slack';
import {
  computeProgress,
  latestChecklistUpdate,
  type ChecklistItemKey,
} from './checklist-config';

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
    const slackNotified = await notifyNewClient(record, cfg, ctx.logError);
    return res.json({ ok: true, id: record.id, slackNotified });
  });

  app.get('/api/new-client/list', async (_req, res) => {
    const cfg = loadConfig();
    try {
      const records = await readAll(cfg.dataFile);
      const list = records.map((r) => ({
        id: r.id,
        companyName: r.companyName,
        representative: r.representative,
        industry: r.industry,
        startDate: r.startDate,
        createdAt: r.createdAt,
        progress: computeProgress(r.checklist),
        checklistUpdatedAt: latestChecklistUpdate(r.checklist),
      }));
      res.json(list);
    } catch (err: any) {
      ctx.logError(`[new-client] list failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to read records' });
    }
  });

  app.get('/api/new-client/:id', async (req, res) => {
    const cfg = loadConfig();
    try {
      const record = await readOne(cfg.dataFile, req.params.id);
      if (!record) return res.status(404).json({ error: 'not found' });
      res.json(record);
    } catch (err: any) {
      ctx.logError(`[new-client] read failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to read record' });
    }
  });

  app.patch('/api/new-client/:id/checklist/:itemKey', async (req, res) => {
    const validation = validateChecklistUpdate(req.params.itemKey, req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const cfg = loadConfig();
    try {
      const updated = await updateChecklistItem(
        cfg.dataFile,
        req.params.id,
        req.params.itemKey as ChecklistItemKey,
        validation.payload,
        validation.def.kind,
      );
      if (!updated) return res.status(404).json({ error: 'not found' });
      ctx.log(
        `[new-client] checklist updated: id=${req.params.id} item=${req.params.itemKey} ` +
          (validation.def.kind === 'value'
            ? `value=${updated.value ?? ''}`
            : `status=${updated.status ?? ''}`),
      );
      res.json({ ok: true, itemKey: req.params.itemKey, state: updated });
    } catch (err: any) {
      ctx.logError(`[new-client] checklist update failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to update checklist' });
    }
  });
}
