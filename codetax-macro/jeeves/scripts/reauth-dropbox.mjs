#!/usr/bin/env node
/* 드롭박스 refresh token 재발급 스크립트
 * 사용: cd jeeves && node scripts/reauth-dropbox.mjs
 * 기능:
 *  1) .env 에서 APP_KEY/SECRET 로드
 *  2) OAuth URL 열기
 *  3) 사용자로부터 code 입력
 *  4) 교환 → refresh_token 획득
 *  5) .env 에 바로 쓰기
 *  6) 즉시 refresh 테스트 + files.content.read 스코프 검증
 *  리포트 외에 토큰은 출력하지 않음.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { exec } from 'node:child_process';

const ENV_PATH = path.resolve(new URL('..', import.meta.url).pathname, '.env');
const SCOPES = [
  'files.metadata.read',
  'files.content.read',
  'files.content.write',
  'sharing.read',
  'team_data.member',
];

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
  const { DROPBOX_APP_KEY: k, DROPBOX_APP_SECRET: s } = env;
  if (!k || !s) {
    console.error('❌ .env 에 DROPBOX_APP_KEY / DROPBOX_APP_SECRET 없음');
    process.exit(1);
  }
  console.log(`.env 로드: appKey.len=${k.length} secret.len=${s.length}`);

  const url =
    'https://www.dropbox.com/oauth2/authorize?' +
    new URLSearchParams({
      client_id: k,
      response_type: 'code',
      token_access_type: 'offline',
      scope: SCOPES.join(' '),
      force_reapprove: 'true',
    });

  console.log('\n📖 브라우저에서 Allow → 화면의 code 복사\nURL:', url, '\n');
  try {
    exec(`open "${url}"`);
  } catch {
    // best effort
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('code 를 붙여넣고 Enter: ')).trim();
  rl.close();

  if (!code) {
    console.error('❌ code 가 비어있음');
    process.exit(2);
  }

  const auth = Buffer.from(`${k}:${s}`).toString('base64');
  const exRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
  });
  const exText = await exRes.text();
  let exJson;
  try { exJson = JSON.parse(exText); } catch { console.log('RAW:', exText); process.exit(3); }
  console.log('\n--- 교환 응답: status=' + exRes.status + ' ---');
  if (!exJson.refresh_token) {
    console.error('❌ refresh_token 없음. 응답:', exJson);
    process.exit(4);
  }
  console.log(`refresh_token.len=${exJson.refresh_token.length}  scope="${exJson.scope}"`);

  // Dropbox 일부 앱은 43~50자 짧은 refresh token 반환. 그래도 바로 refresh 검증.
  const vRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: exJson.refresh_token,
    }),
  });
  const vJson = await vRes.json();
  console.log('--- refresh 검증: status=' + vRes.status + ' ---');
  if (!vJson.access_token) {
    console.error('❌ 방금 받은 refresh_token 이 유효하지 않음:', vJson);
    console.error('↑ 이게 계속 나면 앱 설정(Access type) 또는 redirect URI 불일치 의심.');
    process.exit(5);
  }
  console.log(`✓ access_token 획득 (len=${vJson.access_token.length})`);

  // files.content.read 스코프 확인 (실패해도 .env 업데이트는 진행)
  const probe = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vJson.access_token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: '/__probe_zzz.bin' }),
    },
  });
  const probeText = await probe.text();
  if (/missing_scope/.test(probeText)) {
    console.error('⚠️ 여전히 files.content.read 스코프 없음 — App Console Permissions 에서 체크했는지 확인 후 Submit');
  } else if (/not_found|path_lookup|path_not_found/i.test(probeText)) {
    console.log('✅ files.content.read 스코프 OK (파일 없음 에러 — 정상)');
  } else {
    console.log('probe 응답:', probe.status, probeText.slice(0, 200));
  }

  // .env 업데이트
  const next = raw.replace(
    /^DROPBOX_REFRESH_TOKEN=.*$/m,
    'DROPBOX_REFRESH_TOKEN=' + exJson.refresh_token,
  );
  if (next === raw) {
    // 키가 아예 없던 경우엔 append
    fs.appendFileSync(ENV_PATH, '\nDROPBOX_REFRESH_TOKEN=' + exJson.refresh_token + '\n');
    console.log('✓ .env 에 DROPBOX_REFRESH_TOKEN 추가');
  } else {
    fs.writeFileSync(ENV_PATH, next);
    console.log('✓ .env 의 DROPBOX_REFRESH_TOKEN 갱신');
  }
  console.log('\n완료. 서버가 watch 모드면 자동 반영됩니다.');
}

main().catch((e) => {
  console.error('❌ 예외:', e.message);
  process.exit(99);
});
