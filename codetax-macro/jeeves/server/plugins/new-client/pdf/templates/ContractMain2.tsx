import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { SignatureBlock } from './shared/SignatureBlock';
import type { TemplateProps } from './shared/TemplateProps';

const SAMPLE_CLAUSES_PART2 = [
  '제 5 조 (자료의 제공) 갑은 을이 위임 업무를 수행하기 위해 필요한 자료를 적시에 제공하여야 한다.',
  '제 6 조 (비밀유지) 을은 본 계약과 관련하여 알게 된 갑의 정보를 제3자에게 누설하지 아니한다.',
  '제 7 조 (해지) 갑 또는 을은 1개월 전 서면 통지로 본 계약을 해지할 수 있다.',
  '제 8 조 (분쟁) 본 계약과 관련하여 분쟁이 발생할 경우, 양 당사자는 상호 협의하여 해결한다.',
];

export function ContractMain2({ record, date }: TemplateProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' }}>
      <h2 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm' }}>
        기장대행 계약서 (2/2)
      </h2>
      <div style={{ fontSize: '11pt', lineHeight: 1.8 }}>
        {SAMPLE_CLAUSES_PART2.map((clause, i) => (
          <p key={i} style={{ marginBottom: '4mm' }}>
            {clause}
          </p>
        ))}
      </div>
      <p style={{ fontSize: '11pt', marginTop: '10mm', marginBottom: '6mm' }}>
        본 계약의 성립을 증명하기 위해 계약서 2부를 작성하여 갑과 을이 각 1부씩 보관한다.
      </p>
      <p style={{ textAlign: 'center', fontSize: '12pt', marginTop: '8mm', marginBottom: '8mm' }}>
        {date}
      </p>
      <SignatureBlock
        role="갑 (위임자)"
        name={record.companyName}
        regNo={record.bizRegNumber}
        address={record.bizAddress}
        representative={record.representative}
      />
      <SignatureBlock role="을 (세무대리인)" name="코드택스 세무회계" />
    </PageFrame>
  );
}
