import { execFile } from 'child_process';
import * as path from 'path';
import type { LogFn } from '../plugins/types';

interface CropBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function convertPdfToPng(
  pdfPath: string,
  log: LogFn = console.log,
  businessName = '',
  bizNo = '',
  cropBox: CropBox | null = null,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(pdfPath);
    const digits = bizNo.replace(/\D/g, '');
    const outBase = businessName && digits ? `${businessName}_${digits}` : path.basename(pdfPath, '.pdf');

    const cropArgs = cropBox
      ? `${cropBox.left},${cropBox.top},${cropBox.right},${cropBox.bottom}`
      : '';

    const script = `
import sys
from pdf2image import convert_from_path
from PIL import Image

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
base = sys.argv[3]
crop_arg = sys.argv[4] if len(sys.argv) > 4 else ''

pages = convert_from_path(pdf_path, dpi=150)
paths = []
for i, page in enumerate(pages):
    if crop_arg:
        l, t, r, b = map(int, crop_arg.split(','))
        page = page.crop((l, t, r, b))
    if len(pages) == 1:
        out = f"{out_dir}/{base}.png"
    else:
        out = f"{out_dir}/{base}_p{i+1}.png"
    page.save(out, 'PNG')
    paths.append(out)
    print(out)
`;

    const args = ['-c', script, pdfPath, dir, outBase];
    if (cropArgs) args.push(cropArgs);

    execFile('python3', args, (err, stdout) => {
      if (err) {
        log(`  PNG conversion failed: ${err.message}`);
        return reject(err);
      }
      const pngPaths = stdout.trim().split('\n').filter(Boolean);
      pngPaths.forEach((p) => log(`  PNG saved: ${path.basename(p)}`));
      resolve(pngPaths);
    });
  });
}
