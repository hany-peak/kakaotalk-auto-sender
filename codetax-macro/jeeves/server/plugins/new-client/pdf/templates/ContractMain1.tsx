import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import type { TemplateProps } from './shared/TemplateProps';

const TEAL_DARK = '#234C50';

const SUNIM = {
  bizRegNumber: '306-29-93669',
  industry1: '전문,과학 및 기술서비스업',
  industry2: '세무사',
  companyName: '코드세무회계',
  address: '서울 강남구 테헤란로1길 28-11 4층 4035호',
  homepage: 'https://codetax.co.kr/',
  phone: '010-7276-2430',
  fax: '0506-200-1788',
  email: 'help@codetax.co.kr',
  representative: '정 주 희 세 무 사',
};

const CONTRACT_TYPES: Array<{ label: string; checked?: boolean }> = [
  { label: '기장대리', checked: true },
  { label: '세무조정서비스' },
  { label: '세무자문(고문)서비스' },
  { label: '조세불복 (□ 과세적부심사청구 □ 이의신청 □ 심사.심판청구 □ 조세소송 대응)' },
  { label: '재산세제 (□ 상속세 □ 증여세 □ 양도소득세)' },
  { label: '(모의)세무조사 입회 대리' },
  { label: '회계아웃소싱' },
  { label: '조세환급(경정청구) 컨설팅' },
  { label: '법인컨설팅 (□ 명의신탁주식환원 □ 가지급금정리 □ 주식이동 □ 법인전환 □ 기타)' },
];

const td: React.CSSProperties = {
  border: '1px solid #888',
  padding: '1.5mm 2.5mm',
  fontSize: '10pt',
  verticalAlign: 'middle',
};
const tdLabel: React.CSSProperties = {
  ...td,
  width: '24mm',
  fontWeight: 600,
  textAlign: 'center',
  letterSpacing: '0.4em',
  paddingLeft: '4mm',
};
const tdSubLabel: React.CSSProperties = {
  ...td,
  width: '20mm',
  fontWeight: 600,
  textAlign: 'center',
};

export function ContractMain1({ record, rrn }: TemplateProps) {
  const sunim = SUNIM;
  return (
    <PageFrame margin={{ top: '18mm', right: '18mm', bottom: '18mm', left: '18mm' }}>
      <h1
        style={{
          textAlign: 'center',
          fontSize: '22pt',
          fontWeight: 700,
          margin: '0 0 12mm 0',
          letterSpacing: '0.05em',
        }}
      >
        세무서비스 계약서
      </h1>

      <div style={{ marginBottom: '6mm' }}>
        <div style={{ fontWeight: 700, fontSize: '11pt', marginBottom: '3mm' }}>[계약종류]</div>
        <div style={{ fontSize: '10pt', lineHeight: 1.7, paddingLeft: '4mm' }}>
          {CONTRACT_TYPES.map((t, i) => (
            <div key={i}>
              <span style={{ marginRight: '2mm', fontFamily: 'Pretendard, sans-serif' }}>
                {t.checked ? '√' : '☐'}
              </span>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '6mm' }}>
        <div style={{ fontWeight: 700, fontSize: '11pt', marginBottom: '2mm' }}>【 위 임 자 】</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={tdLabel}>사업자등록번호</td>
              <td style={{ ...td, textAlign: 'center' }} colSpan={4}>
                {record.bizRegNumber ?? ''}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>회 사 명</td>
              <td style={{ ...td, textAlign: 'center' }} colSpan={4}>
                {record.companyName}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>연 락 처</td>
              <td style={{ ...td, width: '20mm', textAlign: 'center', fontWeight: 600 }}>(전화)</td>
              <td style={{ ...td, textAlign: 'center' }}>{record.bizPhone ?? ''}</td>
              <td style={{ ...td, width: '24mm', textAlign: 'center', fontWeight: 600 }}>
                (주민번호)
              </td>
              <td style={{ ...td, textAlign: 'center' }}>{rrn ?? ''}</td>
            </tr>
            <tr>
              <td style={tdLabel}>대 표 자</td>
              <td style={{ ...td, textAlign: 'center' }} colSpan={4}>
                {record.representative}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: '11pt', marginBottom: '2mm' }}>【 수 임 자 】</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={tdLabel}>사업자등록번호</td>
              <td style={td} colSpan={4}>
                {sunim.bizRegNumber}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>주업태 및 종목</td>
              <td style={{ ...td, width: '14mm', textAlign: 'center' }}>①</td>
              <td style={{ ...td, fontSize: '9pt', whiteSpace: 'nowrap' }}>{sunim.industry1}</td>
              <td style={{ ...td, width: '14mm', textAlign: 'center' }}>②</td>
              <td style={{ ...td, width: '40mm' }}>{sunim.industry2}</td>
            </tr>
            <tr>
              <td style={tdLabel}>회 사 명</td>
              <td style={td} colSpan={4}>
                {sunim.companyName}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>사업장 소재지</td>
              <td style={td} colSpan={4}>
                {sunim.address}
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>홈 페 이 지</td>
              <td style={{ ...td, color: '#1A4FB3', textDecoration: 'underline' }} colSpan={4}>
                {sunim.homepage}
              </td>
            </tr>
            <tr>
              <td rowSpan={2} style={tdLabel}>
                연 락 처
              </td>
              <td style={tdSubLabel}>(핸드폰)</td>
              <td style={{ ...td, width: '40mm' }}>{sunim.phone}</td>
              <td rowSpan={2} style={tdSubLabel}>
                (e-mail)
              </td>
              <td
                rowSpan={2}
                style={{ ...td, color: '#1A4FB3', textDecoration: 'underline' }}
              >
                {sunim.email}
              </td>
            </tr>
            <tr>
              <td style={tdSubLabel}>(팩 스)</td>
              <td style={td}>{sunim.fax}</td>
            </tr>
            <tr>
              <td style={tdLabel}>대 표 자</td>
              <td style={td} colSpan={4}>
                {sunim.representative}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        style={{
          fontSize: '10.5pt',
          marginTop: '8mm',
          marginBottom: '4mm',
          textAlign: 'center',
          fontWeight: 500,
        }}
      >
        본 계약은 위임자가 영위하는 사업과 관련된 세무서비스의 범위, 보수 등을 정하는 것이 목적으로 한다.
      </p>

      <div
        style={{
          borderTop: `1.5px solid ${TEAL_DARK}`,
          marginTop: '4mm',
        }}
      />
    </PageFrame>
  );
}
