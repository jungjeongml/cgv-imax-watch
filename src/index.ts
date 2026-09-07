import { chromium, errors, type Page, type Response } from 'playwright';
import type { CgvResponse, DateItem, Schedule } from './apiResponseTypes.js';
import { sendDiscordMessage, sendDiscordWarning } from './discord.js';

const CONFIG = {
  baselineDate: '20260915',
  companyCode: 'A420',
  siteNo: '0013', // cgv 용산 iparkmall 지점
  movieNo: '30001323',
  imaxAttributeCode: '04', //날짜 조회 요청에서 IMAX 상영 타입을 지정하는 코드
  imaxGradeCode: '03', //회차 조회 응답에서 해당 회차가 IMAX임을 판별하는 코드
} as const;

//날짜 조회 API 응답이 IMAX 날짜 조회 요청에 대한 것인지 판별
function isTargetDateResponse(response: Response): boolean {
  const url = new URL(response.url());

  return (
    url.pathname.endsWith('/searchSiteScnscYmdListByMov') &&
    url.searchParams.get('siteNo') === CONFIG.siteNo &&
    url.searchParams.get('movNo') === CONFIG.movieNo &&
    url.searchParams.get('attrCd') === CONFIG.imaxAttributeCode
  );
}

//CGV API 응답이 성공적인지 확인하고, 실패 시 예외를 던짐
function assertSuccessfulResponse<T>(
  result: CgvResponse<T>,
): asserts result is CgvResponse<T> {
  if (result.statusCode !== 0 || !Array.isArray(result.data)) {
    throw new Error(`CGV API 오류: ${result.statusMessage}`);
  }
}

async function getScheduleByDate(
  page: Page,
  date: string,
): Promise<CgvResponse<Schedule>> {
  const result = await page.evaluate<
    CgvResponse<Schedule>,
    { date: string; siteNo: string; movieNo: string; companyCode: string }
  >(
    async ({ date, siteNo, movieNo, companyCode }) => {
      const params = new URLSearchParams({
        coCd: companyCode,
        siteNo,
        scnYmd: date,
        movNo: movieNo,
        rtctlScopCd: '08',
      });

      const response = await fetch(`/api/v1/booking/searchSchByMov?${params}`, {
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new Error(`스케줄 API 실패: ${response.status}`);
      }

      return response.json();
    },
    {
      date,
      siteNo: CONFIG.siteNo,
      movieNo: CONFIG.movieNo,
      companyCode: CONFIG.companyCode,
    },
  );

  assertSuccessfulResponse(result);
  return result;
}

function filterTargetSchedules(schedules: Schedule[]): Schedule[] {
  return schedules.filter(
    (schedule) =>
      schedule.siteNo === CONFIG.siteNo &&
      schedule.movNo === CONFIG.movieNo &&
      schedule.tcscnsGradCd === CONFIG.imaxGradeCode,
  );
}

async function main() {
  const browser = await chromium.launch({
    headless: process.env.HEADLESS === 'true',
  });

  try {
    const page = await browser.newPage();

    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);

    const navigationResponse = await page.goto(
      'https://cgv.co.kr/cnm/movieBook/movie',
      { waitUntil: 'domcontentloaded' },
    );

    console.log('페이지 HTTP 상태:', navigationResponse?.status());
    console.log('현재 URL:', page.url());
    console.log('페이지 제목:', await page.title());

    if (!navigationResponse?.ok()) {
      await sendDiscordWarning(
        [
          '⚠️ **CGV 페이지 접속 불가 **',
          '',
          `페이지 HTTP 상태: ${navigationResponse?.status()}, 접속 실패`,
          '',
          `확인 시각: ${new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
          })}`,
          '',
          'https://cgv.co.kr/cnm/movieBook/movie',
        ].join('\n'),
      );
      throw new Error(
        `CGV 페이지 접속 실패: HTTP ${navigationResponse?.status()}`,
      );
    }

    const activeModal = page.locator(
      '.cgv-modal.cgv-bot-modal[role="dialog"].active',
    );

    let modalOpened = false;

    try {
      await activeModal.waitFor({
        state: 'visible',
        timeout: 10_000,
      });

      modalOpened = true;
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) {
        throw error;
      }
    }

    console.log('모달 활성화 여부:', modalOpened);
    if (modalOpened) {
      await activeModal
        .getByRole('button', { name: '닫기', exact: true })
        .click();
      await activeModal.waitFor({
        state: 'hidden',
        timeout: 5_000,
      });
      console.log('초기 모달 닫기 완료');
    }

    const showAllButton = page.getByRole('button', {
      name: '전체보기',
      exact: true,
    });

    try {
      await showAllButton.waitFor({
        state: 'visible',
        timeout: 30_000,
      });
    } catch (error) {
      console.error('현재 URL:', page.url());
      console.error('페이지 제목:', await page.title());

      const bodyText = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      console.error('페이지 본문:', bodyText.slice(0, 3000));

      await page.screenshot({
        path: 'cgv-failure.png',
        fullPage: true,
      });

      throw error;
    }

    await showAllButton.click();
    await page
      .getByRole('button', { name: '오디세이 포스터 오디세이', exact: true })
      .click();
    await page.getByRole('button', { name: 'IMAX', exact: true }).click();
    await page
      .getByRole('button', { name: '자주가는 CGV 목록 수정', exact: true })
      .click();

    //waitForResponse는 이미 호출된 api에 대해서는 동작하지 않음
    //인자:문자열(완전한 URL/패턴), 정규식(RegExp), 또는 판별 함수((resp: Response) => boolean)
    let dateResponse: Response;

    try {
      [dateResponse] = await Promise.all([
        page.waitForResponse(isTargetDateResponse, {
          timeout: 60_000,
        }),

        (async () => {
          await page
            .getByRole('button', {
              name: '용산아이파크몰',
              exact: true,
            })
            .click();

          await page
            .getByRole('button', {
              name: '극장선택',
              exact: true,
            })
            .click();
        })(),
      ]);
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        await sendDiscordWarning(
          [
            '⚠️ **CGV 날짜 조회 지연 감지**',
            '',
            '60초 동안 용산 IMAX 날짜 응답을 받지 못했습니다.',
            '트래픽 급증 또는 예매 오픈 가능성이 있으니 CGV 앱을 직접 확인하세요.',
            '',
            `확인 시각: ${new Date().toLocaleString('ko-KR', {
              timeZone: 'Asia/Seoul',
            })}`,
            '',
            'https://cgv.co.kr/cnm/movieBook/movie',
          ].join('\n'),
        );
      }

      throw error;
    }

    if (!dateResponse.ok()) {
      const status = dateResponse.status();

      const overloadLikely = [429, 502, 503, 504].includes(status);

      await sendDiscordWarning(
        [
          '⚠️ **CGV 날짜 API 오류 감지**',
          '',
          `HTTP 상태: ${status}`,
          overloadLikely
            ? '트래픽 급증 또는 예매 오픈 가능성이 있으니 CGV 앱을 직접 확인하세요.'
            : 'CGV 서버 장애 또는 접근 제한일 수 있으니 실행 로그를 확인하세요.',
          '',
          `확인 시각: ${new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
          })}`,
          '',
          'https://cgv.co.kr/cnm/movieBook/movie',
        ].join('\n'),
      );

      throw new Error(`CGV 날짜 API 실패: HTTP ${status}`);
    }

    const dateResult = (await dateResponse.json()) as CgvResponse<DateItem>;

    assertSuccessfulResponse(dateResult);

    const dates: string[] = [
      ...new Set(dateResult.data.map((item: DateItem) => item.scnYmd)),
    ];

    const newDates = dates.filter((date: string) => date > CONFIG.baselineDate);

    console.log('현재 IMAX 날짜:', dates);
    console.log('새로 열린 날짜:', newDates);

    if (newDates.length > 0) {
      const message = [
        '🚨 **용아맥 오디세이 신규 회차 발견!**',
        newDates.join(', '),
      ].join('\n');
      await sendDiscordMessage(message);
    }

    for (const date of newDates) {
      const scheduleResult = await getScheduleByDate(page, date);
      const schedules = filterTargetSchedules(scheduleResult.data);

      if (schedules.length === 0) continue;

      console.log(`🚨 ${date} 용산 IMAX 신규 회차 발견`);

      const scheduleLines = schedules.map((schedule) => {
        const startTime =
          `${schedule.scnsrtTm.slice(0, 2)}:` + `${schedule.scnsrtTm.slice(2)}`;

        return [
          `• ${startTime}`,
          `• ${schedule.scnsNm}`,
          `• 잔여 좌석 ${schedule.frSeatCnt}/${schedule.stcnt}`,
        ].join('\n');
      });

      console.log('신규 회차 정보:\n', scheduleLines.join('\n\n'));
    }
  } catch (error) {
    console.error('오류 발생:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('CGV 감시 실패:', error);
  process.exitCode = 1;
});
