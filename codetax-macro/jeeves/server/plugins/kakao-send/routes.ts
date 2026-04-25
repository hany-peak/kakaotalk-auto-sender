import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import type { Express } from 'express';
import type { ServerContext } from '../types';
import { withErrorHandler, MacroError } from '../../core/errors';
import { ocrVerifyImage } from '../../shared/ocr';
import { scanDateFolders, scanKakaoTargets } from './scanner';
import { runKakaoSend } from './sender';
import { BASE_DOWNLOAD_DIR } from '../vat-notice/config';

const KAKAO_LOGS_DIR = path.resolve(__dirname, '../../../logs');
const CARD_IMAGES_BASE = path.resolve(__dirname, '../../../src/images/cardImages');
const CARD_IMAGES_DIR = path.join(CARD_IMAGES_BASE, '부가가치세예정고지납부');

let kakaoRunning = false;
let kakaoStopRequested = false;

export function registerKakaoRoutes(app: Express, ctx: ServerContext): void {
  app.use('/card-images', express.static(CARD_IMAGES_BASE));

  app.get('/api/kakao/folders', (_req, res) => {
    res.json(scanDateFolders());
  });

  app.get('/api/kakao/targets', (req, res) => {
    const folder = (req.query.folder as string) || undefined;
    res.json(scanKakaoTargets(folder));
  });

  app.patch('/api/kakao/info', withErrorHandler(ctx, async (req, res) => {
    const { imagePath, fields } = req.body;
    if (!imagePath || !fields) throw new MacroError('missing parameters', 'MISSING_PARAMS');
    const infoPath = path.join(path.dirname(imagePath), 'info.json');
    if (!fs.existsSync(infoPath)) throw new MacroError('info.json not found', 'NOT_FOUND');
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    Object.assign(info, fields, { updatedAt: new Date().toISOString() });
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
    res.json({ ok: true });
  }));

  app.post('/api/kakao/fix-group-names', withErrorHandler(ctx, async (req, res) => {
    const { dateFolder } = req.body;
    const imagesDir = BASE_DOWNLOAD_DIR;

    let targetFolder = dateFolder;
    if (!targetFolder) {
      const folders = fs.readdirSync(imagesDir)
        .filter((f) => /^\d{8}_\d{4}$/.test(f))
        .sort().reverse();
      if (folders.length === 0) throw new MacroError('no date folder', 'NOT_FOUND');
      targetFolder = folders[0];
    }

    const folderPath = path.join(imagesDir, targetFolder);
    if (!fs.existsSync(folderPath)) throw new MacroError('folder not found', 'NOT_FOUND');

    const updated: string[] = [];
    const skipped: { bizNoRaw: string; reason: string }[] = [];

    for (const sub of fs.readdirSync(folderPath).sort()) {
      const subPath = path.join(folderPath, sub);
      if (!fs.statSync(subPath).isDirectory()) continue;
      const lastUnderscore = sub.lastIndexOf('_');
      if (lastUnderscore === -1) continue;
      const bizNoRaw = sub.substring(lastUnderscore + 1);
      if (!/^\d{10}$/.test(bizNoRaw)) continue;

      const infoPath = path.join(subPath, 'info.json');
      try {
        const info = fs.existsSync(infoPath)
          ? JSON.parse(fs.readFileSync(infoPath, 'utf8'))
          : {};
        info.groupName = bizNoRaw;
        info.updatedAt = new Date().toISOString();
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
        updated.push(bizNoRaw);
      } catch (e: any) {
        skipped.push({ bizNoRaw, reason: e.message });
      }
    }

    res.json({ ok: true, updated: updated.length, skipped: skipped.length, updatedList: updated });
  }));

  // Card images CRUD
  app.get('/api/kakao/card-images', (_req, res) => {
    if (!fs.existsSync(CARD_IMAGES_DIR)) return res.json([]);
    const files = fs.readdirSync(CARD_IMAGES_DIR)
      .filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      .map((f) => {
        const fp = path.join(CARD_IMAGES_DIR, f);
        return { name: f, mtime: fs.statSync(fp).mtimeMs, path: fp };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .map(({ name, mtime, path: fp }) => ({
        name,
        mtime,
        url: `/card-images/${encodeURIComponent('부가가치세예정고지납부')}/${encodeURIComponent(name)}`,
        path: fp,
      }));
    res.json(files);
  });

  app.post('/api/kakao/card-images', withErrorHandler(ctx, async (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data) throw new MacroError('filename and data required', 'MISSING_PARAMS');
    const safe = path.basename(filename);
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(safe)) throw new MacroError('image files only', 'INVALID_TYPE');
    fs.mkdirSync(CARD_IMAGES_DIR, { recursive: true });
    const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const fp = path.join(CARD_IMAGES_DIR, safe);
    fs.writeFileSync(fp, buf);
    res.json({
      ok: true,
      name: safe,
      url: `/card-images/${encodeURIComponent('부가가치세예정고지납부')}/${encodeURIComponent(safe)}`,
      path: fp,
    });
  }));

  app.delete('/api/kakao/card-images/:filename', withErrorHandler(ctx, async (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(CARD_IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) throw new MacroError('file not found', 'NOT_FOUND');
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  }));

  // OCR verification
  app.post('/api/kakao/verify-image', withErrorHandler(ctx, async (req, res) => {
    const { imagePath } = req.body;
    const result = await ocrVerifyImage(imagePath);
    if (!result.ok) {
      res.status(result.error ? 400 : 500).json({ error: result.error });
      return;
    }
    res.json({ ok: true, text: result.text, bizNos: [], amounts: result.amounts });
  }));

  // Logs
  app.get('/api/kakao/logs', (_req, res) => {
    if (!fs.existsSync(KAKAO_LOGS_DIR)) return res.json([]);
    const files = fs.readdirSync(KAKAO_LOGS_DIR)
      .filter((f) => f.startsWith('kakao_') && f.endsWith('.log'))
      .sort().reverse()
      .map((f) => ({
        name: f,
        size: fs.statSync(path.join(KAKAO_LOGS_DIR, f)).size,
        mtime: fs.statSync(path.join(KAKAO_LOGS_DIR, f)).mtime,
      }));
    res.json(files);
  });

  app.get('/api/kakao/logs/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    if (!filename.startsWith('kakao_') || !filename.endsWith('.log')) {
      return res.status(400).json({ error: 'invalid filename' });
    }
    const filePath = path.join(KAKAO_LOGS_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'file not found' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(fs.readFileSync(filePath, 'utf8'));
  });

  // Start/Stop send
  app.post('/api/kakao/stop', withErrorHandler(ctx, async (_req, res) => {
    if (!kakaoRunning) throw new MacroError('not sending', 'NOT_RUNNING', true);
    kakaoStopRequested = true;
    ctx.log('kakao send stop requested');
    res.json({ ok: true });
  }));

  app.post('/api/kakao/start', withErrorHandler(ctx, async (req, res) => {
    if (kakaoRunning) throw new MacroError('already sending', 'ALREADY_RUNNING', true);

    const { targets, message = '', cardImagePath = '' } = req.body;
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new MacroError('empty target list', 'EMPTY_LIST');
    }

    res.json({ ok: true });
    kakaoRunning = true;
    kakaoStopRequested = false;
    ctx.broadcast('kakao-status-update', { bizNo: null, status: 'running' });

    // Log file
    fs.mkdirSync(KAKAO_LOGS_DIR, { recursive: true });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const logFileName = `kakao_${ts}.log`;
    const logFilePath = path.join(KAKAO_LOGS_DIR, logFileName);

    const writeLog = (line: string) => {
      const time = new Date().toLocaleTimeString('ko-KR');
      fs.appendFileSync(logFilePath, `[${time}] ${line}\n`, 'utf8');
    };

    fs.writeFileSync(logFilePath, [
      `================================================`,
      ` KakaoTalk Send Log`,
      ` Started: ${now.toLocaleString('ko-KR')}`,
      ` Targets: ${targets.length}`,
      ` Message: ${message ? `"${message}"` : '(none)'}`,
      `================================================\n`,
    ].join('\n'), 'utf8');

    ctx.log(`log file: logs/${logFileName}`);

    try {
      const stats = await runKakaoSend(
        targets,
        message,
        cardImagePath,
        () => kakaoStopRequested,
        (msg) => { ctx.broadcast('kakao-log', msg); writeLog(msg); },
        (bizNo, status) => {
          ctx.broadcast('kakao-status-update', { bizNo, status });
          const t = targets.find((t: any) => t.bizNo.replace(/-/g, '') === bizNo.replace(/-/g, ''));
          if (t && t.imagePath) {
            const infoPath = path.join(path.dirname(t.imagePath), 'info.json');
            if (fs.existsSync(infoPath)) {
              try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                info.status = status;
                info.updatedAt = new Date().toISOString();
                fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
              } catch {}
            }
          }
        },
      );

      const endTime = new Date();
      const elapsed = Math.round((endTime.getTime() - now.getTime()) / 1000);
      const summary = stats
        ? `success ${stats.success} / failed ${stats.failed} / skipped ${stats.skipped}`
        : `${targets.length} processed`;

      fs.appendFileSync(logFilePath, [
        `\n================================================`,
        ` Completed: ${endTime.toLocaleString('ko-KR')}`,
        ` Elapsed: ${elapsed}s`,
        ` Result: ${summary}`,
        `================================================\n`,
      ].join('\n'), 'utf8');

      ctx.broadcast('kakao-done', `done - ${summary}`);
      ctx.log(`log saved: logs/${logFileName}`);
    } catch (err: any) {
      ctx.logError(`kakao error: ${err.message}`);
      writeLog(`error: ${err.message}`);
      ctx.broadcast('kakao-done', `error: ${err.message}`);
    } finally {
      kakaoRunning = false;
    }
  }));
}
