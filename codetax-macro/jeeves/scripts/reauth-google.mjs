#!/usr/bin/env node
/* Google OAuth refresh token 재발급 — loopback(localhost) 콜백 방식.
 * 사용: cd jeeves && node scripts/reauth-google.mjs
 *
 * 사전 준비:
 *   1) https://console.cloud.google.com/apis/credentials 에서
 *      OAuth 2.0 클라이언트 ID 생성 (유형: "데스크톱 앱" / Desktop app)
 *   2) OAuth 동의 화면 설정 (외부 + 테스트 사용자에 본인 이메일 추가)
 *   3) https://console.cloud.google.com/apis/library/drive.googleapis.com 에서 Drive API 사용
 *   4) .env 에:
 *        GOOGLE_OAUTH_CLIENT_ID=...
 *        GOOGLE_OAUTH_CLIENT_SECRET=...
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';

const ENV_PATH = path.resolve(new URL('..', import.meta.url).pathname, '.env');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const CALLBACK_PATH = '/oauth/callback';

function parseEnv(raw) {
  return raw.split('\n').reduce((a, l) => {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, '');
    return a;
  }, {});
}

function waitForCallback(server, expectedState, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('콜백 대기 timeout (5분 초과)'));
    }, timeoutMs);

    server.on('request', (req, res) => {
      if (!req.url || !req.url.startsWith(CALLBACK_PATH)) {
        res.writeHead(404); res.end(); return;
      }
      const url = new URL(req.url, `http://localhost`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>OAuth 에러</h1><p>${error}</p><p>터미널로 돌아가세요.</p>`);
        clearTimeout(timer);
        server.close();
        reject(new Error(`OAuth 에러: ${error}`));
        return;
      }
      if (state !== expectedState) {
        res.writeHead(400);
        res.end('state mismatch');
        return;
      }
      if (!code) {
        res.writeHead(400);
        res.end('code 없음');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>✓ 인증 완료</h1><p>터미널로 돌아가세요. 이 창은 닫으셔도 됩니다.</p>');
      clearTimeout(timer);
      server.close();
      resolve(code);
    });
  });
}

async function main() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = parseEnv(raw);
  const { GOOGLE_OAUTH_CLIENT_ID: cid, GOOGLE_OAUTH_CLIENT_SECRET: csec } = env;
  if (!cid || !csec) {
    console.error('❌ .env 에 GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 먼저 넣어주세요.');
    process.exit(1);
  }
  console.log(`.env 로드: client_id.len=${cid.length} secret.len=${csec.length}`);

  // 0.0.0.0:0 으로 아무 빈 포트 할당
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const redirectUri = `http://localhost:${port}${CALLBACK_PATH}`;
  console.log(`로컬 콜백 서버: ${redirectUri}`);

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: cid,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

  console.log('\n📖 브라우저에서 Allow → 자동으로 터미널에 돌아옵니다.\nURL:', authUrl, '\n');
  try { exec(`open "${authUrl}"`); } catch {
    // best effort
  }

  let code;
  try {
    code = await waitForCallback(server, state);
  } catch (e) {
    console.error('❌', e.message);
    process.exit(2);
  }
  console.log('✓ code 수신');

  const exRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cid,
      client_secret: csec,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const text = await exRes.text();
  let j;
  try { j = JSON.parse(text); } catch { console.log('RAW:', text); process.exit(3); }
  console.log('\n--- 교환 응답: status=' + exRes.status + ' ---');
  if (!j.refresh_token) {
    console.error('❌ refresh_token 없음. 응답:', j);
    console.error('↑ 이전 동의 기록 때문일 수 있습니다.');
    console.error('   https://myaccount.google.com/permissions 에서 앱 제거 후 재시도.');
    process.exit(4);
  }
  console.log(`refresh_token.len=${j.refresh_token.length}  scope="${j.scope}"`);

  // 받은 토큰 즉시 검증
  const vRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cid,
      client_secret: csec,
      refresh_token: j.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const vj = await vRes.json();
  console.log('--- refresh 검증: status=' + vRes.status + ' ---');
  if (!vj.access_token) {
    console.error('❌ refresh 실패:', vj);
    process.exit(5);
  }
  console.log(`✓ access_token 획득 (len=${vj.access_token.length})`);

  // .env 업데이트
  const key = 'GOOGLE_OAUTH_REFRESH_TOKEN';
  let next;
  if (new RegExp(`^${key}=.*$`, 'm').test(raw)) {
    next = raw.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${j.refresh_token}`);
  } else {
    next = raw + (raw.endsWith('\n') ? '' : '\n') + `${key}=${j.refresh_token}\n`;
  }
  fs.writeFileSync(ENV_PATH, next);
  console.log('✓ .env 갱신 완료 (GOOGLE_OAUTH_REFRESH_TOKEN)');
}

main().catch((e) => {
  console.error('❌ 예외:', e.message);
  process.exit(99);
});
