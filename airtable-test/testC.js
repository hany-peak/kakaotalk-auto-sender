/**
 * * 매월 1일 DataBase 테이블내에 최신 데이터를 기준으로
 * [당해년도 당해 월 11일 오전 1시]
 * - DataBase 최신 테이블 값 -> 원천세 해당 월 테이블에 업데이트한다.
 */

// ... (기존 KST 계산 및 변수 정의 로직은 동일)

const PAT = input.secret("pat");
const 원천세_2025년_베이스ID = "appSyEp5tL3yUMTry";
const 원천세_2026년_베이스ID = "appQkz7klgVKHw8aQ";
const 원천세_베이스ID = { 원천세_2025년_베이스ID, 원천세_2026년_베이스ID };

const 현재년도 = '2026';
const 현재월 = '8';

const 선택된_원천세_베이스_ID =`원천세_${현재년도}년_베이스ID`;
const TARGET_BASE_ID = 원천세_베이스ID[선택된_원천세_베이스_ID];
const TARGET_TABLE_NAME = `${현재월}월`;

const currentTable = base.tables.find(item => item.name === currentYear.toString());
const 적용할_필드명_리스트 = [
    '업체명', '관리번호', '실무자', '상태', '업무범위', '기업구분', '과세구분', '원천구분', '급여일',
];
const sourceTableName = currentTable?.name || '';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${TARGET_BASE_ID}/${TARGET_TABLE_NAME}`;

const MAX_RECORDS_PER_REQUEST = 10;

try {
    if (!TARGET_BASE_ID) {
        throw new Error(`대상 베이스 ID를 찾을 수 없습니다: ${선택된_원천세_베이스_ID}`);
    }

    // 1. 소스 테이블에서 모든 레코드 추출 및 API 형식으로 변환
    const 당해년도DataBase = base.getTable(sourceTableName);
    const res = await 당해년도DataBase.selectRecordsAsync({ fields: 적용할_필드명_리스트 });
    const records = res?.records || [];
    
    // bulkDataForAPI는 { fields: { ... } } 형태의 배열
    const bulkDataForAPI = records.map(record => {
        const fields = {};
        for (const fieldName of 적용할_필드명_리스트) {
            // getCellValue 사용: 데이터 타입 유지
            fields[fieldName] = record.getCellValue(fieldName); 
        }
        return { fields: fields };
    });
    
    if (bulkDataForAPI.length === 0) {
        console.log("소스 테이블에서 추출된 데이터가 없어 처리 종료.");
        return;
    }

    // ----------------------------------------------------
    // 2. [핵심 로직] 대상 테이블에서 이미 존재하는 '관리번호' 목록 가져오기 (GET)
    // ----------------------------------------------------
    const existingManagementNumbers = new Set();
    let offset = null; // 페이지네이션을 위한 오프셋
    let recordsFetched = 0;

    console.log("[GET] 대상 테이블에서 기존 관리번호 목록 검색 시작...");

    do {
        let searchURL = `${AIRTABLE_API_URL}?fields[]=관리번호&pageSize=100`; // 관리번호 필드만 가져옴
        if (offset) {
            searchURL += `&offset=${offset}`;
        }

        const getResponse = await fetch(searchURL, {
            method: "GET",
            headers: { 'Authorization': `Bearer ${PAT}` }
        });

        if (!getResponse.ok) {
            const errorDetails = await getResponse.text();
            throw new Error(`기존 레코드 검색 오류! Status: ${getResponse.status}. Details: ${errorDetails}`);
        }
        
        const data = await getResponse.json();
        
        // existingManagementNumbers Set에 모든 관리번호 추가
        for (const record of data.records) {
            const mgmtNum = record.fields['관리번호'];
            if (mgmtNum) {
                existingManagementNumbers.add(mgmtNum);
            }
        }
        recordsFetched += data.records.length;
        offset = data.offset || null; // 다음 페이지 오프셋 설정

    } while (offset); // offset이 있는 동안 반복

    console.log(`[GET] 대상 테이블에서 총 ${recordsFetched}개의 레코드 확인 완료.`);
    console.log(`[GET] 중복 제외된 관리번호 수: ${existingManagementNumbers.size}`);

    // 3. 삽입해야 할 레코드만 필터링
    const recordsToInsert = bulkDataForAPI.filter(item => {
        const mgmtNum = item.fields['관리번호'];
        return mgmtNum && !existingManagementNumbers.has(mgmtNum);
    });

    if (recordsToInsert.length === 0) {
        console.log("새롭게 삽입할 레코드가 없습니다. 마이그레이션 완료 또는 재실행 필요 없음.");
        return;
    }

    // ----------------------------------------------------
    // 4. [벌크 POST] 필터링된 레코드만 10개씩 분할하여 전송
    // ----------------------------------------------------
    const totalRecordsToInsert = recordsToInsert.length;
    let successfulRecordsCount = 0;
    
    console.log(`[POST] 새롭게 삽입할 레코드 총 ${totalRecordsToInsert}개, 10개씩 분할하여 전송 시작.`);

    for (let i = 0; i < totalRecordsToInsert; i += MAX_RECORDS_PER_REQUEST) {
        const chunk = recordsToInsert.slice(i, i + MAX_RECORDS_PER_REQUEST);

        const requestBody = {
            records: chunk,
            typecast: true,
        };

        const chunkIndex = i / MAX_RECORDS_PER_REQUEST + 1;
        const totalChunks = Math.ceil(totalRecordsToInsert / MAX_RECORDS_PER_REQUEST);
        console.log(`[API 요청] 청크 ${chunkIndex}/${totalChunks} 전송 (레코드 수: ${chunk.length})`);

        const res = await fetch(AIRTABLE_API_URL, {
            method: "POST", // 삽입 (Insert)
            headers: {
                'Authorization': `Bearer ${PAT}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorDetails = await res.text();
            console.error(`❌ 청크 ${chunkIndex} 처리 중 오류 발생!`);
            throw new Error(`벌크 POST 오류! Status: ${res.status}. Details: ${errorDetails}`);
        }
        
        const data = await res.json();
        successfulRecordsCount += data.records.length;
    }

    console.log(`✅ 마이그레이션 성공! 총 ${successfulRecordsCount}개의 레코드가 새로 삽입되었습니다.`);
    output.set('totalRecordsInserted', successfulRecordsCount);

} catch (e) {
    console.error("--- 최종 오류 발생 (디버깅) ---");
    if (e instanceof Error) {
        console.error("❌ 오류 메시지:", e.message);
        console.error("❌ 오류 스택:", e.stack); 
    } else if (typeof e === 'object' && e !== null) {
        console.error("❌ 오류 객체 전체 (JSON):", JSON.stringify(e, null, 2));
    } else {
        console.error("❌ 알 수 없는 형식의 오류:", e);
    }
    console.error("---------------------------------");
}