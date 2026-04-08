const { 농산물_카테고리 } = require('./keywords');

// 농산물 데이터 싱글턴 클래스
class AgriculturalDatabase {
    constructor() {
        if (AgriculturalDatabase.instance) {
            return AgriculturalDatabase.instance;
        }
        
        this.월별_이모지 = {
            "1월": "🍊", "2월": "🍓", "3월": "🌸",
            "4월": "🌿", "5월": "🌼", "6월": "🍑",
            "7월": "🍉", "8월": "🍇", "9월": "🍏",
            "10월": "🍎", "11월": "🍠", "12월": "🎄"
        };

        

        this.과일_데이터 = {
            "1월": ["부사 사과", "청송 사과", "한라봉", "천혜향", "레드향", "감귤"],
            "2월": ["딸기", "한라봉", "천혜향", "레드향", "감귤"],
            "3월": ["딸기", "참다래", "블루베리", "한라봉"],
            "4월": ["짭짤이토마토", "대저토마토", "망고스틴"],
            "5월": ["체리", "블랙사파이어포도", "카라카라오렌지","신비복숭아"],
            "6월": ["오디", "석류", "대석자두", "신비복숭아"],
            "7월": ["씨없는수박", "성주참외", "복숭아", "살구"],
            "8월": ["참외", "자두", "포도", "수박", "무화과"],
            "9월": ["멜론", "네이블오렌지", "배"],
            "10월": ["부사 사과", "단감", "대봉감"],
            "11월": ["부사 사과", "청송 사과", "한라봉"],
            "12월": ["부사 사과", "청송 사과", "한라봉", "천혜향"]
        };

        this.채소_데이터 = {
            "1월": ["시금치", "겨울무", "배추", "대파", "미나리", "근대", "쪽파"],
            "2월": ["봄동", "얼갈이배추", "미나리", "시금치", "브로콜리", "콜리플라워"],
            "3월": ["쑥", "두릅", "달래", "냉이", "돌나물"],
            "4월": ["엄나무순", "명이나물", "취나물", "가죽나물"],
            "5월": ["엄나무순", "고구마순", "오이", "애호박", "토마토"],
            "6월": ["고추", "가지", "미니파프리카", "단호박"],
            "7월": ["표고 버섯", "느타리 버섯", "대파", "쪽파"],
            "8월": ["브로콜리", "콜리플라워", "샐러리", "마늘쫑"],
            "9월": ["아스파라거스", "열무", "콜라비"],
            "10월": ["시금치", "배추", "미나리", "근대"],
            "11월": ["겨울무", "구좌당근", "홍감자", "연근"],
            "12월": ["시금치", "겨울무", "배추", "대파"]
        };

        this.기타_데이터 = {
            "1월": ["콩나물", "숙주나물"],
            "2월": ["더덕", "도라지", "고사리"],
            "3월": ["씀바귀", "방풍나물", "꿀고구마"],
            "4월": ["호박고구마", "수미감자", "초당옥수수"],
            "5월": ["옥수수", "완두콩", "강낭콩"],
            "6월": ["산딸기", "들깨잎"],
            "7월": ["늙은호박", "대추"],
            "8월": ["생강", "밤"],
            "9월": ["콩나물", "숙주나물", "고사리"],
            "10월": ["더덕", "도라지", "꿀고구마"],
            "11월": ["호박고구마", "수미감자"],
            "12월": ["콩나물", "숙주나물", "도라지"]
        };

        AgriculturalDatabase.instance = this;
    }

    // 특정 월의 특정 카테고리 품목 조회
    getCategoryProducts(month, category) {
        switch(category) {
            case 농산물_카테고리.과일:
                return this.과일_데이터[month] || [];
            case 농산물_카테고리.채소:
                return this.채소_데이터[month] || [];
            case 농산물_카테고리.기타:
                return this.기타_데이터[month] || [];
            default:
                return [];
        }
    }

    // 특정 월의 모든 품목 조회
    getMonthlyProducts(month) {
        return {
            [농산물_카테고리.과일]: this.과일_데이터[month] || [],
            [농산물_카테고리.채소]: this.채소_데이터[month] || [],
            [농산물_카테고리.기타]: this.기타_데이터[month] || []
        };
    }

    // 특정 품목이 제철인 월 찾기
    getSeasonalMonths(productName) {
        const months = [];
        
        // 모든 카테고리에서 검색
        Object.keys(this.과일_데이터).forEach(month => {
            if (this.과일_데이터[month].includes(productName) ||
                this.채소_데이터[month].includes(productName) ||
                this.기타_데이터[month].includes(productName)) {
                months.push(month);
            }
        });

        return months;
    }

    // 월별 이모지 조회
    getMonthEmoji(month) {
        return this.월별_이모지[month];
    }

    // 모든 과일 목록 조회
    getAllFruits() {
        return [...new Set(Object.values(this.과일_데이터).flat())];
    }

    // 모든 채소 목록 조회
    getAllVegetables() {
        return [...new Set(Object.values(this.채소_데이터).flat())];
    }

    // 모든 기타 품목 조회
    getAllOthers() {
        return [...new Set(Object.values(this.기타_데이터).flat())];
    }
}

// 싱글턴 인스턴스 생성
const agriculturalDB = new AgriculturalDatabase();

// 외부로 내보내기
module.exports = {
    농산물_카테고리,
    agriculturalDB
};