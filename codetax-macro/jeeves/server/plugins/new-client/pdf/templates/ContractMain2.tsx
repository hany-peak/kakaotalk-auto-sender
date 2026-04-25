import * as React from 'react';
import * as path from 'node:path';
import { PageFrame } from './shared/PageFrame';
import type { TemplateProps } from './shared/TemplateProps';

const STAMP_URL = `file://${path.join(__dirname, '..', 'assets', 'stamp.png')}`;

const clauseTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '8pt',
  marginTop: '1.2mm',
  marginBottom: '0.4mm',
};
const subItem: React.CSSProperties = {
  fontSize: '7pt',
  lineHeight: 1.22,
  paddingLeft: '6mm',
};
const sectionBlock: React.CSSProperties = {
  fontSize: '7pt',
  lineHeight: 1.22,
  paddingLeft: '3mm',
  marginBottom: '0.2mm',
};

const tdC: React.CSSProperties = {
  border: '1px solid #555',
  fontSize: '7pt',
  padding: '0.5mm 1mm',
  textAlign: 'center',
};

export function ContractMain2({ record }: TemplateProps) {
  const feeText =
    typeof record.bookkeepingFee === 'number'
      ? record.bookkeepingFee.toLocaleString('ko-KR')
      : '_______';
  return (
    <PageFrame margin={{ top: '12mm', right: '14mm', bottom: '12mm', left: '14mm' }}>
      <div style={clauseTitle}>제 1 조 (세무서비스의 범위)</div>
      <div style={sectionBlock}>
        ① 수임자는 세무사법에서 정한 세무대리인으로서 제공하는 세무서비스의 업무범위는 아래의 항목으로 한정한다. 위임자는 본 계약에서 한정한 업무의 범위를 벗어나는 세무서비스를 의뢰할 경우 별도의 계약을 하여야 한다.
      </div>

      <div style={{ ...sectionBlock, fontWeight: 700 }}>[기본 업무]</div>
      <div style={subItem}>1. 법인세(또는 소득세) 신고를 위한 기장대리(또는 장부작성)(이하 "일반기장업무"라 함)</div>
      <div style={subItem}>2. 세무신고를 위한 결산업무 (년1회) (이하 "결산업무"라 함)</div>
      <div style={subItem}>3. 세무조정업무(이하 "세무조정업무"라 함)</div>
      <div style={subItem}>4. 법인세(또는 소득세) 및 부가가치세 신고업무</div>
      <div style={subItem}>5. 원천세 신고 및 연말정산 (10인 이내)</div>
      <div style={subItem}>6. 4대보험 신고관련 업무(자격취득, 자격상실, 보수총액신고)</div>

      <div style={sectionBlock}>② 위 ①항의 범위를 포함하지 않는 업무범위는 아래와 같다.</div>
      <div style={sectionBlock}>
        1. 성실신고확인 &nbsp; 2. 세무조사입회대리 &nbsp; 3. 조세불복업무 &nbsp; 4. 세무(경영)자문 &nbsp; 5. 세무경영컨설팅 &nbsp; 6. 기타 1항에 포함되지 않는 업무
      </div>
      <div style={sectionBlock}>
        단, 법인세 및 소득세 결산 이후 세무조정을 통해 신고 업무는 별도의 조정료 청구로 지급되어야 한다.
      </div>

      <div style={sectionBlock}>
        ③ 위 ①항 2호의 결산업무의 시기는 아래와 같다. 다만, 해당 결산시기 이외에 추가적인 결산을 요청하는 경우에는 별도의 수수료를 지급하여야 한다.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '2mm 0 2mm 4mm' }}>
        <tbody>
          <tr>
            <td style={{ ...tdC, width: '24mm' }} rowSpan={2}>
              일반<br />사업자
            </td>
            <td style={{ ...tdC, width: '18mm' }}>개인</td>
            <td style={tdC}>과세기간 종료일의 익년 5월 1일 ~ 5월 31일</td>
          </tr>
          <tr>
            <td style={tdC}>법인</td>
            <td style={tdC}>과세기간 종료일로부터 3개월이 되는 달의 1일 ~ 말일</td>
          </tr>
          <tr>
            <td style={{ ...tdC, width: '24mm' }} rowSpan={2}>
              성실신고<br />대상자
            </td>
            <td style={tdC}>개인</td>
            <td style={tdC}>과세기간 종료일의 익년 6월 1일 ~ 6월 30일</td>
          </tr>
          <tr>
            <td style={tdC}>법인</td>
            <td style={tdC}>과세기간 종료일로부터 4개월이 되는 달의 1일 ~ 말일</td>
          </tr>
        </tbody>
      </table>

      <div style={clauseTitle}>제 2 조 (업무수행방법)</div>
      <div style={sectionBlock}>
        제1조 ①항에 정한 업무의 해당 지출증빙 및 기타 세무서류는 위임자가 수임자에게 전달(수임자가 정한 SNS 메신저, 이메일, 방문, 우편, 택배 외)한다.
      </div>

      <div style={clauseTitle}>제 3 조 (보수규정)</div>
      <div style={sectionBlock}>
        제1조 각 호의 보수는 "[별첨 1] 기장 및 세무조정 세무서비스 보수표"에 근거하여 각각 다음과 같이 하여 위임자가 부담한다.
      </div>
      <div style={sectionBlock}>
        ③ 계약일 전 기간분의 기장에 대한 보수(이하 '소급기장수'라 칭함)는 금 {feeText}(VAT포함)원으로 하고, 등 금액은 계약과 동시에 지급한다.
      </div>
      <div style={sectionBlock}>
        ② <b>"결산업무"</b> 및 <b>"세무조정업무"</b>의 보수(이하 <b>"세무조정보수"</b>라 함)는 전항의 보수와는 별도로 종합소득세(위임자가 법인인 경우 법인세) 신고 시 <b>[별첨 1의 2] (세무조정보수표)</b>를 별도로 청구한다. <b>[별첨 1의 2] (세무조정보수표)</b>는 물가상승률 및 인건비상승률 등에 따라 조정될 수 있다.
      </div>

      <div style={clauseTitle}>제 3 조의 1 (보수의 지급)</div>
      <div style={sectionBlock}>
        ① 제3조 ①항에 따른 매월 <b>"세무서비스의 보수"</b>의 지급일은 익월 <b>매월 25일</b>로 정하며, 제3조 ②항에 따른 <b>"세무조정보수"</b>는 <u>제1조 ③항에서 정하는 달의 말일까지</u> 지급한다.
      </div>
      <div style={sectionBlock}>
        ② 위 ①항의 보수는 위임자가 수임자의 은행계좌로 송금하는 것을 원칙으로 한다. 다만 수임자는 위임자가 자동이체출금에 동의하는 경우 자동이체 출금할 수 있다. 이 경우 위임자는 <b>"자동이체 이용 신청서"</b>에 기명날인 또는 서명하여 수임자에게 제출하여야 한다. (단, 기제출한 신청서가 있는 경우 그것으로 갈음할 수 있다.)
      </div>

      <div style={clauseTitle}>제 4 조 (위임자의 협력의무)</div>
      <div style={sectionBlock}>
        ① 위임자는 수임자가 제1조 ①항에서 정한 위임업무의 수행에 필요한 정보(이하 <b>"세무정보"</b>라 함)를 제공하여야 한다. 위임자가 세무정보의 제공은 지출증빙자료, 서류, 기록, 설명, 기타자료 등의 다양한 형태로 수임자에게 제공할 수 있다.
      </div>
      <div style={sectionBlock}>
        ② 위임자는 수임자가 위임업무의 수행에 필요한 정보 등을 요청할 경우 신속하고, 적시에 제공하여야 한다. 만일 위임자가 제공한 세무정보의 제공시기가 필요한 시기를 경과한 경우 또는 1기간경과 후 추가적인 세무정보가 제공되는 경우 그에 따른 불이익(가산세, 과태료 등)은 위임자가 부담한다.
      </div>
      <div style={sectionBlock}>③ 위임자의 자료제공 부족, 오류 또는 사실과 다른 자료 등에 기인한 불이익은 위임자가 부담한다.</div>
      <div style={sectionBlock}>④ 위임자는 의뢰한 사업 등에 중대한 변화가 있을 경우 지체 없이 수임자에게 통지하여야 한다.</div>
      <div style={sectionBlock}>
        ⑤ 천재지변 기타 이에 준하는 사유로 본 계약이 정한 위임업무를 이행할 수 없는 경우 그 책임은 위임자와 수임자 쌍방에게 없는 것으로 한다.
      </div>

      <div style={clauseTitle}>제 5 조 (세무정보 제공방법)</div>
      <div style={sectionBlock}>① 위임자는 매출액, 부채, 자산 등의 계량적 정보와 비계량적 정보의 제공은 반드시 서면으로 한다.</div>
      <div style={sectionBlock}>② 위임자는 사업과 관련된 개인(각종 인건비 관련)정보의 제공은 반드시 서면으로 제공하여야 한다.</div>

      <div style={clauseTitle}>제 6 조 (정보이용동의)</div>
      <div style={sectionBlock}>
        ① 위임자는 국세청 홈택스에서 수임자가 수임거래처로 등록하고 위임업무에 필요한 위임자에 관련된 정보의 조회 및 사용하는데 동의한다. 이 경우 위임자는 <b>[별첨 3](개인(세무·회계)정보 수집·이용·제공 동의서)</b>에 기명날인 또는 서명하여 수임자에게 제출한다.
      </div>
      <div style={sectionBlock}>
        ② 세무정보제공공동을 위해서 법인사업자는 반드시 국세청홈택스를 통해서 세무정보이용동의(법인 공인인증서 필요)의 절차에 협조해야하며, 개인사업자의 경우에는 법인사업자와 동일하게 동의하거나 "홈택스 세무대리인이용신청서"와 인감증명서를 첨부하여 제공하여야 한다.
      </div>
      <div style={sectionBlock}>
        ③ 위임자는 제5조의 1에 따라 수입금액과 관련된 정보제공을 아래와 같은 방법으로 위임할 수 있다.(신용카드, 현금영수증 가맹점의 경우에 한정한다)
      </div>
      <div style={subItem}>1. 각 신용카드회사를 통한 매출금액의 조회(신용카드매출액에 한함)</div>
      <div style={subItem}>2. 국세청 현금영수증 홈페이지를 통한 조회(현금영수증매출액에 한함)</div>
      <div style={subItem}>3. 신용카드밴더(VAN)사를 통한 매출금액의 조회(신용카드 및 현금영수증매출액에 한함)</div>
      <div style={sectionBlock}>④ 위 ③항의 경우 위임자는 수임자가 조회에 필요한 아이디(ID)와 비밀번호(PW)를 제공해야한다.</div>

      <div style={clauseTitle}>제 7 조 (수임자의 성실의무)</div>
      <div style={sectionBlock}>① 수임자는 세무와 회계의 전문가적 자질과 신의로서 성실하게 위임한 업무를 수행한다.</div>
      <div style={sectionBlock}>② 수임자는 업무상 알게 된 위임자의 영업비밀을 정당한 사유 없이 타인에게 누설하거나 도용하지 아니 한다.</div>
      <div style={sectionBlock}>
        ③ 수임자는 위임자가 제공한 정보 등에 의해 합리적이고 공정·타당한 회계기준(중소기업의 경우 중소기업회계처리기준 포함)과 관련 조세 법률에 따라 성실하게 업무를 수행하여야 한다.
      </div>

      <div style={clauseTitle}>제 8 조 (세무정보의 보관 및 폐기)</div>
      <div style={sectionBlock}>
        ① 수임자는 위임자의 각종 신고관련서류 및 증빙서류 등은 위임자와 수임자 상호합의 하에 그 보관방법 및 장소를 정할 수 있다.
      </div>
      <div style={sectionBlock}>
        ② 수임자의 책임 하에 위임자의 각종 세무정보가 보관되는 경우 수임자는 제1조 ①항의 범위 외에 위임자의 정보가 사용 또는 누설되지 않도록 주의를 기울려야 한다.
      </div>
      <div style={sectionBlock}>
        ③ 제8조 ②항에 따라 해지되는 경우 위임자와 관련된 일체의 정보는 위임자에게 인계한다. 인계 이후 수임자는 어떠한 보관의무도 지지 않으며 위임자 또한 인계된 정보에 대해서는 수임자에게 어떠한 요구나 책임도 지지 않는다.
      </div>
      <div style={sectionBlock}>
        ④ 제8조 ④항에 따라 해지되는 경우 수임자는 위임자 관련 일체의 정보에 대한 보관책임을 지지 않는 것으로 한다. 이로 인한 불이익은 위임자가 감수한다.
      </div>
      <div style={sectionBlock}>
        위 ③항 및 ④항에서 위임자의 정보는 아래와 같다. 아래의 정보 이외의 수임자가 업무 편의를 위해 작성한 각종 세무신고서 서류는 대상이 아니며, 계약해지와 동시에 모든 정보를 폐기한다.
      </div>
      <div style={subItem}>1. 위임자가 제공한 증빙서류(세금계산서, 계산서, 신용카드영수증, 현금영수증, 기타일반영수증)</div>
      <div style={subItem}>2. 위임자가 제공한 개인정보(성명, 주민번호, 주소)</div>

      <div style={clauseTitle}>제 9 조 (기타)</div>
      <div style={sectionBlock}>
        ① 본 계약에 명시되지 아니한 사항 및 계약내용의 변경이 발생하게 된 경우에는 건전한 사회통념 및 상관습에 따라 위임자와 수임자 간 상호 협의하여 결정한다.
      </div>
      <div style={sectionBlock}>
        ② 본 계약에 의해서 신고 또는 작성되는 일체의 서류는 위임자가 제공한 정보에 따라 신고 또는 작성되는 것으로 사실을 있는 그대로 반영하는데 한계가 있음을 명시한다.
      </div>

      <div style={{ fontSize: '8pt', marginTop: '3mm', marginBottom: '3mm' }}>
        위 사실을 증명하기 위해 본 계약서를 2통 작성하여 서명 또는 날인하고 위임자와 수임자는 각각 1통씩 보관한다.
      </div>

      <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse', marginTop: '3mm' }}>
        <tbody>
          <tr>
            <td style={{ width: '40mm', padding: '2mm 0', textAlign: 'center' }}>위임자 또는 대리인</td>
            <td style={{ padding: '2mm 0', textAlign: 'center' }}>
              {`${record.companyName} ${record.representative} 대표님`}
            </td>
            <td style={{ width: '30mm', padding: '2mm 0', textAlign: 'center' }}>(인/서명)</td>
          </tr>
          <tr>
            <td style={{ width: '40mm', padding: '4mm 0 2mm', textAlign: 'center' }}>수임자 또는 대리인</td>
            <td style={{ padding: '4mm 0 2mm', textAlign: 'center' }}>
              코드세무회계 본점 대표 세무사 정주희
            </td>
            <td
              style={{
                width: '30mm',
                padding: '4mm 0 2mm',
                textAlign: 'center',
                position: 'relative',
                verticalAlign: 'middle',
              }}
            >
              <span style={{ position: 'relative', display: 'inline-block' }}>
                (인/서명)
                <img
                  src={STAMP_URL}
                  alt="stamp"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '15mm',
                    height: '15mm',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.85,
                  }}
                />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </PageFrame>
  );
}
