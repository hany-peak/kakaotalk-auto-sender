# Cloudflare Tunnel Health → jeeves → Slack

**Date:** 2026-04-29
**Status:** Design approved

## Goal

Cloudflare Notifications의 "Tunnel Health" 이벤트를 jeeves가 webhook으로 수신하여, 슬랙 `#jeeves-alert` 채널에 Block Kit 카드 형태로 포워딩한다.

Cloudflare → Slack 직결 대신 jeeves를 거치는 이유: 메시지 포맷 커스터마이즈, 향후 라우팅(예: 카카오/UI) 확장 여지, 운영 로그 일원화.

## Architecture

```
Cloudflare Notifications
   │ POST (Generic webhook, JSON body, header: cf-webhook-auth)
   ▼
https://jeeves.codetax.co.kr/api/webhooks/cloudflare/tunnel-health
   │ (Cloudflare Tunnel → 127.0.0.1:3001)
   ▼
jeeves: cloudflare-alerts plugin
   ├─ 1) cf-webhook-auth 헤더 ↔ CLOUDFLARE_WEBHOOK_SECRET 검증 (timing-safe)
   ├─ 2) 페이로드 파싱/정규화
   ├─ 3) Slack chat.postMessage → SLACK_ALERT_CHANNEL (Block Kit)
   └─ 4) 200 OK 반환 (Slack 실패해도 200 — Cloudflare 재시도 큐 막힘 방지)
```

## Auth — 핵심 결정

`/api/*` 는 `requireAuth(authCfg)` 게이트로 보호되지만 Cloudflare는 OAuth를 수행할 수 없다. 따라서:

- 라우트 `/api/webhooks/cloudflare/*` 를 `app.use('/api', requireAuth(authCfg))` **이전**에 마운트해서 게이트 우회
- 대신 `cf-webhook-auth` 헤더와 env `CLOUDFLARE_WEBHOOK_SECRET` 을 `crypto.timingSafeEqual` 로 비교
- 시크릿 누락/불일치 → 401 + 로깅
- 라우트 자체에 별도 rate-limit (`express-rate-limit`, 60s 윈도우, max 60) 적용해 abuse 차단

기존 `Plugin.registerRoutes(app, ctx)` 인터페이스는 그대로 두고, `cloudflare-alerts` 플러그인은 `registerPublicRoutes(app, ctx)` 함수를 추가로 export. `server/index.ts` 에서 `requireAuth` 마운트 **이전**에 직접 호출:

```ts
mountAuthRoutes(app, authCfg);                          // 기존 (로그인)
registerPublicRoutes(app, ctx);                         // 신규 — Cloudflare webhook
app.use('/api', requireAuth(authCfg));                   // 기존
```

`plugins` 배열의 일반 등록 루프(`plugin.registerRoutes`)에서는 cloudflare-alerts 의 인증 보호 라우트가 있을 경우에만 활용 — 현재 단계에서는 없으므로 이 플러그인의 `registerRoutes` 는 no-op.

## File Layout

```
server/plugins/cloudflare-alerts/
  index.ts        — plugin export (registerPublicRoutes)
  routes.ts       — POST /api/webhooks/cloudflare/tunnel-health
  slack.ts        — Block Kit 포맷터 + Slack Web API 호출
  config.ts       — env 로드 (CLOUDFLARE_WEBHOOK_SECRET, SLACK_ALERT_CHANNEL)
  normalize.ts    — Cloudflare 페이로드 → 내부 표준 이벤트 변환
  types.ts        — CloudflareWebhookPayload, NormalizedAlert
  routes.test.ts  — 시크릿 검증, 페이로드 처리 통합 테스트 (Slack 호출 mock)
  normalize.test.ts — 다양한 페이로드 케이스
  slack.test.ts   — Block Kit 포맷 단위 테스트
```

플러그인 인터페이스가 `registerRoutes(app, ctx)` 만 노출하고 있다면, `cloudflare-alerts` 는 별도 함수 `registerPublicRoutes(app, ctx)` 를 export 하고 `index.ts` 에서 직접 호출한다 (다른 플러그인은 영향 없음).

## Cloudflare Webhook Payload

Cloudflare Notifications의 Generic Webhook은 다음 필드를 포함하는 JSON을 보낸다 (구체 스키마는 구현 시 실제 페이로드로 검증):

```json
{
  "name": "Cloudflare Tunnel Health",
  "text": "Tunnel jeeves is unhealthy.",
  "data": {
    "tunnel_id": "...",
    "tunnel_name": "jeeves",
    "new_health_status": "down" | "degraded" | "healthy",
    "old_health_status": "...",
    "time": "2026-04-29T05:23:00Z"
  },
  "ts": 1714368180,
  "policy_id": "..."
}
```

알 수 없는 필드는 무시하고, 누락된 필드는 안전하게 fallback (e.g. `data.tunnel_name` 없으면 `"unknown"`).

## Normalized Event

```ts
type NormalizedAlert = {
  tunnelName: string;
  status: 'down' | 'degraded' | 'healthy' | 'unknown';
  oldStatus?: string;
  occurredAt: Date;       // KST 변환은 포맷 단계에서
  rawText: string;        // Cloudflare 의 .text — fallback 표시용
  alertName: string;      // .name
};
```

## Slack Block Kit Format

색상 매핑 (attachment color):
- `down` → `#dc3545` (빨강) + 헤더 이모지 `:rotating_light:`
- `degraded` → `#ffc107` (노랑) + `:warning:`
- `healthy` → `#28a745` (초록) + `:white_check_mark:`
- `unknown` → `#6c757d` (회색) + `:grey_question:`

레이아웃:
```
[attachment, color=상태색]
  Header block: "{이모지} Cloudflare Tunnel: {tunnelName} — {status.toUpperCase()}"
  Section block (fields):
    *시간 (KST)*: 2026-04-29 14:23:00
    *알림*: Cloudflare Tunnel Health
    *상태 변경*: {oldStatus} → {newStatus}
  Section block (text):
    > {rawText}
  Context block:
    <https://dash.cloudflare.com/?to=/:account/notifications|Cloudflare 대시보드>
```

`mrkdwn` 사용. 시간 포맷: `Asia/Seoul`, `YYYY-MM-DD HH:mm:ss`.

## Environment Variables

`.env.example` 에 추가:
```
# Cloudflare Tunnel Health webhook
# Cloudflare → Notifications → Webhooks → Create 에서 동일 secret 입력
CLOUDFLARE_WEBHOOK_SECRET=
# 알림 수신 채널 (기본 SLACK_CHANNEL 과 분리)
SLACK_ALERT_CHANNEL=#jeeves-alert
```

기존 `SLACK_BOT_TOKEN` 재사용. 봇이 `#jeeves-alert` 채널에 초대되어 있어야 한다 (운영 체크리스트 항목).

## Error Handling

| 상황 | 응답 | 후처리 |
|---|---|---|
| 시크릿 헤더 누락 | 401 | 로깅 (warn) |
| 시크릿 불일치 | 401 | 로깅 (warn) — IP 포함 |
| 페이로드 파싱 실패 | 200 | 로깅 (error), 슬랙으로 raw 텍스트 fallback 전송 |
| Slack API 실패 | 200 | 로깅 (error) — Cloudflare 큐 막힘 방지가 우선 |
| 시크릿 env 미설정 | 503 | 로깅 (error) — 라우트 자체는 마운트되되 secret 없으면 모든 요청 거부 |

## Testing

**Unit:**
- `normalize.test.ts` — 정상/필드누락/알 수 없는 status 변환
- `slack.test.ts` — 4가지 status 별 Block Kit 출력 스냅샷

**Integration (`routes.test.ts`):**
- 시크릿 헤더 없음 → 401
- 잘못된 시크릿 → 401
- 올바른 시크릿 + 정상 페이로드 → 200 + Slack 호출 1회 (mock)
- 올바른 시크릿 + 깨진 JSON → 200 + Slack fallback 호출
- Slack 호출이 throw → 200 + 에러 로그

**Manual smoke:**
1. 로컬 jeeves 실행
2. `curl -X POST http://127.0.0.1:3001/api/webhooks/cloudflare/tunnel-health -H "cf-webhook-auth: $SECRET" -H "content-type: application/json" -d @sample-down.json`
3. `#jeeves-alert` 채널에 카드 도착 확인
4. status 별 (down/degraded/healthy) 색상/이모지 검증

## Cloudflare Dashboard Configuration (운영자 작업)

스펙 외 운영 절차 — 구현 후 별도 안내:

1. Cloudflare Dashboard → Notifications → Destinations → **Webhooks** → Create
   - Name: `jeeves-alert`
   - URL: `https://jeeves.codetax.co.kr/api/webhooks/cloudflare/tunnel-health`
   - Secret: `openssl rand -hex 32` 결과를 jeeves env 와 동일하게 설정
2. Notifications → Add → **Tunnel Health Notification**
   - Scope: 대상 터널 선택 (또는 all)
   - Delivery: 위에서 만든 `jeeves-alert` webhook
3. Cloudflare 대시보드의 "Send test notification" 으로 검증

## Out of Scope

- jeeves UI(SSE) 배지/토스트 — 이번 라운드 제외 (`ctx.broadcast` 호출도 안 함). 향후 필요시 normalize 후 broadcast 추가.
- 카카오 알림 라우팅 — 슬랙으로 충분.
- Tunnel Health 외 다른 Cloudflare 알림(WAF, DDoS 등) — 스키마가 다를 수 있어 별도 라우트로 분리하는 것이 안전. 확장 시 `/api/webhooks/cloudflare/<event-type>` 패턴.
- Webhook 수신 이력 영속화 (DB/airtable). 로그로 충분.

## Open Questions

없음 — 구현 단계에서 실제 Cloudflare 페이로드 한 번 받아보고 `normalize.ts` 의 필드 매핑 최종 확정.
