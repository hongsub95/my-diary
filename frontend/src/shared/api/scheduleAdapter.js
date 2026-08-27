// API 응답을 화면이 쓰는 형태로 바꾸는 자리.
//
// 화면 컴포넌트가 API 응답 구조에 직접 의존하지 않게 한다는 결정(docs/DEVELOPMENT_BRIEF.md
// 7절)에 따른 것이다. 응답 형태가 바뀌면 이 파일만 고치면 되고, 웹과 앱이 각자 자기
// 화면에 맞는 모양으로 변환한다.

const SERVICE_TIME_ZONE = 'Asia/Seoul'

// en-CA 로캘의 날짜 형식이 정확히 YYYY-MM-DD라 문자열 비교에 그대로 쓸 수 있다.
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * UTC 시각을 한국 기준 날짜 키(YYYY-MM-DD)로 바꾼다.
 *
 * 캘린더와 홈이 "며칠 일정인가"로 묶을 때 쓴다. ISO 문자열 앞 10자를 자르면 UTC 날짜가
 * 나오는데, 밤 9시 이후(KST) 일정은 UTC로 다음 날이라 하루 밀린 칸에 찍힌다.
 *
 * @param {string} utcIsoString 서버가 준 UTC ISO 문자열
 * @returns {string} "2026-08-27" 형태
 */
export function toServiceDateKey(utcIsoString) {
  return dateKeyFormatter.format(new Date(utcIsoString))
}

/**
 * 장소 응답 하나를 화면용으로 평평하게 만든다.
 *
 * API는 장소를 두 층으로 준다. 최상위 id는 "이 일정에 담긴 장소"의 id이고,
 * place.id는 장소 자체의 id다(API_SPEC 6.1). 수정·삭제·순서변경에 쓰는 값은 앞의
 * 것이므로 화면에는 그쪽을 id로 넘기고, 장소 자체의 id는 placeId로 따로 남긴다.
 *
 * @param {object} item SchedulePlaceResponse
 */
function toPlaceView(item) {
  return {
    id: item.id,
    placeId: item.place.id,
    name: item.place.name,
    address: item.place.address,
    // 좌표는 정밀도 손실을 막으려고 문자열로 온다(API_SPEC 6.2). 지도에 찍을 때 숫자로 바꾼다.
    latitude: item.place.latitude,
    longitude: item.place.longitude,
    sort_order: item.sort_order,
    planned_time: item.planned_time,
    memo: item.memo,
    visited: item.visited,
  }
}

/**
 * 일정 응답 하나를 화면용으로 바꾼다.
 *
 * @param {object} schedule ScheduleResponse
 * @returns {object} 화면이 쓰는 일정 모델
 */
export function toScheduleView(schedule) {
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    start_at: schedule.start_at,
    end_at: schedule.end_at,
    status: schedule.status,
    space_name: schedule.space_name,
    // 날짜별로 묶을 때 쓰는 키. 화면마다 다시 계산하면 시간대 처리가 어긋난다.
    date_key: toServiceDateKey(schedule.start_at),
    // 장소 개수는 include 여부와 상관없이 항상 온다. 목록에서 "3곳" 같은 요약을 쓸 때는
    // places.length가 아니라 이 값을 봐야 한다. 장소를 요청하지 않은 화면도 정확하다.
    place_count: schedule.place_count,
    has_diary: schedule.has_diary,
    // 서버가 null을 주면(=장소를 요청하지 않음) 화면에서 순회할 수 있게 빈 배열로 둔다.
    // 실제 장소 유무는 place_count로 판단한다.
    places: (schedule.places ?? []).map(toPlaceView),
    // 일기 본문은 아직 API가 없다(app/diaries에 모델만 있음). 화면은 이 값이 null이면
    // "일기 쓰기" 빈 상태를 보여주므로, 일기 API가 생기면 여기만 채우면 된다.
    diary: null,
  }
}

/**
 * 상세 응답과 장소 목록을 합쳐 화면용 일정으로 만든다.
 *
 * 상세 조회는 include를 받지 않아 장소가 따로 오기 때문에 여기서 합친다.
 *
 * @param {object} schedule ScheduleResponse
 * @param {Array} placeItems SchedulePlaceResponse 배열
 */
export function toScheduleDetailView(schedule, placeItems) {
  return {
    ...toScheduleView(schedule),
    places: placeItems.map(toPlaceView),
  }
}
