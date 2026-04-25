const orderList = require('../orderlist.json');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const PERSONAL_INFO_DIR = path.join(__dirname, 'personal-info');
const PERSONAL_INFO_PREFIX = 'personal-info-';
const PERSONAL_INFO_SUFFIX = '.xlsx';

const ORDER_INVOICE_HEADERS = [
  '번호', '묶음배송번호', '주문번호', '택배사', '운송장번호', '분리배송 Y/N', '분리배송 출고예정일', '주문시 출고예정일', '출고일(발송일)', '주문일',
  '등록상품명', '등록옵션명', '노출상품명(옵션명)', '노출상품ID', '옵션ID', '최초등록옵션명', '업체상품코드', '바코드', '결제액', '배송비구분',
  '배송비', '도서산간 추가배송비', '구매수(수량)', '옵션판매가(판매단가)', '구매자', '구매자전화번호', '수취인이름', '수취인전화번호', '우편번호', '수취인 주소',
  '배송메세지', '상품별 추가메시지', '주문자 추가메시지', '배송완료일', '구매확정일자', '개인통관번호(PCCC)', '통관용구매자전화번호', '기타', '결제위치'
];

function getLatestPersonalInfoFile() {
  const files = fs.readdirSync(PERSONAL_INFO_DIR)
    .filter(f => f.startsWith(PERSONAL_INFO_PREFIX) && f.endsWith(PERSONAL_INFO_SUFFIX));
  if (files.length === 0) return null;
  // 파일명에서 -뒤 숫자 추출 후 내림차순 정렬
  files.sort((a, b) => {
    const getNum = name => parseInt(name.split('-').pop().replace(PERSONAL_INFO_SUFFIX, ''), 10);
    return getNum(b) - getNum(a);
  });
  return path.join(PERSONAL_INFO_DIR, files[0]);
}

async function getPersonalInfoMap() {
  const latestFile = getLatestPersonalInfoFile();
  if (!latestFile) return new Map();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(latestFile);
  const worksheet = workbook.worksheets[0];
  // 헤더 인덱스 찾기
  let headerRow = worksheet.getRow(1);
  let nameIdx, phoneIdx, courierIdx, invoiceIdx;
  headerRow.eachCell((cell, colNumber) => {
    if (cell.value === '수취인이름') nameIdx = colNumber;
    if (cell.value === '수취인전화번호') phoneIdx = colNumber;
    if (cell.value === '택배사') courierIdx = colNumber;
    if (cell.value === '운송장번호') invoiceIdx = colNumber;
  });
  const infoMap = new Map();
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = row.getCell(nameIdx).value || '';
    const phone = row.getCell(phoneIdx).value || '';
    const courier = row.getCell(courierIdx).value || '';
    const invoice = row.getCell(invoiceIdx).value || '';
    if (name && phone) {
      infoMap.set(`${name}|${phone}`, { courier, invoice });
    }
  });
  return infoMap;
}

function getNowFileName() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `order-invoice-${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.xlsx`;
}

async function exportOrderInvoiceExcel(outputPath) {
  if (!outputPath) {
    outputPath = getNowFileName();
  }

  // personal-info 병합
  const infoMap = await getPersonalInfoMap();
  const mergedOrderList = orderList.map(order => {
    const key = `${order['수취인이름'] || ''}|${order['수취인전화번호'] || ''}`;
    if (infoMap.has(key)) {
      const { courier, invoice } = infoMap.get(key);
      return {
        ...order,
        '택배사': courier,
        '운송장번호': invoice
      };
    }
    return order;
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('주문서');

  worksheet.addRow(ORDER_INVOICE_HEADERS);
  mergedOrderList.forEach(order => {
    const row = ORDER_INVOICE_HEADERS.map(key => order[key] || '');
    worksheet.addRow(row);
  });

  worksheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' }
    };
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  worksheet.eachRow(row => {
    row.eachCell(cell => {
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

module.exports = { exportOrderInvoiceExcel };

exportOrderInvoiceExcel();