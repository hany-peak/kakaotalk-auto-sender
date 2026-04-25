/**
 * @name 파밍
 */
const ExcelJS = require('exceljs');

async function exportFarmingExcel(rows, outputPath) {
  const headers = [
    '', '', '', '', // 빈 컬럼
    '옵션1', '수량', '구매자', '구매자휴대폰', '수취인', '수취인휴대폰', '수취인우편번호', '수취인주소', '배송메세지'
  ];
  const data = [headers];

  for (const row of rows) {
    data.push([
      '', '', '', '', // 빈 컬럼
      row['최초등록등록상품명/옵션명'] || '',
      row['구매수(수량)'] || '',
      row['구매자'] || '',
      row['구매자전화번호'] || '',
      row['수취인이름'] || '',
      row['수취인전화번호'] || '',
      row['우편번호'] || '',
      row['수취인 주소'] || '',
      row['배송메세지'] || ''
    ]);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('파밍');
  worksheet.addRows(data);

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