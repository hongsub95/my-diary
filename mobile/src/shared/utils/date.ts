export function formatKoreanDateTime(utcIsoString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utcIsoString));
}

/**
 * UTC ISO 문자열을 한국 기준 날짜 키(YYYY-MM-DD)로 바꾼다.
 *
 * "오늘 일정인가"를 판단할 때 쓴다. Date의 getFullYear 같은 함수는 기기의 시간대를
 * 따르기 때문에, 해외에 있거나 기기 시간대가 어긋난 사용자에게는 날짜가 하루씩
 * 밀린다. 서비스 기준 시간대(Asia/Seoul)로 고정해 어디서 보든 같은 날로 묶는다.
 *
 * @param utcIsoString 서버가 준 UTC ISO 문자열
 * @returns "2026-08-26" 형태의 날짜 키
 */
export function seoulDateKey(utcIsoString: string): string {
  // en-CA 로캘의 날짜 형식이 정확히 YYYY-MM-DD라 문자열 비교에 그대로 쓸 수 있다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utcIsoString));
}

/**
 * 서버의 `HH:MM:SS`를 화면 문구로 바꾼다.
 *
 * @param value 예: `14:00:00`
 * @returns 예: `오후 2:00`. 값이 없으면 빈 문자열
 *
 * 날짜가 없는 값이라 Intl.DateTimeFormat에 그대로 넣을 수 없다. 오늘 날짜를 붙여
 * Date로 만들면 기기 시간대에 따라 시각이 밀리므로, 문자열을 그대로 쪼갠다.
 * 웹의 shared/utils/time.js와 같은 규칙이다.
 */
export function formatPlannedTime(value: string | null): string {
  if (!value) return '';
  const [rawHour, minute] = value.split(':');
  const hour = Number(rawHour);
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${minute}`;
}

/**
 * 서버 값을 시각 선택기가 쓰는 `HH:MM`으로 줄인다. 값이 없으면 빈 문자열이다.
 */
export function toTimeOption(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

/**
 * 시각 선택기의 `HH:MM`을 서버가 받는 `HH:MM:SS`로 늘린다.
 * 빈 값은 null이라 예정시각이 지워진다.
 */
export function toApiTime(value: string): string | null {
  return value ? `${value}:00` : null;
}
