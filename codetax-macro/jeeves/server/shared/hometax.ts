import type { Page, Frame } from 'playwright';

export async function findSelector(
  page: Page,
  selectorString: string,
  timeout = 5000,
): Promise<{ frame: Page | Frame; sel: string } | null> {
  const selectors = selectorString.split(', ');
  const frames: (Page | Frame)[] = [page, ...page.frames()];
  const perFrame = Math.max(300, Math.floor(timeout / frames.length));

  for (const frame of frames) {
    for (const sel of selectors) {
      try {
        await frame.waitForSelector(sel, { timeout: perFrame, state: 'visible' });
        return { frame, sel };
      } catch {
        /* next */
      }
    }
  }
  return null;
}

export async function clickSelector(
  page: Page,
  selectorString: string,
  timeout = 5000,
): Promise<boolean> {
  const result = await findSelector(page, selectorString, timeout);
  if (!result) return false;
  await result.frame.click(result.sel);
  return true;
}

export async function fillSelector(
  page: Page,
  selectorString: string,
  value: string,
  timeout = 5000,
): Promise<boolean> {
  const result = await findSelector(page, selectorString, timeout);
  if (!result) return false;
  await result.frame.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    ({ sel, val }: { sel: string; val: string }) => {
      // runs in browser context — DOM globals are available at runtime
      // @ts-ignore
      const el = document.querySelector(sel) as HTMLInputElement | null; // eslint-disable-line
      if (!el) return;
      // @ts-ignore
      el.value = val; // eslint-disable-line
      // @ts-ignore
      el.dispatchEvent(new Event('input', { bubbles: true })); // eslint-disable-line
      // @ts-ignore
      el.dispatchEvent(new Event('change', { bubbles: true })); // eslint-disable-line
    },
    { sel: result.sel, val: value },
  );
  return true;
}
