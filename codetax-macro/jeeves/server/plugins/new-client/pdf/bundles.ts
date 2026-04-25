import * as React from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { renderReact } from './renderer';
import type { NewClientRecord } from '../types';
import type { TemplateProps } from './templates/shared/TemplateProps';

import { CMS } from './templates/CMS';
import { Consent } from './templates/Consent';
import { EdiKb } from './templates/EdiKb';
import { EdiNhis } from './templates/EdiNhis';
import { ContractCover } from './templates/ContractCover';
import { ContractMain1 } from './templates/ContractMain1';
import { ContractMain2 } from './templates/ContractMain2';

export type BundleId = 'contract' | 'cms' | 'consent' | 'edi';

type TemplateComponent = (props: TemplateProps) => React.ReactElement;

export interface BundleGroup {
  id: BundleId;
  filename: string;
  templates: TemplateComponent[];
}

export const BUNDLE_GROUPS: BundleGroup[] = [
  { id: 'contract', filename: '기장계약서', templates: [ContractCover, ContractMain1, ContractMain2] },
  { id: 'cms', filename: 'CMS', templates: [CMS] },
  { id: 'consent', filename: '수임동의', templates: [Consent] },
  { id: 'edi', filename: 'EDI', templates: [EdiKb, EdiNhis] },
];

export function sanitizeFilename(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '');
}

export async function mergePdfs(pdfs: Buffer[]): Promise<Buffer> {
  if (pdfs.length === 1) return pdfs[0];
  const out = await PDFDocument.create();
  for (const pdf of pdfs) {
    const src = await PDFDocument.load(pdf);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}년 ${m}월 ${day}일`;
}

export async function assembleBundle(
  group: BundleGroup,
  record: NewClientRecord,
  rrn: string | null,
): Promise<Buffer> {
  const props: TemplateProps = { record, rrn, date: formatDate(new Date()) };
  const pdfs = await Promise.all(
    group.templates.map((T) => renderReact(React.createElement(T, props))),
  );
  return mergePdfs(pdfs);
}

export async function zipFiles(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
