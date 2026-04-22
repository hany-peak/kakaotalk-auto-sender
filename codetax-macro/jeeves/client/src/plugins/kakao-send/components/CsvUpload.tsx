import { useRef } from 'react';
import * as XLSX from 'xlsx';

interface CsvTarget {
  name: string;
  bizNo: string;
  groupName: string;
}

interface CsvUploadProps {
  onParsed: (targets: CsvTarget[]) => void;
}

export function CsvUpload({ onParsed }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(ws['!ref']!);

      const results: CsvTarget[] = [];
      const seen = new Set<string>();

      for (let r = 1; r <= range.e.r; r++) {
        const bizCell = ws[XLSX.utils.encode_cell({ r, c: 1 })]; // 사업자번호
        const nameCell = ws[XLSX.utils.encode_cell({ r, c: 2 })]; // 업체명
        if (!bizCell) continue;

        let bizNo = String(bizCell.v).replace(/[^0-9]/g, '');
        if (bizNo.length !== 10) continue;
        if (seen.has(bizNo)) continue;
        seen.add(bizNo);

        const formatted = `${bizNo.substring(0, 3)}-${bizNo.substring(3, 5)}-${bizNo.substring(5)}`;
        results.push({
          name: nameCell ? String(nameCell.v).trim() : '',
          bizNo: formatted,
          groupName: bizNo, // default = 사업자번호 숫자
        });
      }

      onParsed(results);
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 transition-colors mb-4"
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
      <div className="text-2xl mb-2">📂</div>
      <h3 className="text-sm font-medium">거래처 엑셀/CSV 업로드</h3>
      <p className="text-xs text-muted mt-1">관리번호, 사업자번호, 업체명, 대표자, 세무범위</p>
    </div>
  );
}
