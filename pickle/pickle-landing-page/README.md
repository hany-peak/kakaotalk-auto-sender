# Talkple - 특별한 쇼핑 경험 랜딩페이지

Talkple의 실제 디자인 스타일을 반영한 프리미엄 공동구매 플랫폼 랜딩페이지입니다.

## 🎨 디자인 컨셉

실제 Talkple 웹사이트의 **보라색 그라디언트**와 **3D 비주얼 요소**를 충실히 재현한 프리미엄 랜딩페이지입니다.

### 주요 디자인 특징
- **보라색 그라디언트 배경** - 부드러운 라벤더부터 진한 바이올렛까지
- **3D 플로팅 카드** - 메탈릭 링과 함께 떠다니는 카드 애니메이션
- **대담한 타이포그래피** - 강렬한 헤드라인과 그라디언트 텍스트
- **프리미엄 느낌** - 고급스러운 색감과 부드러운 애니메이션
- **센터 정렬 레이아웃** - 깔끔한 중앙 정렬 구성

## ✨ 현재 완성된 기능

### 1. **히어로 섹션**
   - 보라색 그라디언트 배경 (라벤더 → 바이올렛 → 핑크 색조)
   - 플로팅 컬러 쉐이프 (노란색, 핑크, 보라색 블러 효과)
   - 3D 카드 링 애니메이션 (회전하는 메탈릭 링)
   - 플로팅 카드 2개 (보라색 그라디언트 + 화이트)
   - 마우스 인터랙티브 카드 움직임
   - 대담한 타이포그래피 (52px 헤드라인)
   - 그라디언트 강조 텍스트

### 2. **어바웃 섹션**
   - 배지 컴포넌트 (펄스 애니메이션 포함)
   - "특별" 강조 메시지
   - 대형 브랜드 마크 (반투명 "P" 로고)
   - 센터 정렬 컨텐츠

### 3. **통계 섹션 (다크 배경)**
   - 다크 그라디언트 배경 (그레이 900 → 그레이 800)
   - 3D 비주얼 요소 (회전하는 링 + 플로팅 카드)
   - 카운터 애니메이션 (5개월, 5,493% 성장)
   - 화이트 텍스트 + 보라색 강조

### 4. **기능 카드 섹션**
   - 6개 기능 카드 (그리드 레이아웃)
   - 3D 호버 효과 (카드 기울임)
   - 보라색 그라디언트 아이콘
   - Stagger 애니메이션 (순차 등장)

### 5. **CTA 섹션**
   - 풀 그라디언트 배경 (보라색 → 인디고)
   - 대형 화이트 버튼
   - 센터 정렬 메시지

### 6. **풋터**
   - 다크 배경 (그레이 900)
   - 그리드 레이아웃 (회사 정보 + 링크)
   - 소셜 미디어 아이콘

### 7. **인터랙티브 애니메이션**
   - ✅ 스크롤 기반 페이드인 애니메이션
   - ✅ 3D 카드 마우스 트래킹
   - ✅ 패럴랙스 효과 (쉐이프 및 히어로 컨텐츠)
   - ✅ 버튼 리플 효과
   - ✅ 카운터 애니메이션
   - ✅ 카드 3D 호버 효과 (회전)
   - ✅ 플로팅 애니메이션 (카드 상하 움직임)
   - ✅ 스크롤 투 탑 버튼
   - ✅ 네비게이션 스크롤 효과

### 8. **반응형 디자인**
   - 데스크톱 (1024px+)
   - 태블릿 (768px~1023px)
   - 모바일 (768px 이하)
   - 모바일 햄버거 메뉴

## 📁 파일 구조

```
/
├── index.html          # 메인 HTML (13.3KB)
├── css/
│   └── style.css      # Talkple 스타일 CSS (16.8KB)
├── js/
│   └── script.js      # 인터랙티브 JavaScript (12.2KB)
└── README.md          # 프로젝트 문서
```

## 🎨 색상 시스템

### 보라색 팔레트 (Primary)
```css
--purple-50:  #faf5ff    /* 매우 연한 라벤더 */
--purple-100: #f3e8ff    /* 연한 라벤더 */
--purple-200: #e9d5ff    /* 라벤더 */
--purple-300: #d8b4fe    /* 밝은 보라 */
--purple-400: #c084fc    /* 보라 */
--purple-500: #a855f7    /* 진한 보라 */
--purple-600: #9333ea    /* 더 진한 보라 */
--purple-700: #7e22ce    /* 매우 진한 보라 */
```

### 인디고 팔레트 (Secondary)
```css
--indigo-400: #818cf8    /* 밝은 인디고 */
--indigo-500: #6366f1    /* 인디고 */
--indigo-600: #4f46e5    /* 진한 인디고 */
```

### 바이올렛 팔레트 (Accent)
```css
--violet-500: #8b5cf6    /* 바이올렛 */
--violet-600: #7c3aed    /* 진한 바이올렛 */
```

### 그라디언트 조합
- **Primary Gradient**: `linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)`
- **Hero Background**: 라벤더 → 퍼플 → 반투명
- **CTA Background**: 바이올렛 → 인디고

## 🚀 사용된 기술 스택

### Frontend Core
- **HTML5**: 시맨틱 마크업
- **CSS3**: 
  - CSS Variables (색상 시스템)
  - Flexbox & Grid Layout
  - Keyframe Animations
  - Transform & Transition
  - Backdrop Filter (글래스모피즘)
  - Gradient (선형/방사형)
- **JavaScript ES6+**:
  - Intersection Observer API (스크롤 애니메이션)
  - Mouse Event Tracking (3D 효과)
  - RequestAnimationFrame (카운터 애니메이션)
  - Event Delegation
  - Debounce & Throttle

### 외부 라이브러리
- **Noto Sans KR** (Google Fonts) - 한글 타이포그래피
- **Font Awesome 6.4.0** - 아이콘

## 🎯 주요 인터랙션 설명

### 3D 카드 인터랙션
```javascript
// 마우스 위치에 따라 카드가 미묘하게 움직임
document.addEventListener('mousemove', (e) => {
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    // 카드 위치 조정
});
```

### 카운터 애니메이션
```javascript
// 5,493% 성장률을 0부터 카운트업
animateCounter(element, 0, 5493, 2500);
```

### 패럴랙스 스크롤
```javascript
// 스크롤 시 배경 쉐이프가 다른 속도로 움직임
window.addEventListener('scroll', () => {
    shapes.forEach((shape, index) => {
        const speed = (index + 1) * 0.2;
        shape.style.transform = `translateY(${scrolled * speed}px)`;
    });
});
```

## 📱 반응형 브레이크포인트

| 디바이스 | 해상도 | 주요 변경사항 |
|---------|--------|-------------|
| Desktop | 1024px+ | 전체 레이아웃 유지 |
| Tablet | 768px~1023px | 그리드 조정, 폰트 축소 |
| Mobile | ~768px | 단일 컬럼, 햄버거 메뉴, 3D 요소 축소 |
| Small Mobile | ~480px | 추가 폰트 축소, 버튼 크기 조정 |

## 💡 최적화 기법

1. **애니메이션 성능**
   - `transform`과 `opacity`만 사용 (GPU 가속)
   - `will-change` 속성으로 렌더링 최적화
   - `requestAnimationFrame` 사용

2. **스크롤 성능**
   - Throttle/Debounce로 이벤트 제한
   - Intersection Observer로 viewport 감지

3. **로딩 최적화**
   - CDN을 통한 폰트/아이콘 로드
   - CSS/JS 최소화

## 🔧 커스터마이징 가이드

### 색상 변경
`css/style.css`의 `:root` 섹션에서 CSS 변수 수정:
```css
:root {
    --purple-600: #YOUR_COLOR;
    --indigo-600: #YOUR_COLOR;
}
```

### 텍스트 수정
`index.html`에서 각 섹션의 텍스트 직접 수정

### 애니메이션 속도 조정
```css
/* CSS에서 */
animation: float 20s ease-in-out infinite; /* 20s를 원하는 값으로 */

/* JavaScript에서 */
animateCounter(element, start, end, 2000); /* 2000ms를 원하는 값으로 */
```

## 📋 섹션별 URI

| 섹션 | URI | 설명 |
|------|-----|------|
| 메인 | `/` or `/index.html` | 전체 랜딩페이지 |
| 서비스 | `/#about` | 특별 소개 섹션 |
| 기능 | `/#features` | 기능 카드 섹션 |
| 성과 | `/#stats` | 통계 섹션 |
| 문의 | `/#contact` | 풋터 정보 |

## 🌟 향후 개발 계획

### Phase 2
- [ ] 실제 백엔드 API 연동
- [ ] 회원가입/로그인 모달
- [ ] 제품 상세 페이지
- [ ] 결제 시스템 연동

### Phase 3
- [ ] 다크 모드 지원
- [ ] 다국어 지원 (i18n)
- [ ] 블로그 섹션
- [ ] FAQ 페이지

### Phase 4
- [ ] PWA 지원
- [ ] 오프라인 모드
- [ ] 푸시 알림
- [ ] 성능 최적화 (Lighthouse 100점)

## 🐛 알려진 이슈

현재 알려진 이슈 없음.

## 📝 버전 히스토리

### Version 2.0.0 (2026-01-01)
- ✅ Talkple 실제 디자인 스타일 반영
- ✅ 보라색 그라디언트 배경 구현
- ✅ 3D 플로팅 카드 애니메이션
- ✅ 마우스 인터랙티브 효과
- ✅ 다크 섹션 추가 (통계)
- ✅ 프리미엄 타이포그래피
- ✅ 향상된 모바일 경험

### Version 1.0.0 (2026-01-01)
- ✅ 초기 랜딩페이지 구현

## 🎓 기술 참고사항

### CSS 그라디언트
```css
/* 부드러운 배경 그라디언트 */
background: linear-gradient(180deg, 
    rgba(249, 245, 255, 1) 0%,    /* 라벤더 */
    rgba(243, 232, 255, 1) 30%,   /* 밝은 보라 */
    rgba(233, 213, 255, 1) 60%,   /* 보라 */
    rgba(216, 180, 254, 0.6) 100% /* 진한 보라 */
);
```

### 3D Transform
```css
/* 카드 3D 회전 효과 */
transform: perspective(1000px) 
           rotateX(10deg) 
           rotateY(-10deg) 
           translateY(-8px);
```

### Backdrop Filter
```css
/* 글래스모피즘 효과 */
backdrop-filter: blur(20px);
background: rgba(255, 255, 255, 0.95);
```

## 📞 지원

궁금한 점이나 이슈가 있으시면 언제든 문의해주세요!

## 📄 라이센스

Copyright © 2026 Talkple. All rights reserved.

---

**Made with 💜 for Talkple - 특별한 쇼핑 경험**

**Design inspired by**: https://talkple.company/copurchasing
