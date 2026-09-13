import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from './kakaoSdk'
import './map.css'

export default function LocationMap({ center, point, onPick }) {
  const container = useRef(null)
  const callback = useRef(onPick)
  callback.current = onPick
  const mapRef = useRef(null)
  const marker = useRef(null)
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    let listener
    let mapsApi
    let resize
    setStatus('loading')
    const timeout = setTimeout(() => { if (alive) setStatus('error') }, 15000)
    loadKakaoMaps().then(maps => {
      if (!alive || !container.current) return
      mapsApi = maps
      const map = new maps.Map(container.current, { center: new maps.LatLng(center.latitude, center.longitude), level: 4 })
      mapRef.current = map
      listener = event => callback.current({ latitude: event.latLng.getLat(), longitude: event.latLng.getLng() })
      maps.event.addListener(map, 'click', listener)
      resize = new ResizeObserver(() => map.relayout())
      resize.observe(container.current)
      setStatus('ready')
      clearTimeout(timeout)
    }).catch(() => { if (alive) setStatus('error') })
    return () => {
      alive = false
      clearTimeout(timeout)
      resize?.disconnect()
      if (listener && mapRef.current) mapsApi.event.removeListener(mapRef.current, 'click', listener)
      marker.current?.setMap(null)
      marker.current = null
      mapRef.current = null
    }
    // Center changes pan the existing map below; only retry creates a new map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])
  useEffect(() => {
    if (status === 'ready' && mapRef.current) mapRef.current.panTo(new window.kakao.maps.LatLng(center.latitude, center.longitude))
  }, [center.latitude, center.longitude, status])
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    marker.current?.setMap(null)
    marker.current = point ? new window.kakao.maps.Marker({ map: mapRef.current, position: new window.kakao.maps.LatLng(Number(point.latitude), Number(point.longitude)) }) : null
  }, [point, status])
  return <div className="kakao-map">
    <div ref={container} className="kakao-map__canvas" style={{ height: 320 }} aria-label="지도에서 약속 위치 선택" />
    {status === 'loading' && <p className="kakao-map__status">지도를 불러오는 중…</p>}
    {status === 'error' && <div className="kakao-map__status">지도를 불러오지 못했어요. <button type="button" onClick={() => setAttempt(attempt + 1)}>다시 시도</button></div>}
  </div>
}
