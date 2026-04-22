const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function printExcelData() {
  const filePath = path.join(__dirname, 'data.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length < 4) {
    console.log('데이터가 부족합니다.');
    return;
  }

  const keys = ['담당자', '거래처명', '사업자번호', '구분', '과세유형', '세금계산서매출_공급가액', '세금계산서매출_세액', '세금계산서_합계금액', '계산서매출_공급가액', '카드매출_신용카드/기타결제', '카드매출_구매전용/카드매출', '카드매출_비과세금액', '카드매출_합계금액', '현금영수증매출_공급가액', '현금영수증매출_세액', '현금영수증매출_봉사료', '현금영수증_합계금액', '제로페이_매출금액', '온라인매출_판매(결제)대행업체 건수', '온라인매출_매출금액', '수출실적_원화환산금액', '세금계산서매입_공급가액', '세금계산서매입_세액', '세금계산서매입_합계금액', '계산서매입_공급가액', '카드매입(공제대상)_공급가액', '카드매입(공제대상)_세액' ,'카드매입(공제대상)_합계금액', '카드매입(전체)_공급가액', '카드매입(전체)_세액', '카드매입(전체)_합계금액', '현금영수증매입(공제대상)_공급가액', '현금영수증매입(공제대상)_세액', '현금영수증매입(공제대상)_합계금액', '현금영수증매입(전체)_공급가액', '현금영수증매입(전체)_세액', '현금영수증매입(전체)_합계금액', '화물복지카드(공제대상)_공급가액', '화물복지카드(공제대상)_세액', '화물복지카드(공제대상)_합계금액', '화물복지카드(전체)_공급가액', '화물복지카드(전체)_세액', '화물복지카드(전체)_합계금액']
  const dataList = rows.slice(3).map(row => {
    const obj = {};
    keys.forEach((key, idx) => {
      obj[key] = row[idx];
    });
    return obj;
  });

  // JSON 리스트를 파일로 저장
  fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(dataList, null, 2), 'utf-8');
  console.log('data.json 파일로 저장되었습니다.');
}

// 함수 실행
printExcelData();