import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { SignatureBlock } from './shared/SignatureBlock';
import type { TemplateProps } from './shared/TemplateProps';

export function Consent({ record, date }: TemplateProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }}>
      <h1 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '8mm' }}>
        세무대리 수임 동의서
      </h1>
      <p style={{ fontSize: '11pt', lineHeight: 1.8, marginBottom: '6mm' }}>
        본인은 아래 세무대리인에게 본인 사업의 세무대리 업무 일체를 위임함에 동의합니다.
      </p>
      <SignatureBlock
        role="위임자"
        name={record.companyName}
        regNo={record.bizRegNumber}
        address={record.bizAddress}
        representative={record.representative}
        date={date}
      />
      <SignatureBlock role="세무대리인" name="코드택스 세무회계" />
    </PageFrame>
  );
}
