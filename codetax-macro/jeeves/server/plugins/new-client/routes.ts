import type { Express } from 'express';
import type { ServerContext } from '../types';
import { loadConfig } from './config';
import { validateInput, validateChecklistUpdate } from './validate';
import {
  readAll,
  readOne,
  append,
  updateChecklistItem,
  setAirtableRecordId,
  mergeChecklist,
} from './storage';
import { notifyNewClient } from './slack';
import { syncToAirtable, updateAirtableChecklist, pullFromAirtable } from './airtable';
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
    const airtableRecordId = await syncToAirtable(record, cfg, ctx.logError);
    const airtableSynced = airtableRecordId !== null;
    if (airtableRecordId) {
      try {
        await setAirtableRecordId(cfg.dataFile, record.id, airtableRecordId);
      } catch (err: any) {
        ctx.logError(`[new-client] failed to persist airtableRecordId: ${err.message || err}`);
      }
    }
    return res.json({ ok: true, id: record.id, slackNotified, airtableSynced });
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
      let record = await readOne(cfg.dataFile, req.params.id);
      if (!record) return res.status(404).json({ error: 'not found' });

      // Airtable 에 연결된 레코드면 현재 값을 당겨와서 checklist 에 반영한다.
      // Airtable 실패 시 조용히 로컬 상태만 반환 (네트워크 이슈 등에 그레이스풀).
      if (record.airtableRecordId) {
        const patch = await pullFromAirtable(
          record.airtableRecordId,
          record.checklist,
          cfg,
          ctx.logError,
        );
        if (patch && Object.keys(patch).length > 0) {
          const merged = await mergeChecklist(cfg.dataFile, record.id, patch);
          if (merged) {
            record = merged;
            ctx.log(
              `[new-client] pulled from airtable: id=${record.id} items=${Object.keys(patch).join(',')}`,
            );
          }
        }
      }

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

      // Reverse sync to Airtable if this item has a mapping and the record was
      // originally synced. Non-blocking: failures are logged but don't affect
      // the PATCH response.
      const record = await readOne(cfg.dataFile, req.params.id);
      if (record?.airtableRecordId) {
        await updateAirtableChecklist(
          record.airtableRecordId,
          req.params.itemKey as ChecklistItemKey,
          updated,
          cfg,
          ctx.logError,
        );
      }

      res.json({ ok: true, itemKey: req.params.itemKey, state: updated });
    } catch (err: any) {
      ctx.logError(`[new-client] checklist update failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to update checklist' });
    }
  });
}
