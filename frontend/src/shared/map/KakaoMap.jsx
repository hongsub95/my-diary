import { useEffect, useRef, useState } from 'react'
import { hasCoordinates, KAKAO_JS_KEY, loadKakaoMaps } from './kakaoSdk'
import './map.css'

/**
 * 장소를 번호 마커로 찍는 지도.
 *
 * @param {object} props
 * @param {Array<{id: string|number, name: string, latitude: *, longitude: *}>} props.places
 *   순서가 곧 번호다. 일정 상세의 1·2·3번 장소와 같은 번호를 쓴다.
 * @param {string|number} [props.selectedId] 강조할 장소
 * @param {(id: string) => void} [props.onSelect] 마커를 눌렀을 때. 없으면 읽기 전용 지도다
 *
 * **마커를 눌러도 저장되지 않는다.** 고르는 것과 담는 것을 분리해서, 지도를 훑어보다가
 * 실수로 담기는 일이 없게 한다. 실제로 담는 것은 목록 아래의 담기 버튼이 한다.
 *
 * 좌표가 있는 장소만 찍는다. 직접 입력한 장소는 좌표가 없어서 지도에 못 올린다.
 */
export default function KakaoMap({ places, selectedId, onSelect }) {
  const container = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const [status, setStatus] = useState('loading')
  // 다시 시도 버튼이 effect를 한 번 더 돌게 하는 값이다.
  const [attempt, setAttempt] = useState(0)

  const points = places.filter(hasCoordinates)

  useEffect(() => {
    if (points.length === 0) return undefined

    let alive = true
    setStatus('loading')

    loadKakaoMaps()
      .then((maps) => {
        if (!alive || !container.current) return

        // 지도를 매번 새로 만들지 않는다. 장소가 바뀔 때마다 만들면 사용자가 옮겨둔
        // 화면 위치가 초기화된다.
        if (!mapRef.current) {
          mapRef.current = new maps.Map(container.current, {
            center: new maps.LatLng(37.5665, 126.978),
            level: 5,
          })
        }
        const map = mapRef.current

        overlaysRef.current.forEach((overlay) => overlay.setMap(null))
        overlaysRef.current = []

        const bounds = new maps.LatLngBounds()
        points.forEach((place, index) => {
          const position = new maps.LatLng(Number(place.latitude), Number(place.longitude))
          bounds.extend(position)

          const pin = document.createElement('button')
          pin.type = 'button'
          pin.className = 'kakao-pin'
          if (String(place.id) === String(selectedId)) pin.classList.add('kakao-pin--active')
          pin.textContent = `${index + 1} ${place.name}`
          pin.setAttribute('aria-label', `${index + 1}번 ${place.name}`)
          if (onSelect) pin.onclick = () => onSelect(String(place.id))
          else pin.disabled = true

          const overlay = new maps.CustomOverlay({ map, position, content: pin, yAnchor: 1.2 })
          overlaysRef.current.push(overlay)
        })

        // relayout을 먼저 부른다. 접혀 있던 영역에서 지도를 만들면 크기를 0으로 잡아
        // 아무것도 안 보인다.
        map.relayout()
        if (points.length === 1) {
          map.setCenter(new maps.LatLng(Number(points[0].latitude), Number(points[0].longitude)))
          map.setLevel(3)
        } else {
          map.setBounds(bounds, 45, 45, 45, 45)
        }
        setStatus('ready')
      })
      .catch(() => {
        if (alive) setStatus(KAKAO_JS_KEY ? 'error' : 'nokey')
      })

    return () => {
      alive = false
    }
    // points/onSelect는 매 렌더 새 참조라 의존성에 넣으면 무한 루프가 된다. 좌표와
    // 선택만 바뀌었을 때 다시 그리도록 값으로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points.map((p) => [p.id, p.latitude, p.longitude, p.name])), selectedId, attempt])

  if (points.length === 0) {
    return <p className="kakao-map__notice">좌표가 있는 장소를 담으면 지도에 표시됩니다.</p>
  }

  return (
    <div className="kakao-map">
      <div ref={container} className="kakao-map__canvas" aria-label="장소 지도" />

      {status === 'loading' && <p className="kakao-map__status">지도를 불러오는 중…</p>}

      {status === 'nokey' && (
        <p className="kakao-map__status">
          지도를 준비하고 있어요. 장소 목록은 그대로 사용할 수 있습니다.
        </p>
      )}

      {status === 'error' && (
        <div className="kakao-map__status">
          <span>지도를 불러오지 못했어요.</span>
          <button type="button" className="kakao-map__retry" onClick={() => setAttempt(attempt + 1)}>
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}
