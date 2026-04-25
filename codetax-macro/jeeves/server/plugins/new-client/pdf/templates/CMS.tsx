import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { SignatureBlock } from './shared/SignatureBlock';
import type { TemplateProps } from './shared/TemplateProps';

const cellLabel: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2mm 3mm',
  backgroundColor: '#f0f0f0',
  width: '20%',
  fontWeight: 700,
};
const cellValue: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2mm 3mm',
  width: '30%',
};

export function CMS({ record, date }: TemplateProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }}>
      <h1 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '8mm' }}>
        CMS 출금이체 동의서
      </h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt' }}>
        <tbody>
          <tr>
            <td style={cellLabel}>회사명</td>
            <td style={cellValue}>{record.companyName}</td>
            <td style={cellLabel}>사업자번호</td>
            <td style={cellValue}>{record.bizRegNumber ?? ''}</td>
          </tr>
          <tr>
            <td style={cellLabel}>대표자</td>
            <td style={cellValue}>{record.representative}</td>
            <td style={cellLabel}>일자</td>
            <td style={cellValue}>{date}</td>
          </tr>
          <tr>
            <td style={cellLabel}>은행</td>
            <td style={cellValue}>{record.bankName ?? ''}</td>
            <td style={cellLabel}>계좌번호</td>
            <td style={cellValue}>{record.accountNumber ?? ''}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: '8mm', fontSize: '11pt', lineHeight: 1.7 }}>
        본인은 위 계좌에서 매월 기장료가 자동 출금되는 것에 동의합니다.
      </p>
      <SignatureBlock
        role="신청인"
        name={record.companyName}
        representative={record.representative}
        date={date}
      />
    </PageFrame>
  );
}
