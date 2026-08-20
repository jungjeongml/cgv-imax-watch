import 'dotenv/config';

export async function sendDiscordWarning(message: string): Promise<void> {
  try {
    await sendDiscordMessage(message);
  } catch (error) {
    // Discord 전송 실패 때문에 원래 CGV 오류를 잃지 않도록 함
    console.error('Discord 경고 전송 실패:', error);
  }
}

export async function sendDiscordMessage(content: string): Promise<void> {
  const webhookUrlValue = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrlValue) {
    throw new Error('DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.');
  }

  const webhookUrl = new URL(webhookUrlValue);

  // Discord가 저장한 메시지 결과를 응답하도록 설정
  webhookUrl.searchParams.set('wait', 'true');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      username: 'CGV IMAX 감시봇',
      allowed_mentions: {
        parse: [],
      },
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new Error(`Discord 알림 실패: ${response.status} ${responseBody}`);
  }
}
