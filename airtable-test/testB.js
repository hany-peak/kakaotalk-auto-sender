/**
 * 데이터베이스에 새로운 사업자가 추가된 경우
 * -> 원천세 값 변경
 */

console.log(`Hello, ${base.name}!`);

const config = input.config();

const 원천세_2025년_베이스ID = "appSyEp5tL3yUMTry";
const 원천세_2026년_베이스ID = "appQkz7klgVKHw8aQ";

/**
 * - 1. 새로 생성하려는 경우,
 * 기존 관리번호로 조회 후 있는 경우, 생성하지 않는다.
 */


// 업무범위, 기업구분, 과세구분, 원천구분, 급여일, 
const 업체명 = config.업체명;
const 관리번호 = config.관리번호;
const 업무범위 = config.업무범위;
const 기업구분 = config.기업구분;
const 과세구분 = config.과세구분;
const 원천구분 = config.원천구분;
const 급여일 = config.급여일;
// const 급여일 = config.
// const 대표자 = config.대표자;
// const 전화번호 = config.전화번호;
// const 사업자번호 = config.사업자번호;
// const 대표자주민번호 = config.대표자_주민번호;
// const 기장료 = config.기장료;
const 실무자 = config.실무자;
const 상태 = config.상태;

/**
 * [DataBase]에 신규 데이터가 [입력]되는 경우
 * 필수 추출 항목만 필터링하여 매월 생성되는
 * 해당 월의 [2025년 원천세] 테이블로
 * 자동 연동 및 업데이트 되도록 시스템을 구축하고 싶습니다.
 */

const 필수추출항목 = {
    업체명,
    // 관리번호,
    //대표자,
    // 전화번호,
    // 사업자번호,
    // 대표자주민번호,
    // 기장료,
    실무자,
    상태,
    업무범위,
    기업구분,
    과세구분,
    원천구분,
    급여일
};

// --- 이전 달 계산 로직 ---
// 현재 KST 시각을 가지는 Date 객체
const nowInKST = new Date();

// Intl.DateTimeFormat을 사용하여 KST 기준으로 연, 월, 일을 숫자 문자열로 추출
// 'en-US' 로케일과 'numeric' 또는 '2-digit'을 사용하여 숫자만 추출합니다.

// 1. 현재 연도 (YYYY)
const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'Asia/Seoul'
}).format(nowInKST);

// 2. 현재 월 (M 또는 MM)
// 'numeric'을 사용하면 1자리 월(예: 8)로, '2-digit'을 사용하면 2자리 월(예: 08)로 나옵니다.
const currentMonth = new Intl.DateTimeFormat('en-US', {
    month: 'numeric', // 요청에 따라 숫자만 나오도록 'numeric' 사용
    timeZone: 'Asia/Seoul'
}).format(nowInKST);

// 3. 현재 일 (D 또는 DD)
const currentDay = new Intl.DateTimeFormat('en-US', {
    day: 'numeric', // 요청에 따라 숫자만 나오도록 'numeric' 사용
    timeZone: 'Asia/Seoul'
}).format(nowInKST);

// --- 이전 달 계산 로직 (기존 로직 유지) ---

// KST 기준의 Date 객체를 생성 (이전 달 계산을 위한 기반)
// 로케일 기반의 toLocaleString을 사용하여 KST 시간 문자열을 생성하고 Date 객체를 다시 만듭니다.
const currentKstDate = new Date(nowInKST.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

// 현재 월을 0-11 범위로 가져옵니다.
const currentMonthIndex = currentKstDate.getMonth();
const currentFullYear = currentKstDate.getFullYear();

let previousMonthYear;
let previousMonthIndex; // 0-11

if (currentMonthIndex === 0) {
    // 현재 1월(Index 0)이면, 이전 달은 작년 12월(Index 11)입니다.
    previousMonthYear = currentFullYear - 1;
    previousMonthIndex = 11;
} else {
    // 그 외의 경우, 이전 달은 현재 연도의 (현재 월 - 1)입니다.
    previousMonthYear = currentFullYear;
    previousMonthIndex = currentMonthIndex - 1;
}

// 4. 지난 달의 연도 (YYYY) - 숫자 문자열
const previousYear = String(previousMonthYear);

// 5. 지난 달의 월 (M 또는 MM) - 숫자 문자열
// Index(0-11)에 1을 더한 값 (1~12)
const previousMonth = String(previousMonthIndex + 1);


console.log(`--- KST 현재 시점 정보 (숫자만) ---`);
console.log(`현재 연 (YYYY): ${currentYear}`);
console.log(`현재 월 (M): ${currentMonth}`);
console.log(`현재 일 (D): ${currentDay}`);
console.log(`------------------------`);
console.log(`--- 원천세 마감 대상(익월 10일 마감) (숫자만) ---`);
console.log(`지난 달 연도 (YYYY): ${previousYear}`);
console.log(`지난 달 월 (M): ${previousMonth}`);

/**
 * 데이터 수정/반영 마감 기한 : 원천세 해당 월의 익월 10일까지 `[DataBase]`에서의 수정 사항만
 * `[2025년 원천세]` 월별 테이블에 자동 반영되며, 이후 시점부터는 반영되지 않습니다. 
 *  ex) `2025년 원천세>11월` : 12월 10일 23:59:59 까지만 업데이트가 허용됨.
 *  > 익월 10일이 주말 또는 공휴일일 경우 마감일을 다음 영업일로 연장*
 */

const 이전월을_변경해야하는_경우 = Number(currentDay) <= 10;
const 변경해야할_원천세_월 = 이전월을_변경해야하는_경우 ? previousMonth : currentMonth;

// 만약에 2026년 1월 9일에 데이터가 생성되는 경우, 25년 12월 데이터를 변경해야 하기 때문에
// 이전년도가 현재년도와 다른 경우 
let 변경해야할_원천세_연도 = currentYear;
if (이전월을_변경해야하는_경우) {
    변경해야할_원천세_연도 = previousYear;
}

console.log("변경해야할_원천세_연도: ", 변경해야할_원천세_연도);
console.log("변경해야할_원천세_월: ", 변경해야할_원천세_월);


const PAT = input.secret("pat");
const 원천세_베이스_ID =`원천세_${변경해야할_원천세_연도}_베이스ID`;
const TARGET_BASE_ID = `${원천세_베이스_ID}`;
const TABLE_NAME = `${변경해야할_원천세_월}월`;
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${TARGET_BASE_ID}/${TABLE_NAME}`;


const dataToUpsert = [{
    fields: 필수추출항목,
}];

const requestBody = {
    records: dataToUpsert,
    typecast: true
}

try {
    const SEARCH_PARAM = encodeURIComponent(`{관리번호} = '${관리번호}'`);
    const SEARCH_URL = `${AIRTABLE_API_URL}?filterByFormula=${SEARCH_PARAM}`;
    const response = await fetch(SEARCH_URL, {
        method: "GET",
        headers: {
            'Authorization': `Bearer ${PAT}`,
            'Content-Type': 'application/json',
        },
    })
    
    if(!response.ok) {
        throw new Error(`검색 오류! Status: ${response.status}.`);
    }
    // 응답 본문을 JSON으로 파싱
    const data = await response.json();
    if (data.records && data.records.length > 0) {
        const recordId = data?.records[0]?.id;
        const filedsToUpdate = 필수추출항목;
        // 해당 항목 업데이트
        if (recordId) {
            await updateRecord(recordId, filedsToUpdate);
        }
    }

    // 스크립트 결과를 다음 Automation 단계로 넘기기 위해 출력
    output.set('upsertedRecords', data.records);

} catch (error) {
    console.error("레코드 검색 중 오류 발생:", error.message);        
}



async function updateRecord(recordId, updateFields) {
    
    const requestBody = {
        records: [{
            id: recordId,
            fields: updateFields // { "필드명": "값" } 형태
        }],
        typecast: true // 필드 타입 자동 변환 옵션 (권장)
    };

    try {
        const response = await fetch(AIRTABLE_API_URL, {
            method: "PATCH", // 🚨 부분 업데이트는 PATCH 메서드를 사용합니다.
            headers: {
                'Authorization': `Bearer ${PAT}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            // 오류 발생 시 상세 오류 메시지 확인
            const errorDetails = await response.json();
            throw new Error(`업데이트 오류! Status: ${response.status}. Details: ${JSON.stringify(errorDetails)}`);
        }
        
        console.log("레코드 업데이트 성공!");
        // 업데이트된 레코드 정보가 포함된 응답을 반환할 수도 있습니다.
        return await response.json(); 

    } catch (error) {
        console.error("레코드 업데이트 중 오류 발생:", error.message);
        throw error;
    }
}