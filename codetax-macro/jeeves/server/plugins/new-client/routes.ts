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
  setDropboxFolderPath,
} from './storage';
import { notifyNewClient } from './slack';
import {
  syncToAirtable,
  updateAirtableChecklist,
  pullFromAirtable,
  fetchViewList,
  fetchAirtableRecord,
  fetchRepRrn,
  isAirtableId,
  updateAirtableAuxFields,
} from './airtable';
import { missingRequired } from './contract';
import { BUNDLE_GROUPS, sanitizeFilename, assembleBundle } from './pdf/bundles';
import { registerPreviewRoutes } from './pdf/preview-routes';

/**
 * RFC 5987 기반 Content-Disposition. 한글 포함 파일명을 안전하게 전달.
 * 브라우저는 filename* 우선, 오래된 클라이언트는 filename(ASCII fallback) 사용.
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
import {
  createClientFolders,
  extractCreds,
  findClientFolder,
  findBusinessLicenseFile,
  downloadFile as dropboxDownloadFile,
  getFolderStatus,
  resolveParentPath,
} from './dropbox';
import { ocrImage, parseBizAddress } from './ocr';
import { extractWehagoCreds, registerWehagoClient } from './wehago';
import type { ChecklistItemKey } from './checklist-config';
import type { NewClientRecord } from './types';

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
    let dropboxFolderCreated = false;
    let dropboxFolderPathOut: string | undefined;
    const dropboxCreds = extractCreds(cfg);
    const now = () => new Date().toISOString();
    if (!dropboxCreds) {
      ctx.logError('[new-client] dropbox env missing, skipping folder creation');
      await mergeChecklist(cfg.dataFile, record.id, {
        dropboxFolder: { status: 'error', note: 'DROPBOX_* env 미설정', updatedAt: now() },
      });
    } else {
      try {
        const out = await createClientFolders(
          validated.value.entityType,
          record.businessScope,
          record.companyName,
          dropboxCreds,
        );
        await setDropboxFolderPath(cfg.dataFile, record.id, out.path);
        await mergeChecklist(cfg.dataFile, record.id, {
          dropboxFolder: { status: 'done', updatedAt: now() },
        });
        dropboxFolderCreated = true;
        dropboxFolderPathOut = out.path;
        ctx.log(`[new-client] dropbox folder created: ${out.path}`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        ctx.logError(`[new-client] dropbox folder creation failed: ${msg}`);
        await mergeChecklist(cfg.dataFile, record.id, {
          dropboxFolder: { status: 'error', note: msg.slice(0, 500), updatedAt: now() },
        });
      }
    }

    return res.json({
      ok: true,
      id: record.id,
      slackNotified,
      airtableSynced,
      dropboxFolderCreated,
      dropboxFolderPath: dropboxFolderPathOut,
    });
  });

  // List — passthrough from Airtable view (configured via AIRTABLE_NEW_CLIENT_VIEW).
  app.get('/api/new-client/list', async (_req, res) => {
    const cfg = loadConfig();
    const list = await fetchViewList(cfg, ctx.logError);
    if (list === null) {
      return res.status(500).json({ error: 'airtable fetch failed' });
    }
    res.json(list);
  });

  // Detail — for Airtable ids (rec...), fetch from Airtable. For local UUIDs,
  // use local storage with Airtable pull for checklist freshness.
  app.get('/api/new-client/:id', async (req, res) => {
    const cfg = loadConfig();
    try {
      if (isAirtableId(req.params.id)) {
        const record = await fetchAirtableRecord(req.params.id, cfg, ctx.logError);
        if (!record) return res.status(404).json({ error: 'not found' });
        return res.json(record);
      }
      let record = await readOne(cfg.dataFile, req.params.id);
      if (!record) return res.status(404).json({ error: 'not found' });

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
    const now = new Date().toISOString();
    try {
      if (isAirtableId(req.params.id)) {
        // Airtable-only record: go direct to reverse-sync, no local storage.
        const newState = {
          updatedAt: now,
          ...(validation.payload.status !== undefined && { status: validation.payload.status }),
          ...(validation.payload.value !== undefined && { value: validation.payload.value }),
          ...(validation.payload.note !== undefined && { note: validation.payload.note }),
        };
        const ok = await updateAirtableChecklist(
          req.params.id,
          req.params.itemKey as ChecklistItemKey,
          newState,
          cfg,
          ctx.logError,
        );
        if (!ok) return res.status(500).json({ error: 'airtable update failed' });
        ctx.log(`[new-client] checklist updated (airtable): id=${req.params.id} item=${req.params.itemKey}`);
        return res.json({ ok: true, itemKey: req.params.itemKey, state: newState });
      }

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

  // Resolve a record from either local storage or Airtable for dropbox endpoints.
  async function resolveRecord(id: string): Promise<NewClientRecord | null> {
    const cfg = loadConfig();
    if (isAirtableId(id)) {
      return fetchAirtableRecord(id, cfg, ctx.logError);
    }
    return readOne(cfg.dataFile, id);
  }

  app.get('/api/new-client/:id/dropbox-status', async (req, res) => {
    const cfg = loadConfig();
    try {
      const record = await resolveRecord(req.params.id);
      if (!record) return res.status(404).json({ error: 'not found' });

      const creds = extractCreds(cfg);
      if (!creds) return res.status(500).json({ error: 'dropbox env missing' });

      // Prefer tracked path when available (local records). Otherwise derive
      // via parent listing + name match (Airtable records).
      let path = record.dropboxFolderPath ?? null;
      if (!path && record.entityType) {
        const parent = resolveParentPath(record.entityType, record.businessScope);
        path = await findClientFolder(parent, record.companyName, creds);
      }

      if (!path) {
        return res.json({ path: null, exists: false, files: [] });
      }
      const status = await getFolderStatus(path, creds);
      res.json({ path, exists: status.exists, files: status.baseFiles });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      ctx.logError(`[new-client] dropbox status failed: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/new-client/:id/wehago/register', async (req, res) => {
    const cfg = loadConfig();
    const now = () => new Date().toISOString();
    try {
      const base = await resolveRecord(req.params.id);
      if (!base) return res.status(404).json({ error: 'not found' });

      const creds = extractWehagoCreds(cfg);
      if (!creds) return res.status(500).json({ error: 'WEHAGO_USERNAME/PASSWORD 미설정' });

      // 프론트에서 수동 입력한 개업연월일이 있으면 override (Airtable 개업일 우선순위보다 높음).
      const bodyOpenDate = typeof req.body?.openDate === 'string' ? req.body.openDate.trim() : '';
      if (bodyOpenDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(bodyOpenDate)) {
        return res.status(400).json({ error: 'invalid openDate (expected YYYY-MM-DD)' });
      }
      const record = bodyOpenDate !== '' ? { ...base, openDate: bodyOpenDate } : base;
      ctx.log(`[new-client] wehago register: id=${req.params.id} openDate=${record.openDate ?? '(none)'} (body=${bodyOpenDate || '-'}, base=${base.openDate ?? '-'})`);

      // 대표자 주민번호는 민감정보 — NewClientRecord 에 싣지 않고 여기서만 별도
      // fetch. 값은 registerWehagoClient 내부에서 WEHAGO 입력에만 사용되고,
      // 클라이언트로 전달되는 응답에는 포함되지 않는다.
      const airtableId = isAirtableId(req.params.id)
        ? req.params.id
        : base.airtableRecordId ?? null;
      const repRrn = airtableId ? await fetchRepRrn(airtableId, cfg, ctx.logError, ctx.log) : null;

      const out = await registerWehagoClient(record, creds, ctx.log, { repRrn });

      // Mark checklist done. For local records, persist; for Airtable records,
      // reverse-sync the 위하고 checkbox via existing mapping.
      const newState = { status: 'done', updatedAt: now() };
      if (isAirtableId(req.params.id)) {
        const ok = await updateAirtableChecklist(
          req.params.id,
          'wehago',
          newState,
          cfg,
          ctx.logError,
        );
        if (!ok) ctx.logError(`[new-client] wehago airtable sync failed for ${req.params.id}`);
      } else {
        await mergeChecklist(cfg.dataFile, req.params.id, { wehago: newState });
        const rec = await readOne(cfg.dataFile, req.params.id);
        if (rec?.airtableRecordId) {
          await updateAirtableChecklist(rec.airtableRecordId, 'wehago', newState, cfg, ctx.logError);
        }
      }

      ctx.log(`[new-client] wehago registered: ${out.companyName}`);
      res.json({ ok: true, companyName: out.companyName, state: newState });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      ctx.logError(`[new-client] wehago register failed: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/new-client/:id/dropbox-folder/retry', async (req, res) => {
    const cfg = loadConfig();
    const now = () => new Date().toISOString();
    const id = req.params.id;
    const isAirtable = isAirtableId(id);
    try {
      const record = await resolveRecord(id);
      if (!record) return res.status(404).json({ error: 'not found' });
      if (!record.entityType) {
        if (!isAirtable) {
          await mergeChecklist(cfg.dataFile, id, {
            dropboxFolder: { status: 'error', note: '기존 레코드 — entityType 없음, 재등록 필요', updatedAt: now() },
          });
        }
        return res.status(400).json({ error: 'record has no entityType (legacy record)' });
      }
      const creds = extractCreds(cfg);
      if (!creds) {
        if (!isAirtable) {
          await mergeChecklist(cfg.dataFile, id, {
            dropboxFolder: { status: 'error', note: 'DROPBOX_* env 미설정', updatedAt: now() },
          });
        }
        return res.status(500).json({ error: 'dropbox env missing' });
      }
      const out = await createClientFolders(
        record.entityType,
        record.businessScope,
        record.companyName,
        creds,
      );
      if (!isAirtable) {
        await setDropboxFolderPath(cfg.dataFile, id, out.path);
        await mergeChecklist(cfg.dataFile, id, {
          dropboxFolder: { status: 'done', updatedAt: now() },
        });
      }
      const newState = { status: 'done', updatedAt: now() };
      ctx.log(`[new-client] dropbox retry ok: id=${id} path=${out.path}`);
      res.json({ ok: true, path: out.path, state: newState });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      ctx.logError(`[new-client] dropbox retry failed: ${msg}`);
      if (!isAirtable) {
        await mergeChecklist(cfg.dataFile, id, {
          dropboxFolder: { status: 'error', note: msg.slice(0, 500), updatedAt: now() },
        });
      }
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/new-client/:id/aux', async (req, res) => {
    const id = req.params.id;
    if (!isAirtableId(id)) {
      return res.status(400).json({ error: 'invalid airtable id' });
    }
    const body = req.body ?? {};
    const patch: { openDate?: string; bankName?: string; accountNumber?: string; bizAddress?: string } = {};
    if (typeof body.openDate === 'string') patch.openDate = body.openDate;
    if (typeof body.bankName === 'string') patch.bankName = body.bankName;
    if (typeof body.accountNumber === 'string') patch.accountNumber = body.accountNumber;
    if (typeof body.bizAddress === 'string') patch.bizAddress = body.bizAddress;

    const cfg = loadConfig();
    const ok = await updateAirtableAuxFields(id, patch, cfg, ctx.logError);
    if (!ok) return res.status(502).json({ error: 'airtable update failed' });

    const record = await fetchAirtableRecord(id, cfg, ctx.logError);
    if (!record) return res.status(500).json({ error: 'fetch after update failed' });
    return res.json({ record });
  });

  app.post('/api/new-client/:id/ocr-bizaddress', async (req, res) => {
    const id = req.params.id;
    if (!isAirtableId(id)) return res.status(400).json({ error: 'invalid airtable id' });

    const cfg = loadConfig();
    const record = await fetchAirtableRecord(id, cfg, ctx.logError);
    if (!record) return res.status(404).json({ error: 'record not found' });

    const creds = extractCreds(cfg);
    if (!creds) return res.status(500).json({ error: 'dropbox env missing' });

    try {
      if (!record.entityType) {
        return res.status(400).json({ error: 'entityType 미설정 거래처' });
      }
      const parentPath = resolveParentPath(record.entityType, record.businessScope);
      const clientFolder = await findClientFolder(parentPath, record.companyName, creds);
      if (!clientFolder) {
        return res.status(404).json({ error: '드롭박스에서 거래처 폴더를 찾지 못했습니다.' });
      }
      const file = await findBusinessLicenseFile(clientFolder, creds);
      if (!file) {
        return res.status(404).json({ error: '사업자등록증 파일을 찾지 못했습니다.' });
      }
      const buf = await dropboxDownloadFile(file.path, creds);
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const text = await ocrImage(buf, ext);
      const address = parseBizAddress(text);
      if (!address) {
        const preview = text.slice(0, 600).replace(/\n/g, '⏎');
        ctx.logError(`[new-client] ocr-bizaddress parse fail. file=${file.name} text(처음 600자):\n${text.slice(0, 2000)}`);
        return res.status(422).json({
          error: '주소 추출 실패 — OCR 텍스트에서 사업장 소재지 라인을 인식하지 못했습니다.',
          file: file.name,
          ocrPreview: preview,
        });
      }

      // Airtable이 비어있으면 write-back
      let wrote = false;
      if (!record.bizAddress || record.bizAddress.trim() === '') {
        wrote = await updateAirtableAuxFields(id, { bizAddress: address }, cfg, ctx.logError);
      }
      const refreshed = await fetchAirtableRecord(id, cfg, ctx.logError);
      return res.json({ address, file: file.name, wrote, record: refreshed });
    } catch (err: any) {
      ctx.logError(`[new-client] ocr-bizaddress failed: ${err.message || err}`);
      const msg = /spawn failed|ENOENT/i.test(err.message ?? '')
        ? 'tesseract 미설치 — brew install tesseract tesseract-lang'
        : err.message || String(err);
      return res.status(500).json({ error: msg });
    }
  });

  app.get('/api/new-client/:id/contract-download', async (req, res) => {
    const id = req.params.id;
    if (!isAirtableId(id)) return res.status(400).json({ error: 'invalid airtable id' });
    const groupId = typeof req.query.group === 'string' ? req.query.group : '';
    const group = BUNDLE_GROUPS.find((g) => g.id === groupId);
    if (!group) return res.status(400).json({ error: `invalid group: ${groupId}` });

    const cfg = loadConfig();
    const record = await fetchAirtableRecord(id, cfg, ctx.logError);
    if (!record) return res.status(404).json({ error: 'record not found' });
    const rrn = await fetchRepRrn(id, cfg, ctx.logError, ctx.log);

    const missing = missingRequired(record, rrn);
    if (missing.length > 0) return res.status(400).json({ missing });

    const companyTag = sanitizeFilename(record.companyName || 'client');
    const baseName = `${companyTag}_${group.filename}`;

    try {
      const pdf = await assembleBundle(group, record, rrn);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', contentDisposition(`${baseName}.pdf`));
      return res.send(pdf);
    } catch (err: any) {
      ctx.logError(`[new-client] contract-download pdf failed: ${err.message || err}`);
      const raw = String(err.message ?? err);
      return res.status(500).json({ error: 'PDF 생성 실패 — ' + raw.slice(0, 200) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    registerPreviewRoutes(app, ctx, loadConfig);
  }
}
