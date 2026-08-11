export async function getImaxDates() {
  const url =
    'https://cgv.co.kr/api/v1/booking/searchSiteScnscYmdListByMov' +
    '?coCd=A420' +
    '&siteNo=0013' +
    '&movNo=30001323' +
    '&div=CUST_EXPO_MOVTYP_CD' +
    '&attrCd=04';

  const response = await fetch(url);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Fetch failed (${response.status} ${response.statusText}) from ${url}: ${bodyText}`,
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON response from ${url} but got '${contentType}'. Body starts: ${bodyText.slice(0, 300)}`,
    );
  }

  let result: any;
  try {
    result = JSON.parse(bodyText);
  } catch (err: any) {
    throw new Error(
      `Failed to parse JSON from ${url}: ${err?.message}. Body: ${bodyText.slice(0, 1000)}`,
    );
  }

  return result.data.map((item: { scnYmd: string }) => item.scnYmd);
}
