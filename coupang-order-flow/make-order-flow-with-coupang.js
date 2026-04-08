const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const GOODS_INFO_PATH = './goods_info.json';

// 1. 현재 디렉토리에서 order*.xlsx 파일 찾기
const files = fs.readdirSync('.')
  .filter(file => file.startsWith('order') && file.endsWith('.xlsx'));

if (files.length === 0) {
  console.log('order.xlsx 파일이 없습니다.');
  process.exit(1);
}

// 2. 가장 최신 파일 찾기 (날짜+번호 기준)
function parseOrderFileInfo(filename) {
  // 예: order20250722-2.xlsx → {date: '20250722', num: 2}
  const match = filename.match(/^order(\d{8})(?:-(\d+))?\.xlsx$/);
  if (match) {
    return {
      date: match[1],
      num: match[2] ? parseInt(match[2], 10) : 0
    };
  }
  return null;
}
let latestFile = files[0];
let latestInfo = parseOrderFileInfo(latestFile) || {date: '', num: -1};
for (const file of files) {
  const info = parseOrderFileInfo(file);
  if (!info) continue;
  if (
    info.date > latestInfo.date ||
    (info.date === latestInfo.date && info.num > latestInfo.num)
  ) {
    latestFile = file;
    latestInfo = info;
  }
}

// 3. 엑셀 파일 읽기
const workbook = xlsx.readFile(latestFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);

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

// goods_info.json 저장 전, 폴더가 없으면 생성
const dir = path.dirname(GOODS_INFO_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

if (newCount > 0) {
  fs.writeFileSync(GOODS_INFO_PATH, JSON.stringify(goodsInfo, null, 2), 'utf-8');
  console.log(`${newCount}개의 새로운 상품명이 goods_info.json에 추가되었습니다.`);
} else {
  console.log('새로운 상품명이 없습니다.');
}

// --- vendors_info.json 기반 vendor-flow 처리 및 엑셀 생성 ---
const VENDORS_INFO_PATH = path.join(__dirname, 'vendors_info.json');
let vendorsInfo = [];
if (fs.existsSync(VENDORS_INFO_PATH)) {
  vendorsInfo = JSON.parse(fs.readFileSync(VENDORS_INFO_PATH, 'utf-8'));
}
let remainingGoods = [...goodsInfo];

// --- 주문 처리 이력(orderlist.json) 관리 ---
const ORDER_LIST_PATH = path.join(__dirname, 'orderlist.json');
let orderList = [];
if (fs.existsSync(ORDER_LIST_PATH)) {
  orderList = JSON.parse(fs.readFileSync(ORDER_LIST_PATH, 'utf-8'));
}
function isDuplicateOrder(row) {
  return orderList.some(
    o => o['묶음배송번호'] === row['묶음배송번호'] && o['주문번호'] === row['주문번호']
  );
}
function addOrderToList(row, vendorName) {
  const newRow = { ...row, vendorType: vendorName };
  orderList.push(newRow);
}
let updated = false;

vendorsInfo.forEach((vendor) => {
  if (!vendor.isUsed) return;
  const filePath = path.join(__dirname, '도매몰및농가정보액셀처리기', vendor.file);
  if (!fs.existsSync(filePath)) return;
  const key = vendor.key;
  const matched = remainingGoods.filter(item => item['등록상품명'] && item['등록상품명'].includes(key));
  remainingGoods = remainingGoods.filter(item => !matched.includes(item));
  console.log(`\n[Vendor ${vendor.name}] key: ${key}`);
  if (matched.length > 0) {
    matched.forEach(item => console.log(' -', item['등록상품명']));
    try {
      const vendorModule = require(filePath);
      const exportFunc = vendorModule.exportFarmingExcel;
      // 실제 주문 데이터에서 해당 상품명에 해당하는 주문 row 추출 (data에서)
      let matchedRows = data.filter(row => matched.some(g => row['등록상품명'] === g['등록상품명']));
      // 중복 주문(묶음배송번호+주문번호) 제거 및 로그
      const filteredRows = [];
      matchedRows.forEach(row => {
        if (isDuplicateOrder(row)) {
          console.log(`  [중복제외] 묶음배송번호:${row['묶음배송번호']} 주문번호:${row['주문번호']}`);
        } else {
          filteredRows.push(row);
          addOrderToList(row, vendor.name);
          updated = true;
        }
      });
      if (filteredRows.length > 0) {
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        // 발주서/도매몰명/파일명.xlsx 경로 생성
        const orderRootDir = path.join(__dirname, '발주서');
        const vendorDir = path.join(orderRootDir, vendor.name);
        if (!fs.existsSync(orderRootDir)) fs.mkdirSync(orderRootDir);
        if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir);
        const outputName = `${vendor.name}_발주_${dateStr}.xlsx`;
        const outputPath = path.join(vendorDir, outputName);
        exportFunc(filteredRows, outputPath);
        console.log(`  → ${outputPath} 파일 생성 완료`);
      } else {
        console.log('  (새로운 주문 없음, 엑셀 미생성)');
      }
    } catch (e) {
      console.log('  (엑셀 export 함수 없음 또는 오류)', e.message);
    }
  } else {
    console.log(' (일치하는 상품명이 없습니다.)');
  }
});
if (updated) {
  fs.writeFileSync(ORDER_LIST_PATH, JSON.stringify(orderList, null, 2), 'utf-8');
  console.log(`\norderlist.json이 갱신되었습니다.`);
}
// --- END ---

