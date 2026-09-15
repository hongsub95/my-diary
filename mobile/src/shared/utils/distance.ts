/**
 * 미터를 사람이 읽는 거리 문구로 바꾼다.
 *
 * @param meters 거리(m)
 * @returns 예: `320m`, `1.2km`
 *
 * 1km 미만은 10m 단위로 줄인다. 직선거리 계산값이라 한 자리까지 보여주면 실제보다
 * 정확한 값처럼 읽힌다. 근거가 약한 숫자에 정밀한 옷을 입히지 않는다.
 *
 * 웹의 shared/utils/distance.js와 같은 규칙이다.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
