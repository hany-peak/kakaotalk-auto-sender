import type { Express } from 'express';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ServerContext } from '../../types';
import type { NewClientConfig } from '../config';
import { fetchAirtableRecord, fetchRepRrn, isAirtableId } from '../airtable';
import { BUNDLE_GROUPS } from './bundles';
import type { TemplateProps } from './templates/shared/TemplateProps';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}년 ${m}월 ${day}일`;
}

export function registerPreviewRoutes(
  app: Express,
  ctx: ServerContext,
  loadConfig: () => NewClientConfig,
): void {
  app.get('/api/new-client/preview/:bundle', async (req, res) => {
    const groupId = req.params.bundle;
    const group = BUNDLE_GROUPS.find((g) => g.id === groupId);
    if (!group) return res.status(404).type('text/plain').send(`unknown bundle: ${groupId}`);
    const idx = Number.parseInt(String(req.query.template ?? '0'), 10);
    const Template = group.templates[idx];
    if (!Template) return res.status(404).type('text/plain').send(`template index out of range: ${idx}`);

    const recordId = String(req.query.recordId ?? '');
    if (!isAirtableId(recordId)) return res.status(400).type('text/plain').send('recordId required');

    const cfg = loadConfig();
    const record = await fetchAirtableRecord(recordId, cfg, ctx.logError);
    if (!record) return res.status(404).type('text/plain').send('record not found');
    const rrn = await fetchRepRrn(recordId, cfg, ctx.logError, ctx.log);

    const props: TemplateProps = { record, rrn, date: formatDate(new Date()) };
    const html = renderToStaticMarkup(React.createElement(Template, props));
    const doc =
      html.startsWith('<!doctype') || html.startsWith('<!DOCTYPE')
        ? html
        : `<!doctype html>${html}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc);
  });
}
