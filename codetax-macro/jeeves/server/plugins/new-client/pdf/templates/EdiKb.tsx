import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { SignatureBlock } from './shared/SignatureBlock';
import type { TemplateProps } from './shared/TemplateProps';

const cellLabel: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2mm 3mm',
  backgroundColor: '#f0f0f0',
  width: '25%',
  fontWeight: 700,
};
const cellValue: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2mm 3mm',
  width: '75%',
};

export function EdiKb({ record, date }: TemplateProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }}>
      <h1 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '8mm' }}>
        국민연금 EDI 신청서
      </h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt' }}>
        <tbody>
          <tr>
            <td style={cellLabel}>회사명</td>
            <td style={cellValue}>{record.companyName}</td>
          </tr>
          <tr>
            <td style={cellLabel}>사업자번호</td>
            <td style={cellValue}>{record.bizRegNumber ?? ''}</td>
          </tr>
          <tr>
            <td style={cellLabel}>대표자</td>
            <td style={cellValue}>{record.representative}</td>
          </tr>
          <tr>
            <td style={cellLabel}>전화번호</td>
            <td style={cellValue}>{record.bizPhone ?? ''}</td>
          </tr>
          <tr>
            <td style={cellLabel}>사업장 주소</td>
            <td style={cellValue}>{record.bizAddress ?? ''}</td>
          </tr>
        </tbody>
      </table>
      <SignatureBlock
        role="신청인"
        name={record.companyName}
        representative={record.representative}
        date={date}
      />
    </PageFrame>
  );
}
