---
project: youtube-macro-app
component: Notion 프론트 + 로컬 워커 + Google Drive 자동 업로드
date: 2026-04-28
status: draft
---

# 영화 쇼츠 큐 — Notion + 로컬 워커 + Drive 설계

이 문서는 [movie-shorts-workflow.md](../../movie-shorts-workflow.md)의 전체 파이프라인 중 **A의 카드 입력 → 워커 자동 다운로드 → Drive 업로드 → Notion 카드 갱신**까지를 **별도 웹/UI 0, 별도 DB 0**으로 자동화하는 설계다.

## 0. 한 줄 요약

> Notion이 프론트 + DB. B의 PC에 메뉴바 워커가 떠 있고, Notion에 신규 카드가 들어오면 yt-dlp로 영상을 받아 Drive에 업로드한 뒤 Notion 카드에 결과를 다시 적는다.

---

## 1. 목표와 범위

### 목표
- A는 모바일/PC의 Notion에서 영화 카드를 입력하기만 한다 (링크/메모/제목).
- B의 PC에 떠 있는 워커가 신규 카드를 자동 픽업해서 yt-dlp로 영상을 받고 Drive에 업로드한다.
- 결과(Drive 폴더/링크/상태)는 모두 Notion 카드에 적힌다. B는 Notion 모바일 앱으로 어디서든 진행 상황 확인 가능.
- 별도 웹 UI / 자체 DB / 인증 시스템을 만들지 않는다.

### 범위
- Notion DB 스키마 (카드 한 종류)
- 로컬 워커 (Python `rumps` 메뉴바 앱)
- Google Drive 폴더 구조 + 자동 생성 + 영상 업로드
- 상태 머신: `다운로드대기 → 다운로드중 → 다운로드완료 / 다운로드실패`

### 범위 외
- 별도 웹 대시보드 (Notion이 곧 UI)
- C 단계 편집 / 대본 자동 생성 / YouTube 업로드 (다른 spec)
- 다중 워커 / 다중 Drive 슬롯 (현재 결정: 한 워커, 한 Drive)
- 알림 (사용자 명시 요청으로 제외)

---

## 2. 아키텍처

```
┌──────────────────────────┐
│  Notion (프론트 + DB)     │   A/B가 모바일/PC에서 카드 보고/추가
│  - 영화_쇼츠_큐 DB        │
└────────────┬─────────────┘
             │ Notion API (워커가 30초 폴링)
             ▼
┌──────────────────────────────────────────┐
│  로컬 워커 (B의 macOS, 메뉴바 앱)          │
│  - Python rumps                          │
│  - Notion 폴링 → 다운로드대기 카드 픽업    │
│  - yt-dlp로 영상 다운로드 (임시 디렉토리)  │
│  - Google Drive에 폴더 생성 + 영상 업로드  │
│  - Notion 카드에 결과 기록 (링크/상태/에러) │
│  - 진행률은 메뉴 타이틀에 "5/15" 식으로     │
└────────────┬─────────────────────────────┘
             │ Drive API (한 슬롯 OAuth)
             ▼
┌──────────────────────────┐
│  Google Drive            │
│  movie-shorts-raw/       │
│   001_유주얼서스펙트/     │
│     원본.mp4             │
│   002_메멘토/            │
│     원본.mp4             │
│   ...                    │
└──────────────────────────┘
```

### 핵심 흐름
1. **A가 카드 입력** (Notion 모바일/PC): 제목, 원본 링크, 출처, 메모. 상태는 기본 `다운로드대기`.
2. **워커 폴링** (30초): `다운로드대기` 상태의 카드를 `created_time` 오래된 순으로 조회.
3. **픽업 직후** 카드 상태를 `다운로드중`으로 atomic update (중복 픽업 방지).
4. **yt-dlp 다운로드** → 임시 디렉토리(`~/Library/Caches/movie-shorts-worker/{card_id}/`)에 받음. 진행률은 5초마다 노션에 갱신.
5. **Drive 폴더 생성**: `movie-shorts-raw/{NNN}_{영화명}/` (NNN은 워커 로컬 카운터 또는 노션 lookup). 폴더가 이미 있으면 그대로 사용.
6. **Drive 업로드**: Resumable Upload로 파일 push. 완료 후 `webViewLink` 획득.
7. **Notion 갱신**: 상태 `다운로드완료`, Drive 폴더/파일 링크, 처리 시각 기록. 임시 파일 정리.
8. **실패 시**: 카드 상태 `다운로드실패`, 에러 메시지 기록. 자동 3회 재시도 후 확정. B가 노션에서 상태를 다시 `다운로드대기`로 바꾸면 재처리.

### 모바일 모니터링
- B는 출퇴근/외출 중 Notion 모바일 앱으로 큐 상태 확인.
- 진행률은 카드의 `다운로드_진행률` 컬럼 (워커가 5초마다 갱신).
- 별도 웹 만들지 않음.

---

## 3. Notion DB 스키마

데이터베이스명: **영화_쇼츠_큐**

| 필드 | 타입 | 누가 쓰나 | 비고 |
|------|------|----------|------|
| 제목 | Title | A 또는 Worker | A가 비워두면 워커가 yt-dlp 메타로 자동 채움 |
| 담당자 | Person | A | 책임 추적용. 워커는 변경 안 함. |
| 상태 | Select | A/Worker | `다운로드대기 / 다운로드중 / 다운로드완료 / 다운로드실패 / 반려` |
| 원본_링크 | URL | A | yt/tiktok/instagram. **중복 검사 키.** |
| 출처_플랫폼 | Select | A | youtube/tiktok/instagram/other |
| 수집_메모 | Text | A | 임의 메모 |
| 우선순위 | Number | A (선택) | 낮을수록 먼저 |
| **카드번호** | Number | Worker | 폴더명 NNN. 워커가 픽업 시 부여 (DB 전체에서 max+1) |
| **원본_영상_제목** | Text | Worker | yt-dlp가 추출한 원본 메타 제목 (항상 기록) |
| **drive_폴더_링크** | URL | Worker | webViewLink |
| **drive_파일_링크** | URL | Worker | webViewLink |
| **drive_파일명** | Text | Worker | |
| **다운로드_진행률** | Text | Worker | `45%` 또는 `done` |
| **에러_메시지** | Text | Worker | 마지막 stderr 일부 또는 중복 안내 메시지 |
| **재시도_횟수** | Number | Worker | 기본 0, 최대 3 |
| 처리_시작_시각 | Date(time) | Worker | |
| 처리_완료_시각 | Date(time) | Worker | |
| 생성일 | Created time | 자동 | 정렬 키 |

### A의 입력 규칙
- A가 채워야 할 최소 필드: `원본_링크`, `출처_플랫폼`, `담당자`. 그 외는 모두 워커가 채움.
- `제목`은 비워두면 워커가 yt-dlp 메타에서 추출한 영상 제목으로 자동 채움. 직접 적었으면 그대로 둠 (영화명을 알면 A가 명시적으로 적는 게 더 정확).
- `상태` 기본값을 `다운로드대기`로 Notion DB 설정에서 지정.
- 미완성 카드를 임시로 두고 싶으면 상태를 `반려`로 두거나 카드 자체를 추가하지 않음.

---

## 4. 상태 머신

```
[다운로드대기] ──Worker 픽업──▶ [다운로드중]
[다운로드중] ──성공──▶ [다운로드완료]
[다운로드중] ──실패 (재시도<3)──▶ [다운로드대기] (자동 재시도)
[다운로드중] ──실패 (재시도≥3)──▶ [다운로드실패] (수동 개입 필요)
[다운로드실패] ──B가 Notion에서 변경──▶ [다운로드대기]
[어느 상태든] ──A/admin──▶ [반려]
```

| 상태 | 의미 | 다음 액션 |
|------|------|----------|
| `다운로드대기` | 처리 큐 | Worker (자동 픽업) |
| `다운로드중` | Worker 처리 중 | Worker |
| `다운로드완료` | Drive 업로드 + 링크 기록 끝 | C (다음 spec) |
| `다운로드실패` | 자동 재시도 다 실패. 수동 검토. | B (Notion에서 재시도 또는 반려) |
| `반려` | 사용 불가 | - |

### 동시성 (단일 워커 전제)
- 본 spec은 **워커 한 인스턴스만** 운영함을 전제로 한다.
- 픽업 즉시 `다운로드중`으로 update를 atomic하게 시도하고, 같은 카드가 두 번 픽업되지 않게 한다.
- 자동 복구: 워커 시작 시 `다운로드중` 상태이지만 Notion `last_edited_time`이 현재로부터 5분 이상 지난 카드는 `다운로드대기`로 되돌린다 (정상 처리 중인 카드는 5초마다 진행률 update로 갱신되므로 임계 도달 안 함).

---

## 5. Worker (Python rumps 메뉴바 앱)

### 5.1 메뉴바 표시
- 아이콘: 🎬 (idle) / ⏳ (working) / ⚠️ (last run had failure)
- 메뉴:
  - `상태: 대기 중` (또는 `처리 중 5/15 (45%)`)
  - `마지막 실행: 4/28 09:14`
  - 구분선
  - `로그 보기` → Console.app으로 로그 파일 열기
  - `폴링 일시정지` / `재개`
  - `종료`

### 5.2 메인 루프 (의사코드)
```python
def run():
    recover_stale_in_progress()  # 시작 시 1회
    while not stopped:
        if paused:
            sleep(POLL_INTERVAL); continue

        cards = notion.query(
            status="다운로드대기",
            sort=[("우선순위", "asc"), ("생성일", "asc")],
        )
        if not cards:
            sleep(POLL_INTERVAL)  # 30s
            continue

        for card in cards:
            try:
                # 1. 중복 검사 — 같은 원본_링크로 활성/완료 카드가 이미 있으면 반려
                dup = notion.find_duplicate(card.원본_링크, exclude_id=card.id)
                if dup:
                    notion.update(card.id,
                        status="반려",
                        에러_메시지=f"중복 링크 — 기존 카드 #{dup.카드번호 or dup.id} 와 동일")
                    continue

                # 2. 픽업 (atomic)
                claim(card)                                # status=다운로드중, 처리_시작_시각=now, card_no=max+1

                # 3. yt-dlp 메타 먼저 추출 (--dump-json) → 제목 자동 보강
                meta = ytdlp_extract_meta(card.원본_링크)   # {title, uploader, duration, ext, ...}
                title_for_folder = card.제목 or meta.title  # A가 비워뒀으면 메타 제목 사용
                notion.update(card.id, 원본_영상_제목=meta.title,
                              **({"제목": meta.title} if not card.제목 else {}))

                # 4. 다운로드 + 업로드
                tmp_path = ytdlp_download(card, on_progress=throttled_notion_update)
                folder = drive_ensure_folder(card.card_no, title_for_folder)
                file = drive_upload(tmp_path, parent=folder.id)
                drive_set_link_share_viewer(file.id)

                # 5. 결과 기록
                notion.update(card.id,
                    status="다운로드완료",
                    drive_폴더_링크=folder.web_view_link,
                    drive_파일_링크=file.web_view_link,
                    drive_파일명=tmp_path.name,
                    다운로드_진행률="done",
                    처리_완료_시각=now())
                cleanup(tmp_path)
            except Exception as e:
                handle_failure(card, e)  # 재시도 or 다운로드실패 확정
```

### 5.3 yt-dlp 호출

**메타 추출 단계** (다운로드 전):
- `yt-dlp --dump-single-json --no-download {url}` 실행 → JSON 파싱
- 사용 필드: `title`, `uploader`, `duration`, `ext`
- 카드 `원본_영상_제목`에 항상 기록. 카드 `제목`이 비어있으면 같은 값으로 보강.
- 메타 추출 자체가 실패(URL 죽음/지역제한 등)하면 그 카드는 다운로드도 불가 → `다운로드실패` 처리.

**다운로드 단계**:
- 포맷: `best[ext=mp4]/best`
- 출력: `{tmpdir}/{원본 영상 제목}.mp4` 또는 카드 제목 기반
- 진행률 캡처: `--newline --progress-template "%(progress._percent_str)s"` 출력 파싱 → 5초 스로틀로 노션 update

### 5.4 중복 링크 검사

워커가 픽업 직전 매번 같은 `원본_링크`를 가진 다른 카드를 노션에서 검색한다 (현재 카드는 제외).

- 비교 대상: 모든 상태의 카드 (`다운로드대기 / 다운로드중 / 다운로드완료 / 다운로드실패`). `반려`는 제외.
- URL 정규화: 쿼리스트링 차이만 다를 수 있으므로 `?`, `&` 이후를 무시하고 host+path만 비교 (선택). 첫 구현은 정확 일치로 시작.
- 발견 시: 새 카드(나중에 들어온 것)를 `반려`로 변경하고 `에러_메시지`에 `"중복 링크 — 기존 카드 #NNN 와 동일"` 기록. 다운로드는 진행하지 않음.
- Notion 자체에는 unique constraint가 없으므로 중복이 잠시 두 개 카드로 노출될 수 있으나 30초 이내 한쪽이 자동 반려된다.

> 사용자가 의도적으로 같은 링크를 두 번 처리하고 싶다면, 기존 카드를 `반려`로 바꾸고 새 카드를 추가하면 된다. (반려는 비교 대상에서 제외됨)

### 5.5 Drive 업로드
- 폴더명: `{NNN}_{sanitize(영화명)}` (NNN은 0 패딩 3자리, 카드번호)
- 같은 이름 폴더가 이미 있으면 (워커 재시작 후 같은 카드 재처리 등) 그 ID 재사용
- 파일명: 원본 yt-dlp 파일명 그대로 (또는 `{영화명}.mp4`로 정규화)
- 업로드 방식: Resumable Upload (대용량 안정)
- 공유 권한: 업로드 직후 "링크 있는 모든 사용자 = 뷰어" 부여 (C가 봐야 함)

### 5.6 인증
- **Notion**: integration token + DB ID (env)
- **Drive**: OAuth 2.0 user flow (워커 최초 실행 시 브라우저 동의), refresh_token을 `~/.config/movie-shorts-worker/google-token.json`에 저장. 만료 시 자동 갱신.

### 5.7 자동 시작
- macOS LaunchAgent 등록 (`~/Library/LaunchAgents/com.movie-shorts.worker.plist`) → 로그인 시 자동 실행
- 패키징: 일단 `python -m worker`로 실행, 안정화되면 `py2app`으로 `.app` 패키징

### 5.8 로깅
- 일자별 파일: `~/Library/Logs/movie-shorts-worker/worker-YYYYMMDD.log`
- 에러 발생 시 macOS 알림센터 토스트 (이건 시스템 알림일 뿐 슬랙/카톡 아님)

---

## 6. Drive 폴더 구조

```
My Drive (워커 OAuth로 등록된 한 Google 계정)
└─ movie-shorts-raw/
   ├─ 001_유주얼서스펙트/
   │   └─ 원본.mp4
   ├─ 002_메멘토/
   │   └─ 원본.mp4
   └─ ...
```

- 루트 폴더(`movie-shorts-raw`)는 워커가 첫 실행 시 자동 생성 + 폴더 ID를 로컬 캐시.
- 카드번호 NNN은 노션 DB의 `카드번호` 컬럼 max + 1로 부여 (atomic하지 않은 약점은 단일 워커 전제로 무시).

---

## 7. 디렉토리 구조

```
youtube-macro-app/
├── docs/
│   └── specs/
│       └── 2026-04-28-b-downloader-design.md       ← 본 문서
├── movie-shorts-workflow.md                         ← 전체 파이프라인 (기존)
│
├── worker/                                          ← 유일한 코드 베이스
│   ├── pyproject.toml
│   ├── README.md                                    ← OAuth 셋업 가이드 포함
│   ├── .env.example
│   ├── src/
│   │   ├── __init__.py
│   │   ├── menubar.py                               ← rumps 진입점
│   │   ├── poller.py                                ← 메인 루프
│   │   ├── notion.py                                ← Notion 클라이언트 래퍼
│   │   ├── ytdlp.py
│   │   ├── drive.py
│   │   ├── config.py
│   │   └── log.py
│   ├── tests/
│   │   ├── test_notion.py
│   │   ├── test_ytdlp.py
│   │   ├── test_drive.py
│   │   └── test_poller.py
│   └── scripts/
│       ├── install_launchagent.sh
│       └── oauth_setup.py                           ← Drive OAuth 최초 셋업 도우미
```

---

## 8. 환경변수 (`worker/.env`)

```
NOTION_TOKEN=secret_xxx
NOTION_DB_ID=xxxxxxxxxxxx

GOOGLE_OAUTH_CLIENT_SECRETS=/Users/.../client_secret.json
GOOGLE_TOKEN_PATH=~/.config/movie-shorts-worker/google-token.json
DRIVE_ROOT_FOLDER_NAME=movie-shorts-raw

POLL_INTERVAL_SEC=30
PROGRESS_UPDATE_INTERVAL_SEC=5
MAX_RETRIES=3
TMP_DIR=~/Library/Caches/movie-shorts-worker
LOG_DIR=~/Library/Logs/movie-shorts-worker
```

---

## 9. 테스트 전략

- **유닛**: `notion`, `drive`, `ytdlp` 각각 외부 호출은 모킹
  - 상태 전이 함수: 입력 + 액션 → 기대 상태와 일치
  - claim 로직: 같은 카드 두 번 picked되지 않는지
  - retry 로직: 재시도 횟수 증가, 임계 도달 시 다운로드실패 확정
- **통합** (로컬에서만 수동): 짧은 공개 영상으로 yt-dlp → 테스트용 Drive 폴더 → 테스트용 노션 DB 갱신 한 사이클

---

## 10. 보안 / 운영

- 토큰 파일 권한: `chmod 600` 강제 (워커 시작 시 검증)
- Notion 토큰은 `.env`로만, git 커밋 금지 (`.gitignore`)
- yt-dlp stderr에 URL 등이 섞일 수 있음 — 로그는 로컬에만 저장 (외부 전송 X)
- Drive 공유 "링크 있는 모든 사용자 뷰어"가 부담스러우면 도메인 제한으로 강화 (Phase 2)
- B의 PC가 꺼져있으면 처리 안 됨 — 노션에 카드는 쌓이고 다음 폴링 때 처리. 운영상 PC 켜놓는 것이 전제.

---

## 11. 개발 로드맵

### Phase 1 — MVP (목표 2일)
- [ ] Notion DB 수동 생성 (스키마대로)
- [ ] 워커: 단일 카드 e2e (CLI 모드, 메뉴바 없이)
  - Notion 폴링 → claim → yt-dlp → Drive 업로드 → Notion 갱신
- [ ] 자동 재시도 + 자동 복구 로직
- [ ] rumps 메뉴바 래핑 (상태/일시정지/로그 보기)
- [ ] LaunchAgent 등록 스크립트
- [ ] README에 OAuth 셋업 / 운영 가이드

### Phase 2 — 안정화
- [ ] 로그 로테이션, 에러 알림센터 토스트
- [ ] py2app 패키징 (.app 더블클릭 실행)
- [ ] 처리 통계 (일일 처리량, 실패율)

### Phase 3 — 확장 (다른 spec)
- C 단계 편집 핸드오프
- 대본 자동 생성 (Whisper + Claude)
- YouTube 업로드

---

## 12. 결정 사항 정리

| 결정 | 선택 | 근거 |
|------|------|------|
| 프론트 / DB | **Notion** | 별도 UI/DB/Auth 불필요. 모바일 앱 무료로 따라옴. |
| 워커 위치 | B의 macOS, 메뉴바 앱 (rumps) | 한 사람 PC에서 운영, 시각적 상태 표시 가능 |
| 워커 인스턴스 수 | **1대** (Q11 결정) | 동시성 고려 단순화. 카드 충돌 없음. |
| 영상 처리 자동화 | **yt-dlp 자동 다운로드 + Drive 자동 업로드** (Q10 결정) | B는 결과만 확인 |
| Drive 슬롯 | **1개** (한 Google 계정) | 단일 워커와 정합. 관리자별 분리는 폐기. |
| 알림 | 없음 (macOS 알림센터만) | 사용자 명시 요청 |
| 모바일 모니터링 | Notion 모바일 앱 | 별도 개발 0 |
| Drive 폴더 구조 | `movie-shorts-raw/{NNN}_{영화명}/` | 정렬 + 가독성 |
| 카드번호 부여 | 워커 픽업 시 노션 max+1 | 단순 (단일 워커 전제) |
| 중복 링크 처리 | 워커가 픽업 직전 검사 → 중복이면 새 카드 `반려` | 노션 native unique 없음. 30초 내 자동 마킹 |
| 자동 제목 보강 | yt-dlp 메타 추출 → 카드 `제목` 빈 경우 채움 + `원본_영상_제목`은 항상 기록 | A의 입력 부담 감소 |
| 담당자 컬럼 | Notion `Person` 타입 추가 (A 입력) | 책임 추적, 노션에서 필터링 가능 |

---

## 13. 열린 질문 (구현 단계에서 결정)

- URL 정규화 정책 — 첫 구현은 정확 일치. 같은 영상이지만 쿼리스트링 다른 경우(`?t=120` 등)도 중복으로 잡고 싶으면 host+path만 비교하도록 확장.
- 워커가 죽었는지 모니터링 — Phase 2에서 macOS 알림 또는 별도 health-check.
- 담당자별 통계/필터 뷰 — Notion에서 사용자가 직접 필터 만들면 충분. 워커는 담당자 필드를 read-only로 다룬다.
