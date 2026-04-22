/**
 * @name 마스터
 */
const ExcelJS = require('exceljs');
const goodsInfo = require('../goods_info.json');
const 송하인명 = "물맑은제철농가과일리";
const 송하인번호 = "010-5813-2438";
const bannedKeyword = "삼배체";
/**
 * 마스터와 같은 경우 최소 수량 * 갯수로 전달해야 하기 때문에
 * 쿠팡 갯수를 최소 단위로 바꿔서 수량을 곱해줘야 한다.
 * 아기 상어 5kg 2개 주문들어온 경우
 * 마스터에서 아기 상어 1kg로 팔기 때문에
 * 아기 상어 1kg 10개로 바꿔줘야 한다.
 */
const matchOptionQuota = (등록상품명, 수량, 등록옵션명) => {
    const goodInfo = goodsInfo.find(key => key.등록상품명 === 등록상품명);
    const 도매몰상품명 = goodInfo.도매몰상품명;
    const 옵션사이즈_최소단위로_변환 = goodInfo.옵션[등록옵션명];

    const 갯수 = 옵션사이즈_최소단위로_변환 * 수량;
    console.log(goodInfo, 도매몰상품명, 옵션사이즈_최소단위로_변환, 갯수)
    return `${도매몰상품명} / ${갯수} 개`;
}

async function exportFarmingExcel(rows, outputPath) {
  const headers = [
    '송하인명', '송하인번호', '상품명/수량','주문자 성명', '주소', '주문자 전화번호', '메모'
  ];
  const data = [headers];

  for (const row of rows) {
    
    
    data.push([
      송하인명,
      송하인번호,
      matchOptionQuota(row['등록상품명'], row['구매수(수량)'],row['등록옵션명']),
      row['수취인이름'] || '',
      row['수취인 주소'] || '',
      row['수취인전화번호'] || '',
      row['배송메세지'] || ''
    ]);
  }

  // exceljs 워크북/워크시트 생성
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('마스터');
  worksheet.addRows(data);

  // 헤더(첫 번째 행)에만 노란색 배경과 bold 폰트 적용
  worksheet.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' } // 노란색
    };
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // 모든 셀에 검은색 테두리 적용
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  });

  await workbook.xlsx.writeFile(outputPath);
}

module.exports = {
  exportFarmingExcel
};