import * as path from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import cron, { ScheduledTask } from 'node-cron';
import type { MacroPlugin, PluginSchedule, RunResult, ServerContext } from './plugins/types';
import { withErrorHandler, MacroError } from './core/errors';

const LOGS_DIR = path.resolve(__dirname, '../../logs');
const STATE_FILE = path.join(LOGS_DIR, 'scheduler-state.json');
const HISTORY_LIMIT = 30;

interface PluginState {
  enabled: boolean;
  cron: string;
}

interface SchedulerState {
  [pluginId: string]: PluginState;
}

interface RegisteredPlugin {
  plugin: MacroPlugin;
  schedule: PluginSchedule;
  task: ScheduledTask | null;
  lastRun: RunResult | null;
}

const registered = new Map<string, RegisteredPlugin>();
let state: SchedulerState = {};
let ctxRef: ServerContext | null = null;

function loadState(): SchedulerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[scheduler] failed to load state:', err);
  }
  return {};
}

function saveState(): void {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function sessionsDir(pluginId: string): string {
  return path.join(LOGS_DIR, `${pluginId}-sessions`);
}

function saveRunResult(pluginId: string, result: RunResult): void {
  const dir = sessionsDir(pluginId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${result.startedAt.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(result, null, 2), 'utf8');

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of files.slice(HISTORY_LIMIT)) {
    try {
      fs.unlinkSync(path.join(dir, old.f));
    } catch {
      /* ignore */
    }
  }
}

function loadHistory(pluginId: string, limit: number): RunResult[] {
  const dir = sessionsDir(pluginId);
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  return files
    .map(({ f }) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as RunResult;
      } catch {
        return null;
      }
    })
    .filter((r): r is RunResult => r !== null);
}

async function runWithLogging(pluginId: string): Promise<RunResult> {
  const entry = registered.get(pluginId);
  if (!entry) throw new MacroError(`unknown plugin: ${pluginId}`, 'UNKNOWN_PLUGIN');
  if (!ctxRef) throw new MacroError('scheduler not initialized', 'NOT_INITIALIZED');

  ctxRef.log(`[scheduler:${pluginId}] run started`);
  ctxRef.broadcast('scheduler-run-started', { pluginId });

  let result: RunResult;
  try {
    result = await entry.schedule.run(ctxRef);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const now = new Date().toISOString();
    result = {
      status: 'error',
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      summary: `uncaught: ${e.message}`,
      error: e.stack ?? e.message,
    };
  }

  entry.lastRun = result;
  saveRunResult(pluginId, result);

  if (result.status === 'success') {
    ctxRef.log(`[scheduler:${pluginId}] ${result.summary}`);
  } else {
    ctxRef.logError(`[scheduler:${pluginId}] ${result.summary}`);
  }
  ctxRef.broadcast('scheduler-run-finished', { pluginId, result });

  return result;
}

function stopTask(pluginId: string): void {
  const entry = registered.get(pluginId);
  if (entry?.task) {
    entry.task.stop();
    entry.task = null;
  }
}

function startTask(pluginId: string): void {
  const entry = registered.get(pluginId);
  if (!entry) return;
  const st = state[pluginId];
  if (!st || !st.enabled) return;

  if (!cron.validate(st.cron)) {
    console.error(`[scheduler] invalid cron for ${pluginId}: ${st.cron}`);
    return;
  }

  entry.task = cron.schedule(
    st.cron,
    () => {
      runWithLogging(pluginId).catch((err) => {
        console.error(`[scheduler] run error for ${pluginId}:`, err);
      });
    },
    { timezone: entry.schedule.timezone },
  );
  entry.task.start();
}

export const scheduler = {
  async initialize(plugins: MacroPlugin[], ctx: ServerContext): Promise<void> {
    ctxRef = ctx;
    state = loadState();

    for (const plugin of plugins) {
      if (!plugin.schedule) continue;
      registered.set(plugin.id, {
        plugin,
        schedule: plugin.schedule,
        task: null,
        lastRun: null,
      });

      if (!state[plugin.id]) {
        state[plugin.id] = {
          enabled: plugin.schedule.defaultEnabled,
          cron: plugin.schedule.defaultCron,
        };
      }

      const recent = loadHistory(plugin.id, 1);
      if (recent[0]) registered.get(plugin.id)!.lastRun = recent[0];

      startTask(plugin.id);
      console.log(
        `[scheduler] registered ${plugin.id} (${state[plugin.id].enabled ? 'enabled' : 'disabled'}, ${state[plugin.id].cron})`,
      );
    }

    saveState();
  },

  registerRoutes(app: Express, ctx: ServerContext): void {
    app.get(
      '/api/scheduler/plugins',
      withErrorHandler(ctx, async (_req, res) => {
        const list = Array.from(registered.entries()).map(([id, entry]) => ({
          id,
          name: entry.plugin.name,
          icon: entry.plugin.icon,
          enabled: state[id].enabled,
          cron: state[id].cron,
          defaultCron: entry.schedule.defaultCron,
          timezone: entry.schedule.timezone,
          lastRun: entry.lastRun,
        }));
        res.json(list);
      }),
    );

    app.get(
      '/api/scheduler/:id/history',
      withErrorHandler(ctx, async (req, res) => {
        const id = req.params.id;
        if (!registered.has(id)) throw new MacroError('unknown plugin', 'UNKNOWN_PLUGIN');
        const limit = Math.min(Number(req.query.limit) || HISTORY_LIMIT, HISTORY_LIMIT);
        res.json(loadHistory(id, limit));
      }),
    );

    app.post(
      '/api/scheduler/:id/update',
      withErrorHandler(ctx, async (req, res) => {
        const id = req.params.id;
        if (!registered.has(id)) throw new MacroError('unknown plugin', 'UNKNOWN_PLUGIN');
        const { enabled, cron: cronExpr } = req.body as Partial<PluginState>;

        if (cronExpr !== undefined) {
          if (typeof cronExpr !== 'string' || !cron.validate(cronExpr)) {
            throw new MacroError('invalid cron expression', 'INVALID_CRON');
          }
          state[id].cron = cronExpr;
        }
        if (enabled !== undefined) {
          state[id].enabled = Boolean(enabled);
        }

        stopTask(id);
        startTask(id);
        saveState();
        res.json({ ok: true, state: state[id] });
      }),
    );

    app.post(
      '/api/scheduler/:id/run-now',
      withErrorHandler(ctx, async (req, res) => {
        const id = req.params.id;
        if (!registered.has(id)) throw new MacroError('unknown plugin', 'UNKNOWN_PLUGIN');
        const result = await runWithLogging(id);
        res.json(result);
      }),
    );
  },

  async shutdown(): Promise<void> {
    for (const id of registered.keys()) stopTask(id);
  },
};
