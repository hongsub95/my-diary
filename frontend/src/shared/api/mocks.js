function demoDateTime(dayOffset, hour, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)

  const localDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `${localDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

export const MOCK_SCHEDULES = [
  {
    id: 'today-1',
    title: '망원동 산책과 저녁',
    start_at: demoDateTime(0, 14),
    end_at: demoDateTime(0, 19),
    status: 'planned',
    places: [
      { id: 'today-place-1', sort_order: 1, name: '망원한강공원', address: '서울 마포구 마포나루길 467', memo: '산책하기', visited: false },
      { id: 'today-place-2', sort_order: 2, name: '망원시장', address: '서울 마포구 포은로8길 14', memo: '간식 사기', visited: false },
      { id: 'today-place-3', sort_order: 3, name: '소금집 델리', address: '서울 마포구 월드컵로19길 14', memo: '저녁 식사', visited: false },
    ],
    diary: null,
  },
  {
    id: 'week-1',
    title: '전시 보러 가기',
    start_at: demoDateTime(2, 11),
    end_at: demoDateTime(2, 15),
    status: 'planned',
    places: [
      { id: 'week-place-1', sort_order: 1, name: '서울시립미술관', address: '서울 중구 덕수궁길 61', memo: '', visited: false },
    ],
    diary: null,
  },
  {
    id: '1',
    title: '한강 피크닉',
    start_at: '2026-07-26T14:00:00',
    end_at: '2026-07-26T18:00:00',
    status: 'planned',
    places: [
      { id: '1', sort_order: 1, name: '여의도 한강공원', address: '서울 영등포구 여의동로 330', memo: '돗자리 챙기기', visited: false },
      { id: '2', sort_order: 2, name: '더현대 서울', address: '서울 영등포구 여의대로 108', memo: '', visited: false },
    ],
    diary: null,
  },
  {
    id: '2',
    title: '성수 카페 투어',
    start_at: '2026-07-20T12:00:00',
    end_at: '2026-07-20T17:00:00',
    status: 'completed',
    places: [
      { id: '3', sort_order: 1, name: '어니언 성수', address: '서울 성동구 아차산로9길 8', memo: '사진 많이 찍기', visited: true },
      { id: '4', sort_order: 2, name: '블루보틀 성수', address: '서울 성동구 왕십리로2길 20-12', memo: '', visited: true },
    ],
    diary: {
      content: '오늘 성수 카페 투어 너무 좋았다. 어니언은 역시 분위기 최고!',
      mood: '😊',
    },
  },
  {
    id: '3',
    title: '북촌 한옥마을 산책',
    start_at: '2026-07-15T10:00:00',
    end_at: '2026-07-15T14:00:00',
    status: 'completed',
    places: [
      { id: '5', sort_order: 1, name: '북촌 한옥마을', address: '서울 종로구 북촌로', memo: '', visited: true },
      { id: '6', sort_order: 2, name: '삼청동 카페거리', address: '서울 종로구 삼청동', memo: '', visited: true },
    ],
    diary: {
      content: '한옥마을 골목길이 너무 예뻤다. 다음엔 가을에 오고 싶다.',
      mood: '😌',
    },
  },
  {
    id: '4',
    title: '강남 맛집 탐방',
    start_at: '2026-08-03T18:00:00',
    end_at: '2026-08-03T21:00:00',
    status: 'planned',
    places: [
      { id: '7', sort_order: 1, name: '봉피양 강남점', address: '서울 강남구 테헤란로 151', memo: '예약 확인하기', visited: false },
    ],
    diary: null,
  },
]
