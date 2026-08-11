import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  const BASELINE_DATE = '20260825';

  page.on('response', async (response) => {
    if (response.url().includes('searchSiteScnscYmdListByMov')) {
      try {
        const json = await response.json();

        console.log('🎯 날짜 API 응답');

        const dates = json.data.map((item: { scnYmd: string }) => item.scnYmd);
        console.log('현재 IMAX 날짜:', dates);

        const newDates = dates.filter((date: string) => date > BASELINE_DATE);
        console.log('새로 열린 날짜:', newDates);
      } catch (error) {
        console.error('응답처리실패', error);
      }
    }
  });

  async function getScheduleByDate(page: any, date: string) {
    return await page.evaluate(async (date) => {
      const response = await fetch(
        `/api/v1/booking/searchSchByMov` +
          `?coCd=A420` +
          `&siteNo=0013` +
          `&scnYmd=${date}` +
          `&movNo=30001323` +
          `&rtctlScopCd=08`,
      );

      if (!response.ok) {
        throw new Error(`스케줄 API 실패: ${response.status}`);
      }

      return response.json();
    }, date);
  }

  await page.goto('https://cgv.co.kr/cnm/movieBook/movie', {
    waitUntil: 'domcontentloaded',
  });

  console.log('CGV 접속 완료');

  await page.getByRole('button', { name: '오디세이 포스터 오디세이' }).click();
  await page.getByRole('button', { name: '자주가는 CGV 목록 수정' }).click();
  await page.getByTitle(' ', { exact: true }).click();
  await page.getByRole('button', { name: '용산아이파크몰' }).click();
  await page.getByRole('button', { name: '극장선택' }).click();

  const scheduleJson = await getScheduleByDate(page, BASELINE_DATE);

  console.log('🎯 25일 스케줄');
  console.log(scheduleJson);

  // 테스트할 동안 브라우저 유지
  await page.waitForTimeout(60_000);

  await browser.close();
}

main();
