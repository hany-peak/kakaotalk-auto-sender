import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

const NUT_PATH = path.resolve(__dirname, '../../../../../kakao-automation/node_modules/@computer-use/nut-js');

function loadNutJs() {
  try {
    return require(NUT_PATH);
  } catch (e: any) {
    throw new Error(`nut-js load failed. Run npm install in kakao-automation folder.\n${e.message}`);
  }
}

const runCommand = (cmd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(cmd, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });

interface SendTarget {
  name: string;
  bizNo: string;
  groupName: string;
  imagePath: string | null;
}

interface SendStats {
  success: number;
  failed: number;
  skipped: number;
}

export async function runKakaoSend(
  targets: SendTarget[],
  message: string,
  cardImagePath: string,
  isStopped: () => boolean,
  log: (msg: string) => void,
  onStatus: (bizNo: string, status: string) => void,
): Promise<SendStats> {
  const { keyboard, Key, sleep } = loadNutJs();
  keyboard.config.autoDelayMs = 50;

  const wait = (ms: number) => sleep(ms);
  const randomWait = (min: number, max: number) =>
    sleep(Math.floor(Math.random() * (max - min + 1)) + min);

  const DELAY = {
    appLaunch: 3000,
    afterShortcut: 800,
    afterSearch: 1500,
    afterOpenChat: 1000,
    afterImageAttach: 2000,
  };

  const stats: SendStats = { success: 0, failed: 0, skipped: 0 };

  log('launching KakaoTalk...');
  await runCommand('open -a KakaoTalk');
  await wait(DELAY.appLaunch);
  await runCommand(`osascript -e 'tell application "KakaoTalk" to activate'`);
  await wait(1000);
  log('KakaoTalk ready');

  log('opening chat list (Cmd+2)');
  await keyboard.pressKey(Key.LeftSuper, Key.Digit2);
  await keyboard.releaseKey(Key.LeftSuper, Key.Digit2);
  await wait(DELAY.afterShortcut);

  for (let i = 0; i < targets.length; i++) {
    if (isStopped()) {
      log('stop requested');
      break;
    }
    const { name, bizNo, groupName, imagePath } = targets[i];
    log(`\n[${i + 1}/${targets.length}] ${name} (${bizNo}) -> ${groupName}`);
    onStatus(bizNo, 'sending');

    try {
      log(`  search (Cmd+F)`);
      await keyboard.pressKey(Key.LeftSuper, Key.F);
      await keyboard.releaseKey(Key.LeftSuper, Key.F);
      await wait(DELAY.afterShortcut);

      await keyboard.pressKey(Key.LeftSuper, Key.A);
      await keyboard.releaseKey(Key.LeftSuper, Key.A);
      await keyboard.pressKey(Key.Delete);
      await keyboard.releaseKey(Key.Delete);
      await wait(200);

      log(`  typing "${groupName}"...`);
      await keyboard.type(groupName);
      await wait(DELAY.afterSearch);

      let hasResult = true;
      try {
        const r = await runCommand(
          `osascript -e 'tell application "System Events" to tell process "KakaoTalk" to return (count of rows of table 1 of scroll area 1 of window 1) > 0'`,
        );
        hasResult = r.trim() === 'true';
      } catch {
        /* ignore */
      }

      if (!hasResult) {
        log(`  "${groupName}" not found, skipping`);
        await keyboard.pressKey(Key.Escape);
        await keyboard.releaseKey(Key.Escape);
        await wait(500);
        onStatus(bizNo, 'skipped');
        stats.skipped++;
        continue;
      }

      log(`  opening chat`);
      await keyboard.pressKey(Key.Down);
      await keyboard.releaseKey(Key.Down);
      await wait(300);
      await keyboard.pressKey(Key.Return);
      await keyboard.releaseKey(Key.Return);
      await wait(DELAY.afterOpenChat);

      if (message && message.trim()) {
        log(`  sending message...`);
        const tmpMsg = `/tmp/kakao_msg_${Date.now()}.txt`;
        fs.writeFileSync(tmpMsg, message.trim(), 'utf8');
        await runCommand(`pbcopy < "${tmpMsg}"`);
        try { fs.unlinkSync(tmpMsg); } catch {}
        await wait(200);
        await keyboard.pressKey(Key.LeftSuper, Key.V);
        await keyboard.releaseKey(Key.LeftSuper, Key.V);
        await wait(DELAY.afterOpenChat);
        await keyboard.pressKey(Key.Return);
        await keyboard.releaseKey(Key.Return);
        await randomWait(800, 1200);
        log(`  message sent`);
      }

      if (cardImagePath && fs.existsSync(cardImagePath)) {
        log(`  sending card image: ${path.basename(cardImagePath)}`);
        await runCommand(
          `osascript -e 'set the clipboard to (read (POSIX file "${cardImagePath}") as JPEG picture)'`,
        );
        await wait(500);
        await keyboard.pressKey(Key.LeftSuper, Key.V);
        await keyboard.releaseKey(Key.LeftSuper, Key.V);
        await wait(DELAY.afterImageAttach);
        await keyboard.type('\n');
        await randomWait(1000, 2000);
        log(`  card image sent`);
      }

      if (imagePath && fs.existsSync(imagePath)) {
        log(`  sending biz image: ${path.basename(imagePath)}`);
        await runCommand(
          `osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as JPEG picture)'`,
        );
        await wait(500);
        await keyboard.pressKey(Key.LeftSuper, Key.V);
        await keyboard.releaseKey(Key.LeftSuper, Key.V);
        await wait(DELAY.afterImageAttach);
        await keyboard.type('\n');
        await randomWait(1000, 2000);
        log(`  biz image sent`);
      } else {
        log(`  no biz image (path: ${imagePath || 'none'})`);
      }

      log(`  closing chat (Cmd+W)`);
      await keyboard.pressKey(Key.LeftSuper, Key.W);
      await keyboard.releaseKey(Key.LeftSuper, Key.W);
      await wait(500);

      log(`done [${i + 1}/${targets.length}] "${name}"`);
      onStatus(bizNo, 'done');
      stats.success++;
    } catch (err: any) {
      log(`failed "${name}": ${err.message}`);
      onStatus(bizNo, 'failed');
      stats.failed++;
    }

    if (i < targets.length - 1) {
      await randomWait(1000, 2000);
    }
  }

  log(`\nKakaoTalk send complete - success ${stats.success} / failed ${stats.failed} / skipped ${stats.skipped}`);
  return stats;
}
