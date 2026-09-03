# CGV IMAX Watcher

CGV 용산아이파크몰의 특정 영화 IMAX 예매 일정을 확인하고, 새로운 상영일이 열리면 Discord로 알림을 보내는 TypeScript 기반 감시 도구입니다.

Playwright로 CGV 예매 페이지를 탐색한 뒤 날짜 및 상영 회차 API 응답을 확인합니다. 응답 지연이나 서버 오류가 발생한 경우에도 Discord 경고를 전송하며, GitHub Actions에서 수동으로 실행할 수 있습니다.

## 주요 기능

- 용산아이파크몰 IMAX 신규 상영일 감지
- 신규 상영 회차의 시작 시간과 잔여 좌석 확인
- Discord Webhook 알림 전송
- API 지연 및 오류 감지
- 실패 시 화면 캡처 저장

## 실행 방법

Node.js와 pnpm이 필요합니다.

```bash
pnpm install
pnpm exec playwright install chromium
```

프로젝트 루트에 `.env` 파일을 만들고 Discord Webhook URL을 설정합니다.

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
HEADLESS=true
```

다음 명령으로 타입을 검사하고 감시 작업을 실행합니다.

```bash
pnpm typecheck
pnpm start
```

감시 대상 극장, 영화, IMAX 코드와 기준 날짜는 `src/index.ts`의 `CONFIG`에서 변경할 수 있습니다.

## GitHub Actions

저장소의 **Actions → CGV IMAX Watcher → Run workflow**에서 작업을 수동 실행할 수 있습니다. 실행 전에 저장소 Secret에 `DISCORD_WEBHOOK_URL`을 등록해야 합니다.
