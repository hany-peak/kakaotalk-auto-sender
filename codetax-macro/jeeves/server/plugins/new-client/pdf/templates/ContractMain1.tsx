import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import type { TemplateProps } from './shared/TemplateProps';

const SAMPLE_CLAUSES_PART1 = [
  '제 1 조 (목적) 본 계약은 위임자(이하 "갑")가 세무대리인(이하 "을")에게 기장 및 세무 업무를 위임하는 데 필요한 사항을 정함을 목적으로 한다.',
  '제 2 조 (위임 업무) 갑은 을에게 다음 업무를 위임한다.\n  1. 회계장부 기장\n  2. 세무신고 (부가가치세, 종합소득세, 법인세, 원천세 등)\n  3. 4대보험 신고 보조\n  4. 기타 위 업무에 부수되는 사항',
  '제 3 조 (계약기간) 본 계약은 체결일로부터 1년간 유효하며, 만료 1개월 전 어느 일방의 서면 해지 의사가 없을 경우 동일 조건으로 1년 자동 연장된다.',
  '제 4 조 (보수) 갑은 을에게 매월 약정 기장료를 지급하며, 결산조정료는 별도로 합의한다.',
];

export function ContractMain1({ record }: TemplateProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' }}>
      <h2 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm' }}>
        기장대행 계약서 (1/2)
      </h2>
      <p style={{ fontSize: '11pt', marginBottom: '6mm' }}>
        위임자 <b>{record.companyName}</b> (이하 "갑")과 코드택스 세무회계 (이하 "을")는 다음과 같이 기장대행 계약을 체결한다.
      </p>
      <div style={{ fontSize: '11pt', lineHeight: 1.8 }}>
        {SAMPLE_CLAUSES_PART1.map((clause, i) => (
          <p key={i} style={{ marginBottom: '4mm', whiteSpace: 'pre-line' }}>
            {clause}
          </p>
        ))}
      </div>
    </PageFrame>
  );
}
