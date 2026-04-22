# 신규 수임처 마스터 트래커 — 워크플로우 순서도

> **Spec:** [2026-04-22-new-client-master-tracker-design.md](./2026-04-22-new-client-master-tracker-design.md)
> **Plan:** [../plans/2026-04-22-new-client-master-tracker.md](../plans/2026-04-22-new-client-master-tracker.md)
>
> **뷰어 주의:** Mermaid 8.x 이하 구버전에서는 `{}`, `#`, `()` 안의 특수문자가 파싱 에러를 일으킬 수 있습니다.
> 이 문서는 **Mermaid 9 이상** 호환 문법으로 작성되어 있습니다. 최신 렌더링은 [https://mermaid.live](https://mermaid.live) 또는 GitHub 뷰어를 사용하세요.

---

## 1. 메인 워크플로우 (Slack 통보 → 온보딩 완료)

```mermaid
flowchart TD
    Start(["정세무사 수임 확정"]) --> Slack["Slack 수임문의 통보"]
    Slack --> Open["김다원 과장 Jeeves 접속"]
    Open --> Click["신규 수임처 메뉴 클릭"]
    Click --> NewBtn["신규 등록 버튼"]
    NewBtn --> Form["11개 필드 입력"]
    Form --> Submit["등록 버튼 클릭"]
    Submit --> API1["POST /api/new-client/submit"]
    API1 --> Validate{"서버 검증"}
    Validate -->|"실패"| FormError["에러 토스트"]
    FormError --> Form
    Validate -->|"통과"| Save[("new-clients.json 저장<br/>checklist 빈값 초기화")]
    Save --> SlackNotify["Slack 신규수임처 카드 알림"]
    SlackNotify --> Toast["등록 완료 토스트"]
    Toast --> List["목록 페이지 진입<br/>진행률 0 / 19"]
    List --> Detail["거래처 상세 진입"]
    Detail --> Branch{"이관여부 AND<br/>사업자 생성여부<br/>분기"}
    Branch --> Checklist["19개 항목 수동 체크"]
    Checklist -->|"각 편집"| PATCH["PATCH checklist 엔드포인트"]
    PATCH --> UpdateFile[("JSON 파일 갱신<br/>updatedAt 기록")]
    UpdateFile --> ReloadList["목록 진행률 재로드"]
    ReloadList --> Check{"19 / 19 완료?"}
    Check -->|"No"| Checklist
    Check -->|"Yes"| Complete["수임완료 체크"]
    Complete --> End(["온보딩 종료"])
```

---

## 2. 등록 필드 분기 → 체크리스트 영향도

```mermaid
flowchart LR
    Reg["등록 시점 결정"] --> T{"이관여부"}
    Reg --> B{"사업자 생성여부"}

    T -->|"이관"| TY["이관자료 필요"]
    T -->|"신규"| TN["이관자료 없음"]

    TY --> TR1["transferData<br/>요청 → 백업완료"]
    TN --> TR2["transferData<br/>신규 상태 유지"]

    B -->|"신규생성"| BY["STEP 2 진행 필요"]
    B -->|"기존"| BN["STEP 2 생략 가능"]

    BY --> BR1["businessLicense<br/>자료요청 → 접수완료 → 발급완료"]
    BN --> BR2["businessLicense<br/>바로 발급완료 로 설정 가능"]

    TR1 --> Join["공통 체크리스트<br/>홈택스수임, EDI, CMS,<br/>사업용계좌, 신용카드,<br/>현영가맹점, 위멤버스, 세모리포트"]
    TR2 --> Join
    BR1 --> Join
    BR2 --> Join

    Join --> Finish["수임완료"]
```

---

## 3. 4가지 등록 조합 — 업무 시나리오

```mermaid
flowchart TB
    Reg["신규 등록"] --> Combo{"이관여부 X<br/>사업자 생성여부"}

    Combo -->|"이관 + 기존"| C1["타 세무사에서 이관<br/>기존 사업자<br/>가장 흔함"]
    Combo -->|"이관 + 신규생성"| C2["개업 중간 이관<br/>드물지만 가능"]
    Combo -->|"신규 + 기존"| C3["당사 첫 거래<br/>기존 사업자"]
    Combo -->|"신규 + 신규생성"| C4["개업부터 전 과정 대행"]

    C1 --> C1S["이관자료 요청 백업 필요<br/>사업자등록증 수령만 확인<br/>홈택스 ID PW 전달받기"]
    C2 --> C2S["이관자료 요청 필요<br/>사업자등록증 신청 발급 필요<br/>중간 상태 주의"]
    C3 --> C3S["이관자료 없음<br/>사업자등록증 수령만 확인<br/>홈택스 ID PW 전달받기"]
    C4 --> C4S["이관자료 없음<br/>사업자등록증 신청부터<br/>모든 외부 등록 신규"]

    C1S --> Common["공통 나머지 체크리스트"]
    C2S --> Common
    C3S --> Common
    C4S --> Common

    Common --> Done["19 / 19 수임완료"]
```

---

## 4. 항목 편집 시 기술 흐름 (단건 PATCH)

```mermaid
sequenceDiagram
    participant U as 김다원 과장
    participant UI as ChecklistItemRow
    participant Hook as useChecklistUpdate
    participant API as Express Route
    participant V as validateChecklistUpdate
    participant S as storage
    participant FS as new-clients.json

    U->>UI: 체크박스 클릭 또는 드롭다운 또는 인풋 blur
    UI->>Hook: update 호출
    Hook->>API: PATCH checklist itemKey
    API->>V: 검증 요청
    alt unknown item
        V-->>API: status 400
        API-->>Hook: 400 에러
        Hook-->>UI: throw 에러 토스트
    else invalid status value
        V-->>API: status 400
        API-->>Hook: 400 에러
        Hook-->>UI: throw 에러 토스트
    else 검증 통과
        V-->>API: ok def payload
        API->>S: updateChecklistItem 호출
        S->>FS: readFile
        FS-->>S: records 배열
        alt record 없음
            S-->>API: null
            API-->>Hook: 404
            Hook-->>UI: throw 에러 토스트
        else record 찾음
            S->>S: checklist itemKey 갱신 updatedAt 기록
            S->>FS: writeFile 전체 배열 재기록
            FS-->>S: ok
            S-->>API: ChecklistItemState
            API->>API: ctx log SSE 로그 발송
            API-->>Hook: 200 ok itemKey state
            Hook-->>UI: 성공
            UI->>UI: 로컬 state 낙관적 갱신
            UI->>UI: 목록 진행률 재로드
        end
    end
```

---

## 5. 전체 플러그인 아키텍처 (향후 Layer 1~5 연결 전망)

```mermaid
flowchart TB
    subgraph Layer0["Layer 0 마스터 트래커 이 스펙"]
        Tracker["new-client 플러그인<br/>등록 + 19항목 체크리스트"]
        API["REST API<br/>GET list, GET id, PATCH checklist"]
    end

    subgraph Layer1["Layer 1 API 기반 저난이도"]
        Airtable["Airtable 자동 입력"]
        Dropbox["Dropbox 폴더 생성"]
    end

    subgraph Layer2["Layer 2 문서 생성"]
        Excel["수임시트 엑셀 자동"]
        PDF["기장계약서 PDF"]
    end

    subgraph Layer3["Layer 3 메신저"]
        Kakao["카톡 단톡방 멘트<br/>기존 kakao-send 확장"]
    end

    subgraph Layer4["Layer 4 브라우저 자동화"]
        Wehago["위하고"]
        TheBill["더빌 CMS<br/>기존 thebill-sync 활용"]
        Wemembers["위멤버스 세모리포트"]
    end

    subgraph Layer5["Layer 5 공인인증서 기반 최고난이도"]
        Hometax["홈택스 수임 계좌 카드"]
        EDI["EDI 공단"]
    end

    Layer1 -.->|"PATCH checklist"| API
    Layer2 -.->|"PATCH checklist"| API
    Layer3 -.->|"PATCH checklist"| API
    Layer4 -.->|"PATCH checklist"| API
    Layer5 -.->|"PATCH checklist"| API

    API --> Tracker
```
