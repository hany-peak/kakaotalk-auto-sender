/**
 * @name 통영해풍
 */
const ExcelJS = require('exceljs');
const goodsInfo = require('../goods_info.json');
const 보내는사람 = '물맑은농수산';
const 보내는사람_전화번호 = '010-5813-2438';

const matchOptionQuota = (등록상품명, 수량, 등록옵션명) => {
    const goodInfo = goodsInfo.find(key => key.등록상품명 === 등록상품명);
    const 도매몰상품명 = goodInfo.도매몰상품명;
    const 옵션사이즈_최소단위로_변환 = goodInfo.옵션[등록옵션명];
  
    const 갯수 = 옵션사이즈_최소단위로_변환 * 수량;
    console.log(goodInfo, 도매몰상품명, 옵션사이즈_최소단위로_변환, 갯수)
    return `${도매몰상품명} ${갯수} kg`;
  }

async function exportFarmingExcel(rows, outputPath) {
  const headers = [
    '받는사람', '(공백)', '상품명1', '전화번호1', '전화번호2(없을시공백)', '주소', '보내는사람(지정)', '주소(지정)', '전화번호1(지정)', '배송메시지', '운송장번호', '택배사', '비고'
  ];
  const data = [headers];

  for (const row of rows) {
    data.push([
        row['수취인이름'] || '',
        '',
        matchOptionQuota(row['등록상품명'], row['구매수(수량)'],row['등록옵션명']),
        row['수취인전화번호'] || '',
        '',
        row['수취인 주소'] || '',
        보내는사람,
        '',
        보내는사람_전화번호,
        row['배송메세지'] || '',
        '',
        '',
        '',
    ]);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('파밍');
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
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
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