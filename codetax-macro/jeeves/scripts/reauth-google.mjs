#!/usr/bin/env node
/* Google OAuth refresh token 재발급 스크립트
 * 사용: cd jeeves && node scripts/reauth-google.mjs
 *
 * 사전 준비:
 *   1) https://console.cloud.google.com/apis/credentials 에서
 *      OAuth 2.0 클라이언트 ID 생성 (유형: "데스크톱 앱" / Desktop app)
 *   2) OAuth 동의 화면 설정 (테스트 사용자에 본인 이메일 추가)
 *   3) https://console.cloud.google.com/apis/library/drive.googleapis.com 에서
 *      Google Drive API 사용 설정
 *   4) 생성된 클라이언트의 JSON 다운받아 Client ID 와 Client Secret 을 .env 에:
 *        GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
 *        GOOGLE_OAUTH_CLIENT_SECRET=yyyyyyyyyyyy
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { exec } from 'node:child_process';

const ENV_PATH = path.resolve(new URL('..', import.meta.url).pathname, '.env');
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // out-of-band (코드를 화면에 표시)
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function parseEnv(raw) {
  return raw.split('\n').reduce((a, l) => {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, '');
    return a;
  }, {});
}

async function main() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = parseEnv(raw);
  const { GOOGLE_OAUTH_CLIENT_ID: cid, GOOGLE_OAUTH_CLIENT_SECRET: csec } = env;
  if (!cid || !csec) {
    console.error('❌ .env 에 GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 먼저 넣어주세요.');
    console.error('   https://console.cloud.google.com/apis/credentials 에서 OAuth 2.0 Desktop app 생성.');
    process.exit(1);
  }
  console.log(`.env 로드: client_id.len=${cid.length} secret.len=${csec.length}`);

  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: cid,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent', // refresh_token 재발급 보장
    });

  console.log('\n📖 브라우저에서 Allow → 화면의 code 복사\nURL:', url, '\n');
  try { exec(`open "${url}"`); } catch {
    // best effort
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('code 를 붙여넣고 Enter: ')).trim();
  rl.close();
  if (!code) { console.error('❌ code 비어있음'); process.exit(2); }

  const exRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cid,
      client_secret: csec,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const text = await exRes.text();
  let j;
  try { j = JSON.parse(text); } catch { console.log('RAW:', text); process.exit(3); }
  console.log('\n--- 교환 응답: status=' + exRes.status + ' ---');
  if (!j.refresh_token) {
    console.error('❌ refresh_token 없음. 응답:', j);
    console.error('↑ prompt=consent 가 걸렸는데도 없으면 이전 승인 흔적 때문. ');
    console.error('   https://myaccount.google.com/permissions 에서 앱 접근 권한 제거 후 다시 시도.');
    process.exit(4);
  }
  console.log(`refresh_token.len=${j.refresh_token.length}  scope="${j.scope}"`);

  // 방금 받은 토큰으로 access_token 재-발급 검증
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
    console.error('❌ 방금 받은 refresh_token 로 access_token 획득 실패:', vj);
    process.exit(5);
  }
  console.log(`✓ access_token 획득 (len=${vj.access_token.length})`);

  // .env 업데이트 (없으면 append)
  const key = 'GOOGLE_OAUTH_REFRESH_TOKEN';
  let next = raw;
  if (new RegExp(`^${key}=.*$`, 'm').test(raw)) {
    next = raw.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${j.refresh_token}`);
  } else {
    next = raw + (raw.endsWith('\n') ? '' : '\n') + `${key}=${j.refresh_token}\n`;
  }
  fs.writeFileSync(ENV_PATH, next);
  console.log('✓ .env 갱신 완료 (GOOGLE_OAUTH_REFRESH_TOKEN)');
  console.log('\n완료. 서버가 watch 모드면 자동 반영됩니다.');
}

main().catch((e) => {
  console.error('❌ 예외:', e.message);
  process.exit(99);
});
