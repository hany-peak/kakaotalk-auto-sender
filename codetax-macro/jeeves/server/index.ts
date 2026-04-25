import express from 'express';
import * as path from 'path';
import * as os from 'os';
import { BrowserSession } from './core/session';
import { SSEManager } from './core/sse';
import { createLogger } from './core/logger';
import { plugins } from './plugins';
import type { ServerContext } from './plugins/types';
import { BASE_DOWNLOAD_DIR } from './plugins/vat-notice/config';
import { scheduler } from './scheduler';
import { initPdfRenderer, closePdfRenderer } from './plugins/new-client/pdf/renderer';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '20mb' }));

// Static files
app.use('/images', express.static(BASE_DOWNLOAD_DIR));

// Serve client build in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// Core services
const session = new BrowserSession();
const sse = new SSEManager();
const { log, logError } = createLogger(sse);

const ctx: ServerContext = {
  session,
  broadcast: sse.broadcast.bind(sse),
  log,
  logError,
};

// SSE endpoint
app.get('/api/events', (req, res) => {
  sse.addClient(res);
});

// Session status
app.get('/api/status', (_req, res) => {
  res.json(session.getStatus());
});

// Login
app.post('/api/login', async (req, res) => {
  if (session.isLoggingIn) return res.status(409).json({ error: 'login in progress' });
  if (session.loggedIn) return res.status(409).json({ error: 'already logged in' });

  res.json({ ok: true });
  session.isLoggingIn = true;
  ctx.broadcast('status', 'logging-in');

  try {
    session.setOnDisconnect(() => {
      log('browser closed');
      ctx.broadcast('status', 'idle');
    });

    await session.launch(log);
    await session.waitForLogin(log);

    session.loggedIn = true;
    session.isLoggingIn = false;
    ctx.broadcast('status', 'logged-in');
    log('login complete');
  } catch (err: any) {
    logError(`login error: ${err.message}`);
    await session.close();
    ctx.broadcast('status', 'idle');
  }
});

// Logout
app.post('/api/logout', async (_req, res) => {
  await session.close();
  ctx.broadcast('status', 'idle');
  res.json({ ok: true });
});

// Register all plugin routes
for (const plugin of plugins) {
  plugin.registerRoutes(app, ctx);
}

// Scheduler subsystem
scheduler.registerRoutes(app, ctx);
scheduler.initialize(plugins, ctx).catch((err) => {
  logError(`scheduler initialize failed: ${err.message}`);
});

initPdfRenderer().then(
  () => log('[pdf] Playwright Chromium ready'),
  (err) => logError(`[pdf] Chromium launch failed: ${err.message}`),
);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await scheduler.shutdown();
    await session.close().catch(() => {});
    await closePdfRenderer().catch((e) => logError(`pdf close failed: ${e.message}`));
    process.exit(0);
  });
}

// SPA fallback
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'client not built' });
  }
});

app.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const localIP =
    Object.values(nets).flat().find((n) => n?.family === 'IPv4' && !n.internal)?.address || 'unknown';
  console.log(`\n========================================`);
  console.log(`  Jeeves server running`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
  console.log(`========================================\n`);
});
