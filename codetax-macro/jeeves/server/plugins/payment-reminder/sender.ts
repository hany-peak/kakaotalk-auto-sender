import { runKakaoSend } from '../kakao-send/sender';
import type { UnpaidRecord } from './airtable';

export interface SendInput {
  record: UnpaidRecord;
  message: string;
}

export interface SendStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  failures: { recordId: string; error: string }[];
}

export async function sendBatch(
  inputs: SendInput[],
  isStopped: () => boolean,
  log: (msg: string) => void,
): Promise<{ stats: SendStats; perRecord: { recordId: string; success: boolean }[] }> {
  const stats: SendStats = {
    total: inputs.length,
    success: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };
  const perRecord: { recordId: string; success: boolean }[] = [];

  for (const input of inputs) {
    if (isStopped()) {
      stats.skipped += 1;
      perRecord.push({ recordId: input.record.recordId, success: false });
      continue;
    }
    try {
      const result = await runKakaoSend(
        [
          {
            name: input.record.name,
            bizNo: input.record.bizNo,
            groupName: '미수업체',
            imagePath: null,
          },
        ],
        input.message,
        '',
        isStopped,
        log,
        () => {},
      );

      const ok = result.success > 0 && result.failed === 0;
      if (ok) {
        stats.success += 1;
        perRecord.push({ recordId: input.record.recordId, success: true });
      } else {
        stats.failed += 1;
        stats.failures.push({ recordId: input.record.recordId, error: 'kakao send returned non-success' });
        perRecord.push({ recordId: input.record.recordId, success: false });
      }
    } catch (err) {
      stats.failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      stats.failures.push({ recordId: input.record.recordId, error: msg });
      perRecord.push({ recordId: input.record.recordId, success: false });
    }
  }

  return { stats, perRecord };
}
