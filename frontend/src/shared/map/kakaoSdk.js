// 카카오맵 JavaScript SDK를 페이지에 한 번만 붙인다.
//
// 모바일(mobile/src/features/places/kakao-map-html.ts)은 WebView 안에 HTML을 통째로
// 만들어 넣지만, 웹은 페이지 자체가 웹이라 SDK를 그냥 올리면 된다. iframe을 끼우면
// 지도 크기 조절과 클릭 전달을 postMessage로 주고받아야 해서 더 복잡해진다.

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'

/** 키가 없으면 빈 문자열이다. 이 경우 지도를 그리지 않고 안내만 띄운다. */
export const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ?? ''

// 여러 컴포넌트가 동시에 지도를 그려도 <script>는 하나만 붙어야 한다.
let loading = null

/**
 * SDK를 불러온다. 이미 불러왔으면 그대로 돌려준다.
 *
 * @returns {Promise<object>} `kakao.maps` 네임스페이스
 * @throws 키가 없거나, 스크립트를 못 불러왔을 때
 *
 * **가장 흔한 실패는 도메인 미등록이다.** SDK는 요청의 Referer를 보고 카카오 개발자
 * 콘솔에 등록된 사이트 도메인이 아니면 401을 준다. 이때 브라우저는 본문을 읽을 수 없어
 * `onerror`만 오므로, 화면에는 원인을 특정하지 않고 "불러오지 못했다"로만 알린다.
 */
export function loadKakaoMaps() {
  if (!KAKAO_JS_KEY) {
    return Promise.reject(new Error('카카오 지도 키가 설정되지 않았습니다.'))
  }
  if (window.kakao?.maps?.LatLng) {
    return Promise.resolve(window.kakao.maps)
  }
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // autoload=false로 받아야 kakao.maps.load로 준비 시점을 잡을 수 있다. 기본값으로
    // 두면 스크립트가 실행되는 순간 초기화가 시작돼 우리가 끼어들 자리가 없다.
    script.src = `${SDK_URL}?autoload=false&appkey=${encodeURIComponent(KAKAO_JS_KEY)}`
    script.async = true
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error('카카오 지도를 불러오지 못했습니다.'))
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao.maps))
    }
    script.onerror = () => {
      // 다음 시도에서 다시 붙일 수 있도록 실패한 약속을 버린다. 남겨두면 한 번 실패한
      // 뒤로는 재시도 버튼을 눌러도 같은 실패가 즉시 돌아온다.
      loading = null
      script.remove()
      reject(new Error('카카오 지도를 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })

  return loading
}

/**
 * 지도에 찍을 수 있는 좌표인지 본다.
 *
 * @param {{latitude: string|number|null, longitude: string|number|null}} place
 *
 * 서버는 정밀도 손실을 막으려고 좌표를 문자열로 내려준다(docs/API_SPEC.md 6.2절).
 * 직접 입력한 장소는 좌표가 아예 없다.
 */
export function hasCoordinates(place) {
  const lat = Number(place?.latitude)
  const lng = Number(place?.longitude)
  if (place?.latitude === null || place?.longitude === null) return false
  if (place?.latitude === '' || place?.longitude === '') return false
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}
