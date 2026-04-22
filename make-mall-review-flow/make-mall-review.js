const XLSX = require('xlsx');
const fs = require('fs');
const GOODS_INFO_PATH = 'make-mall-review-flow/goods_info.json';

// 엑셀 파일 읽기
const workbook = XLSX.readFile('테스트 리뷰 넣기.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 시트 데이터를 JSON으로 변환
const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

// "작성일"을 원하는 포맷의 텍스트로 변환
data.forEach(row => {
  if (row['작성일']) {
    // 날짜 문자열로 변환 (엑셀 날짜 포맷이 아닌 경우도 처리)
    const date = new Date(row['작성일']);
    if (!isNaN(date)) {
      // 원하는 포맷으로 변환
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      row['작성일'] = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    }
  }
});

// goods_info.json 읽기 (없으면 빈 배열)
let goodsInfo = [];
if (fs.existsSync(GOODS_INFO_PATH)) {
  goodsInfo = JSON.parse(fs.readFileSync(GOODS_INFO_PATH, 'utf-8'));
}
const existingNames = new Set(goodsInfo.map(item => item['등록상품명']));

// "등록상품명" 컬럼만 추출해서 새로운 상품명만 추가
let newCount = 0;
data.forEach(row => {
  const name = row['등록상품명'];
  if (name && !existingNames.has(name)) {
    goodsInfo.push({ '등록상품명': name });
    existingNames.add(name);
    newCount++;
  }
});

if (newCount > 0) {
  fs.writeFileSync(GOODS_INFO_PATH, JSON.stringify(goodsInfo, null, 2), 'utf-8');
  console.log(`${newCount}개의 새로운 상품명이 goods_info.json에 추가되었습니다.`);
} else {
  console.log('새로운 상품명이 없습니다.');
}

// 새 엑셀 파일로 저장
const newWorksheet = XLSX.utils.json_to_sheet(data);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
XLSX.writeFile(newWorkbook, '변환된_리뷰.xlsx');
