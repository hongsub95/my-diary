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
