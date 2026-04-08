import * as path from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import type { ServerContext } from '../types';

const MESSAGES_PATH = path.resolve(__dirname, '../../../src/messages.json');

function readMessages(): string[] {
  try { return JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf8')); }
  catch { return []; }
}

function saveMessages(list: string[]): void {
  fs.writeFileSync(MESSAGES_PATH, JSON.stringify(list, null, 2), 'utf8');
}

export function registerMessageRoutes(app: Express, _ctx: ServerContext): void {
  app.get('/api/messages', (_req, res) => {
    res.json(readMessages());
  });

  app.post('/api/messages', (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'content required' });
    const list = readMessages();
    list.push(text.trim());
    saveMessages(list);
    res.json({ ok: true, index: list.length - 1, list });
  });

  app.put('/api/messages/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'content required' });
    const list = readMessages();
    if (idx < 0 || idx >= list.length) return res.status(404).json({ error: 'not found' });
    list[idx] = text.trim();
    saveMessages(list);
    res.json({ ok: true, list });
  });

  app.delete('/api/messages/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    const list = readMessages();
    if (idx < 0 || idx >= list.length) return res.status(404).json({ error: 'not found' });
    list.splice(idx, 1);
    saveMessages(list);
    res.json({ ok: true, list });
  });
}
