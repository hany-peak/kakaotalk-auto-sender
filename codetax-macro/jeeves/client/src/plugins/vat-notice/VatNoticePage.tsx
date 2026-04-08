import { useCallback, useState } from 'react';
import { useVatWorkflow } from './hooks/useVatWorkflow';
import { WorkflowBar } from './components/WorkflowBar';
import { ExcelUpload } from './steps/ExcelUpload';
import { HometaxLogin } from './steps/HometaxLogin';
import { AutoCollection } from './steps/AutoCollection';
import { CollectionProgress } from './steps/CollectionProgress';
import { KakaoSendStep } from './steps/KakaoSendStep';

interface Business {
  name: string;
  bizNo: string;
  taxAmount: number;
}

export function VatNoticePage() {
  const { step, setStep, dateFolder, startFresh } = useVatWorkflow();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxPeriod, setTaxPeriod] = useState(1);

  const handleExcelParsed = useCallback(
    (biz: Business[], year: number, period: number) => {
      setBusinesses(biz);
      setTaxYear(year);
      setTaxPeriod(period);
      setStep(2);
    },
    [setStep],
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold">⚡ 부가가치세 예정고지 납부서 매크로</h2>
        <p className="text-sm text-muted mt-1">
          엑셀 업로드 → 사업자번호 추출 → 홈택스 자동 접속 → 자동화 수집 → 카카오톡 전송
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={startFresh}
            className="bg-accent text-white px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-accent/90"
          >
            🚀 새롭게 하기
          </button>
          <button
            onClick={() => setStep(5)}
            className="border border-border text-text px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface2"
          >
            📂 이전 작업 이어서 하기
          </button>
        </div>
      </div>

      <WorkflowBar currentStep={step} onJumpToKakao={() => setStep(5)} />

      <div className="flex flex-col gap-4">
        {step >= 1 && step < 5 && <ExcelUpload onParsed={handleExcelParsed} />}
        {step >= 2 && step < 5 && <HometaxLogin onLoggedIn={() => step === 2 && setStep(3)} />}
        {step >= 3 && step < 5 && (
          <AutoCollection
            businesses={businesses}
            taxYear={taxYear}
            taxPeriod={taxPeriod}
            onStarted={() => setStep(4)}
          />
        )}
        {step === 4 && <CollectionProgress onDone={() => setStep(5)} />}
        {step === 5 && <KakaoSendStep dateFolder={dateFolder} />}
      </div>
    </div>
  );
}
