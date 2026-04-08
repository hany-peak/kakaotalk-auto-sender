import * as path from 'path';
import * as fs from 'fs';
import { BASE_DOWNLOAD_DIR } from '../vat-notice/config';

export interface DateFolder {
  folder: string;
  bizCount: number;
  taxYear: number | null;
  taxPeriod: number | null;
  startedAt: string | null;
}

export interface KakaoTarget {
  name: string;
  bizNo: string;
  groupName: string;
  taxAmount: number;
  imageFile: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  dateFolder: string;
  status: string;
  ocrStatus: string | null;
  ocrNote: string | null;
  ocrVerifiedAt: string | null;
  note: string | null;
  taxList: any[];
  taxYear: number;
  taxPeriod: number;
}

export function scanDateFolders(): DateFolder[] {
  const imagesDir = BASE_DOWNLOAD_DIR;
  if (!fs.existsSync(imagesDir)) return [];
  return fs
    .readdirSync(imagesDir)
    .filter((f) => /^\d{8}_\d{4}$/.test(f))
    .sort()
    .reverse()
    .map((folder) => {
      const folderPath = path.join(imagesDir, folder);
      const sessionPath = path.join(folderPath, 'session.json');
      let session: any = {};
      if (fs.existsSync(sessionPath)) {
        try { session = JSON.parse(fs.readFileSync(sessionPath, 'utf8')); } catch {}
      }
      const bizCount = fs.readdirSync(folderPath).filter((f) => {
        const fp = path.join(folderPath, f);
        return fs.statSync(fp).isDirectory() && /^\d{10}$/.test(f.split('_').pop()!);
      }).length;
      return {
        folder,
        bizCount,
        taxYear: session.taxYear || null,
        taxPeriod: session.taxPeriod || null,
        startedAt: session.startedAt || null,
      };
    });
}

export function scanKakaoTargets(targetFolder?: string): KakaoTarget[] {
  const imagesDir = BASE_DOWNLOAD_DIR;
  if (!fs.existsSync(imagesDir)) return [];

  const dateFolders = fs
    .readdirSync(imagesDir)
    .filter((f) => /^\d{8}_\d{4}$/.test(f))
    .sort()
    .reverse();

  if (dateFolders.length === 0) return [];

  const latestFolder = targetFolder || dateFolders[0];
  const latestPath = path.join(imagesDir, latestFolder);

  let sessionInfo = { taxYear: new Date().getFullYear(), taxPeriod: 1 };
  const sessionPath = path.join(latestPath, 'session.json');
  if (fs.existsSync(sessionPath)) {
    try { Object.assign(sessionInfo, JSON.parse(fs.readFileSync(sessionPath, 'utf8'))); } catch {}
  }

  const result: KakaoTarget[] = [];
  for (const folder of fs.readdirSync(latestPath).sort()) {
    const folderPath = path.join(latestPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const lastUnderscore = folder.lastIndexOf('_');
    if (lastUnderscore === -1) continue;

    const name = folder.substring(0, lastUnderscore);
    const bizNoRaw = folder.substring(lastUnderscore + 1);
    if (!/^\d{10}$/.test(bizNoRaw)) continue;

    const bizNo = bizNoRaw.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3');

    const pngs = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith('.png')).sort();
    const imageFile = pngs.length > 0 ? pngs[0] : null;
    const imagePath = imageFile ? path.join(folderPath, imageFile) : null;
    const imageUrl = imageFile ? `/images/${latestFolder}/${folder}/${imageFile}` : null;

    let info: any = {};
    const infoPath = path.join(folderPath, 'info.json');
    if (fs.existsSync(infoPath)) {
      try { info = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch {}
    }

    let note = info.note || null;
    if (!imageFile && !note) {
      note = '고지납부서 없음';
      try {
        const updated = { ...info, note, status: info.status || '주의', updatedAt: new Date().toISOString() };
        fs.writeFileSync(infoPath, JSON.stringify(updated, null, 2), 'utf8');
      } catch {}
    }

    result.push({
      name,
      bizNo,
      groupName: info.groupName || bizNoRaw,
      taxAmount: info.taxAmount || 0,
      imageFile,
      imagePath,
      imageUrl,
      dateFolder: latestFolder,
      status: info.status || 'pending',
      ocrStatus: info.ocrStatus || null,
      ocrNote: info.ocrNote || null,
      ocrVerifiedAt: info.ocrVerifiedAt || null,
      note,
      taxList: info.taxList || [],
      taxYear: sessionInfo.taxYear,
      taxPeriod: sessionInfo.taxPeriod,
    });
  }
  return result;
}
