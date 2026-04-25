import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import type { TemplateProps } from './shared/TemplateProps';

const td: React.CSSProperties = {
  border: '1px solid #555',
  padding: '1mm 1.5mm',
  fontSize: '8pt',
  textAlign: 'center',
  verticalAlign: 'middle',
};
const th: React.CSSProperties = {
  ...td,
  fontWeight: 700,
  background: '#F0F0F0',
};
const tdLeft: React.CSSProperties = { ...td, textAlign: 'left' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };

const sectionTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '10pt',
  marginTop: '4mm',
  marginBottom: '2mm',
};
const unitNote: React.CSSProperties = {
  fontSize: '8pt',
  textAlign: 'right',
  marginBottom: '1mm',
};
const footnote: React.CSSProperties = {
  fontSize: '8.5pt',
  marginTop: '2mm',
  textDecoration: 'underline',
};

const 일반형업무: string[] = [
  '· 원천세 신고 (10인 기준)',
  '· 4대보험 신고관련 업무 (10인 기준)',
  '   (자격취득/상실신고, 보수총액신고)',
  '· 지급명세서 제출',
  '· 연말정산 (10인 기준)',
  '· 부가가치세 신고',
  '· 신용카드매입세액공제',
  '· 면세사업자현황신고',
  '· 계좌 내역정리 및 검토(법인)',
  '· 사업관련 기본 세무 상담',
];

const 일반형구간: Array<[string, string, string, string]> = [
  ['', '3억 이하', '100,000', '150,000'],
  ['3억 초과', '5억 이하', '150,000', '200,000'],
  ['5억 초과', '10억 이하', '200,000', '250,000'],
  ['10억 초과', '20억 이하', '250,000', '300,000'],
  ['20억 초과', '30억 이하', '300,000', '400,000'],
  ['30억 초과', '40억 이하', '400,000', '500,000'],
  ['40억 초과', '50억 이하', '500,000', '600,000'],
];

const 세무조정구간: Array<[string, string, string]> = [
  ['1억 이하', '440,000원', '550,000원'],
  ['1억원초과 ~ 3억원이하', '440,000원  +  1억원   초과액  ×  0.16%', '550,000원  +  1억원   초과액  ×  0.19%'],
  ['3억원초과 ~ 5억원이하', '803,000원  +  3억원   초과액  ×  0.13%', '984,500원  +  3억원   초과액  ×  0.16%'],
  ['5억원초과 ~ 10억원이하', '1,078,000원  +  5억원   초과액  ×  0.11%', '1,325,500원  +  5억원   초과액  ×  0.13%'],
  ['10억원초과 ~ 20억원이하', '1,655,500원  +  10억원   초과액  ×  0.07%', '2,013,000원  +  10억원   초과액  ×  0.11%'],
  ['20억원초과 ~ 50억원이하', '2,425,500원  +  20억원   초과액  ×  0.04%', '3,168,000원  +  20억원   초과액  ×  0.06%'],
  ['50억원초과 ~ 300억원이하', '3,745,500원  +  50억원   초과액  ×  0.03%', '5,148,000원  +  50억원   초과액  ×  0.04%'],
  ['300억원 초과', '11,995,500원  +  300억원   초과액  ×  0.03%', '16,148,000원  +  300억원   초과액  ×  0.03%'],
];

export function ContractFeeSchedule(_props: TemplateProps) {
  return (
    <PageFrame margin={{ top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' }}>
      <div style={{ fontWeight: 700, fontSize: '11pt' }}>[별첨 1] 기장 및 세무조정 세무서비스 보수표</div>

      <div style={sectionTitle}>1. 기장보수표 (부가가치세 별도)</div>
      <div style={unitNote}>(단위 : 원)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '14mm' }} rowSpan={2}>구분</th>
            <th style={{ ...th, width: '50mm' }} rowSpan={2}>업무내용 및 범위</th>
            <th style={{ ...th }} colSpan={2}>기준금액</th>
            <th style={{ ...th, width: '24mm' }}>月 보 수 기 준</th>
            <th style={{ ...th, width: '24mm' }}>月 보 수 기 준</th>
          </tr>
          <tr>
            <th style={th} colSpan={2}>(자산 또는 수입금액)</th>
            <th style={th}>개 인</th>
            <th style={th}>법 인</th>
          </tr>
        </thead>
        <tbody>
          {일반형구간.map((r, i) => (
            <tr key={`gen-${i}`}>
              {i === 0 && (
                <>
                  <td style={td} rowSpan={8}>일반형</td>
                  <td style={{ ...tdLeft, fontSize: '7.5pt' }} rowSpan={8}>
                    {일반형업무.map((line, j) => <div key={j}>{line}</div>)}
                  </td>
                </>
              )}
              <td style={td}>{r[0]}</td>
              <td style={td}>{r[1]}</td>
              <td style={tdNum}>{r[2]}</td>
              <td style={tdNum}>{r[3]}</td>
            </tr>
          ))}
          <tr>
            <td style={td} colSpan={2}>50억 초과</td>
            <td style={{ ...td, textAlign: 'left', fontSize: '7.5pt' }} colSpan={2}>
              50억 초과시 각 10억 증가시마다<br />8만원(법인 10만원)씩 가산
            </td>
          </tr>
          <tr>
            <td style={td}>고급형</td>
            <td style={{ ...tdLeft, fontSize: '7.5pt' }}>
              · 일반형 모두 포함<br />· 매월 결산<br />· 분기별 결산 분석(재무비율)
            </td>
            <td style={td} colSpan={2}>분기 결산</td>
            <td style={tdNum}>일반형 보수 +500,000 ~</td>
            <td style={tdNum}>일반형 보수 +1,000,000 ~</td>
          </tr>
          <tr>
            <td style={td}><b>Prior-ity</b><br />서비스</td>
            <td style={{ ...tdLeft, fontSize: '7.5pt' }}>
              · 고급형 업무 모두 포함<br />· 법인 관련 컨설팅<br />· 세금계산서 발급 대행<br />· 미수금 분석
            </td>
            <td style={td} colSpan={2}>월 결산</td>
            <td style={tdNum}>일반형 보수 +1,000,000 ~</td>
            <td style={tdNum}>일반형 보수 +2,000,000 ~</td>
          </tr>

          <tr>
            <td style={td} rowSpan={11}>기타 옵션</td>
            <td style={tdLeft} rowSpan={3}>세금계산서 발행</td>
            <td style={td} colSpan={2}>매월 5개 이하</td>
            <td style={tdNum} colSpan={2}>30,000</td>
          </tr>
          <tr>
            <td style={td} colSpan={2}>매월 10개 이하</td>
            <td style={tdNum} colSpan={2}>50,000</td>
          </tr>
          <tr>
            <td style={td} colSpan={2}>매월 10개 초과</td>
            <td style={tdNum} colSpan={2}>개당 5,000</td>
          </tr>

          <tr>
            <td style={tdLeft} rowSpan={5}>온라인 매출</td>
            <td style={td} colSpan={2}>5개 초과 ~ 10개 이하</td>
            <td style={tdNum}>50,000</td>
            <td style={tdNum}>100,000</td>
          </tr>
          <tr>
            <td style={td} colSpan={2}>10개 초과 ~ 15개 이하</td>
            <td style={tdNum}>70,000</td>
            <td style={tdNum}>150,000</td>
          </tr>
          <tr>
            <td style={td} colSpan={2}>15개 초과 ~ 20개 이하</td>
            <td style={tdNum}>100,000</td>
            <td style={tdNum}>200,000</td>
          </tr>
          <tr>
            <td style={td} colSpan={2}>20개 초과 ~ 30개 이하</td>
            <td style={tdNum}>150,000</td>
            <td style={tdNum}>300,000</td>
          </tr>
          <tr>
            <td style={td} colSpan={2}>30개 초과</td>
            <td style={tdNum}>200,000</td>
            <td style={tdNum}>400,000</td>
          </tr>

          <tr>
            <td style={tdLeft}>원천세 10인 이상</td>
            <td style={td} colSpan={2}>추가 10인당</td>
            <td style={tdNum} colSpan={2}>월 2만원씩 추가</td>
          </tr>
          <tr>
            <td style={tdLeft}>연말정산 10인 이상</td>
            <td style={td} colSpan={2}>10인 초과 인원당</td>
            <td style={tdNum} colSpan={2}>초과 인원 당 5,000</td>
          </tr>
          <tr>
            <td style={tdLeft}>구분경리</td>
            <td style={td} colSpan={4}>월 산정 보수의 50% 가산</td>
          </tr>
          <tr>
            <td style={tdLeft}>본지점</td>
            <td style={td} colSpan={4}>본점 및 지점 개별 매출액 기준으로 각각 산정</td>
          </tr>
        </tbody>
      </table>

      <div style={sectionTitle}>2. 세무조정보수표 (부가가치세 별도)</div>
      <div style={unitNote}>(단위 : 원)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '40mm' }}>수입금액</th>
            <th style={th}>개 인</th>
            <th style={th}>법 인</th>
          </tr>
        </thead>
        <tbody>
          {세무조정구간.map((r, i) => (
            <tr key={`adj-${i}`}>
              <td style={td}>{r[0]}</td>
              <td style={tdLeft}>{r[1]}</td>
              <td style={tdLeft}>{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={footnote}>※ 본지점이 있는 경우 지점당 계산</div>
      <div style={footnote}>
        ※ 성실신고 확인대상 : 위 조정료와 별도로 성실신고 확인비용(개인 200만원, 법인 250만원) 수수료 청구
      </div>
    </PageFrame>
  );
}
