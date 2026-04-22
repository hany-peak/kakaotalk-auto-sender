import * as path from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import type { ServerContext } from '../types';
import { withErrorHandler, MacroError } from '../../core/errors';
import { downloadPDFsForBusinesses } from './automation';
import { BASE_DOWNLOAD_DIR, getDownloadDir } from './config';

export function registerVatRoutes(app: Express, ctx: ServerContext): void {
  app.post('/api/vat/start', withErrorHandler(ctx, async (req, res) => {
    if (!ctx.session.loggedIn) {
      throw new MacroError('Login required', 'NOT_LOGGED_IN', true);
    }
    if (ctx.session.isRunning) {
      throw new MacroError('Already running', 'ALREADY_RUNNING', true);
    }

    const { businesses, dateFolder, taxYear, taxPeriod } = req.body;
    if (!Array.isArray(businesses) || businesses.length === 0) {
      throw new MacroError('Empty business list', 'EMPTY_LIST');
    }

    res.json({ ok: true, message: `${businesses.length} items starting` });

    ctx.session.isRunning = true;
    ctx.session.stopRequested = false;
    ctx.session.progress = { current: 0, total: businesses.length, success: 0, failed: 0 };
    ctx.broadcast('status', 'running');
    ctx.broadcast('progress', ctx.session.progress);

    const downloadDir = dateFolder
      ? path.join(BASE_DOWNLOAD_DIR, dateFolder)
      : getDownloadDir();
    fs.mkdirSync(downloadDir, { recursive: true });
    ctx.log(`folder: ${downloadDir}`);

    const resolvedYear = taxYear || new Date().getFullYear();
    const resolvedPeriod = taxPeriod || 1;
    fs.writeFileSync(
      path.join(downloadDir, 'session.json'),
      JSON.stringify({ taxYear: resolvedYear, taxPeriod: resolvedPeriod, startedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );

    try {
      const results = await downloadPDFsForBusinesses(
        ctx.session.page!,
        businesses,
        () => ctx.session.stopRequested,
        (msg) => {
          ctx.log(msg);
          if (msg.startsWith('[')) {
            const m = msg.match(/^\[(\d+)\/(\d+)\]/);
            if (m) {
              ctx.session.progress.current = parseInt(m[1]);
              ctx.broadcast('progress', ctx.session.progress);
            }
          }
        },
        (msg) => {
          ctx.logError(msg);
          if (msg.startsWith('failed')) ctx.session.progress.failed++;
          ctx.broadcast('progress', ctx.session.progress);
        },
        downloadDir,
        resolvedYear,
        resolvedPeriod,
      );

      ctx.session.progress.success = results.success.length;
      ctx.session.progress.failed = results.failed.length;
      ctx.session.progress.current = businesses.length;
      ctx.broadcast('progress', ctx.session.progress);
      ctx.broadcast('done', `done - success ${results.success.length} / failed ${results.failed.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logError(`error: ${message}`);
      ctx.broadcast('done', `error: ${message}`);
    } finally {
      ctx.session.isRunning = false;
      ctx.broadcast('status', 'logged-in');
    }
  }));

  app.post('/api/vat/stop', withErrorHandler(ctx, async (_req, res) => {
    if (!ctx.session.isRunning) {
      throw new MacroError('Not running', 'NOT_RUNNING', true);
    }
    ctx.session.stopRequested = true;
    ctx.log('stop requested');
    res.json({ ok: true });
  }));

  app.get('/api/vat/files', withErrorHandler(ctx, async (_req, res) => {
    if (!fs.existsSync(BASE_DOWNLOAD_DIR)) { res.json([]); return; }

    const result: any[] = [];
    for (const dateDir of fs.readdirSync(BASE_DOWNLOAD_DIR).sort().reverse()) {
      const full = path.join(BASE_DOWNLOAD_DIR, dateDir);
      if (!fs.statSync(full).isDirectory()) continue;

      const files = fs.readdirSync(full)
        .filter((f) => f.endsWith('.pdf') || f.endsWith('.png'))
        .map((f) => ({
          name: f,
          date: dateDir,
          type: f.endsWith('.pdf') ? 'pdf' : 'png',
          url: `/downloads/${dateDir}/${encodeURIComponent(f)}`,
          size: fs.statSync(path.join(full, f)).size,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (files.length > 0) result.push({ date: dateDir, files });
    }
    res.json(result);
  }));
}
