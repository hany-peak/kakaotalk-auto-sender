import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import type { TemplateProps } from './shared/TemplateProps';

export function ContractCover({ record, date }: TemplateProps) {
  return (
    <PageFrame margin={{ top: '40mm', right: '20mm', bottom: '20mm', left: '20mm' }}>
      <h1 style={{ textAlign: 'center', fontSize: '28pt', marginTop: '60mm', marginBottom: '40mm' }}>
        기 장 대 행 계 약 서
      </h1>
      <table style={{ margin: '0 auto', fontSize: '14pt' }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: '8mm', fontWeight: 700 }}>위임자</td>
            <td>{record.companyName}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: '8mm', fontWeight: 700 }}>대표자</td>
            <td>{record.representative}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: '8mm', fontWeight: 700 }}>일자</td>
            <td>{date}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ position: 'absolute', bottom: '30mm', left: 0, right: 0, textAlign: 'center', fontSize: '14pt', fontWeight: 700 }}>
        코드택스 세무회계
      </p>
    </PageFrame>
  );
}
