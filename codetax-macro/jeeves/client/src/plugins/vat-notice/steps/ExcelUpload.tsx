import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface Business {
  name: string;
  bizNo: string;
  taxAmount: number;
}

interface ExcelUploadProps {
  onParsed: (businesses: Business[], taxYear: number, taxPeriod: number) => void;
}

export function ExcelUpload({ onParsed }: ExcelUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState(() =>
    parseInt(localStorage.getItem('jeeves_tax_year') || '') || new Date().getFullYear(),
  );
  const [taxPeriod, setTaxPeriod] = useState(() =>
    parseInt(localStorage.getItem('jeeves_tax_period') || '') || 1,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(ws['!ref']!);

      const results: Business[] = [];
      const seen = new Set<string>();

      for (let r = 1; r <= range.e.r; r++) {
        const targetCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (!targetCell || String(targetCell.v).trim() !== '여') continue;

        const bizCell = ws[XLSX.utils.encode_cell({ r, c: 4 })];
        const nameCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
        const taxAmountCell = ws[XLSX.utils.encode_cell({ r, c: 7 })];
        if (!bizCell) continue;

        let bizNo = String(bizCell.v).replace(/[^0-9]/g, '');
        if (bizNo.length !== 10) continue;
        bizNo = `${bizNo.substring(0, 3)}-${bizNo.substring(3, 5)}-${bizNo.substring(5)}`;

        if (seen.has(bizNo)) continue;
        seen.add(bizNo);

        results.push({
          name: nameCell ? String(nameCell.v).trim() : '',
          bizNo,
          taxAmount: taxAmountCell ? Math.round(Number(taxAmountCell.v)) : 0,
        });
      }

      localStorage.setItem('jeeves_tax_year', String(taxYear));
      localStorage.setItem('jeeves_tax_period', String(taxPeriod));
      onParsed(results, taxYear, taxPeriod);
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 1</span>
        <h3 className="font-bold text-sm">예정고지 엑셀 업로드</h3>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="text-[13px] text-muted shrink-0">조회 기준</span>
        <input
          type="number"
          value={taxYear}
          onChange={(e) => setTaxYear(parseInt(e.target.value))}
          min={2020}
          max={2040}
          className="w-[76px] bg-surface2 border border-border rounded-md text-text px-2.5 py-1.5 text-[13px] outline-none text-center"
        />
        <span className="text-[13px] text-muted">년</span>
        <select
          value={taxPeriod}
          onChange={(e) => setTaxPeriod(parseInt(e.target.value))}
          className="bg-surface2 border border-border rounded-md text-text px-2.5 py-1.5 text-[13px] outline-none"
        >
          <option value={1}>1기분 (4월 납부)</option>
          <option value={2}>2기분 (10월 납부)</option>
        </select>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-7 text-center cursor-pointer hover:border-accent/50 transition-colors"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <div className="text-3xl mb-2">📂</div>
        <h3 className="text-sm font-medium">엑셀 업로드</h3>
        {fileName && (
          <div className="mt-2 text-xs text-accent">📄 {fileName}</div>
        )}
      </div>
    </div>
  );
}
