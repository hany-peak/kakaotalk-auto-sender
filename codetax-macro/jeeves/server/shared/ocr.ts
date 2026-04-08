import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';

interface OcrResult {
  ok: boolean;
  text: string;
  amounts: string[];
  error?: string;
}

export function ocrVerifyImage(imagePath: string): Promise<OcrResult> {
  return new Promise((resolve) => {
    if (!imagePath || !fs.existsSync(imagePath)) {
      resolve({ ok: false, text: '', amounts: [], error: 'image file not found' });
      return;
    }

    const escaped = imagePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const swiftCode = `import Foundation
import Vision

let url = URL(fileURLWithPath: "${escaped}")
guard let handler = try? VNImageRequestHandler(url: url, options: [:]) else { exit(1) }

func ocr(region: CGRect) -> String {
  let sem = DispatchSemaphore(value: 0)
  var result = ""
  let req = VNRecognizeTextRequest { r, _ in
    let lines = (r.results as? [VNRecognizedTextObservation] ?? []).compactMap { $0.topCandidates(1).first?.string }
    result = lines.joined(separator: "\\n")
    sem.signal()
  }
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["ko-KR", "en-US"]
  req.regionOfInterest = region
  try? handler.perform([req])
  _ = sem.wait(timeout: .distantFuture)
  return result
}

let amountText = ocr(region: CGRect(x: 0.20, y: 0.15, width: 0.25, height: 0.12))
print(amountText)
`;

    const tmpScript = path.join(os.tmpdir(), `ocr_${Date.now()}.swift`);
    fs.writeFileSync(tmpScript, swiftCode, 'utf8');

    exec(`swift "${tmpScript}"`, { timeout: 30000 }, (err, stdout) => {
      try {
        fs.unlinkSync(tmpScript);
      } catch {
        /* ignore */
      }
      if (err) {
        resolve({ ok: false, text: '', amounts: [], error: 'OCR failed (Xcode CLT required)' });
        return;
      }
      const amounts = (stdout.match(/[\d,]{4,}/g) || []).map((s) => s.replace(/,/g, ''));
      resolve({ ok: true, text: stdout.trim(), amounts });
    });
  });
}
