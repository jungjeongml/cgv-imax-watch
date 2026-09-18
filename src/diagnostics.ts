import { mkdir, writeFile } from 'node:fs/promises';
import type { Page, Response } from 'playwright';

// Keep only diagnostic headers; never persist Set-Cookie or request credentials.
const DIAGNOSTIC_HEADERS = /^(content-type|content-length|server|date|via|retry-after|location|x-cache|x-cache-hits|x-request-id|x-correlation-id|x-amz-cf-id|x-amz-cf-pop|cf-ray|cf-cache-status|server-timing)$/i;

export async function saveNavigationDiagnostics(
  page: Page,
  response: Response | null,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const capture = async () => {
      await mkdir('cgv-diagnostics', { recursive: true });
      const headers = response ? await response.allHeaders() : {};
      const body = response ? await response.text() : '';
      await writeFile('cgv-diagnostics/navigation.json', JSON.stringify({
        capturedAt: new Date().toISOString(),
        runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
        commit: process.env.GITHUB_SHA ?? null,
        environment: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
        url: page.url(),
        status: response?.status() ?? null,
        headers: Object.fromEntries(Object.entries(headers).filter(([name]) => DIAGNOSTIC_HEADERS.test(name))),
        bodyPreview: body.slice(0, 32_768),
        bodyTruncated: body.length > 32_768,
      }, null, 2));
      if (response && !response.ok()) {
        await page.screenshot({ path: 'cgv-diagnostics/navigation.png', timeout: 3_000 });
      }
    };
    await Promise.race([
      capture(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('진단 저장 제한 시간 초과')), 5_000);
      }),
    ]);
  } catch (error) {
    // Diagnostics must not replace the original navigation result.
    console.warn('CGV 진단 저장 실패:', error);
  } finally {
    clearTimeout(timer);
  }
}
