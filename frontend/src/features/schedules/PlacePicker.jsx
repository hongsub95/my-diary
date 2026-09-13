import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchPlaces, searchMapPlaces, reverseAddress } from '../../shared/api/places'
import { getApiErrorMessage } from '../../shared/api/apiError'
import LocationMap from '../../shared/map/LocationMap'
import './place-selector.css'

const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 }

export default function PlacePicker({ mutation, onClose, initialCenter = DEFAULT_CENTER }) {
  const [mode, setMode] = useState(null)
  const [queries, setQueries] = useState({ name: '', map: '' })
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState(null)
  const [point, setPoint] = useState(null)
  const [center, setCenter] = useState(initialCenter)
  const [manual, setManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [lookup, setLookup] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const dialog = useRef(null)
  const version = useRef(0)
  const lock = useRef(false)
  const busy = saving || mutation.isPending
  const query = mode ? queries[mode] : ''
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])
  useEffect(() => {
    const element = dialog.current
    if (mode && !element.open) element.showModal()
    else if (!mode && element.open) element.close()
  }, [mode])
  useEffect(() => () => { version.current += 1 }, [])
  const search = useQuery({
    queryKey: ['place-selector', mode, debounced],
    queryFn: () => mode === 'map' ? searchMapPlaces(debounced) : searchPlaces(debounced),
    enabled: Boolean(mode && debounced && debounced === query.trim() && !(mode === 'name' && manual)),
    retry: false,
  })
  const items = query.trim() === debounced ? search.data?.items ?? [] : []
  function close() {
    if (lock.current || mutation.isPending) return
    version.current += 1
    setLookup(false)
    setMode(null)
    setError('')
  }
  async function pickPoint(coordinate) {
    if (busy) return
    const current = ++version.current
    setPoint({ ...coordinate, name: '', address: '', address_detail: '', provider: 'manual', provider_place_id: null })
    setLookup(true)
    setLookupError('')
    try {
      const address = await reverseAddress(coordinate)
      if (current !== version.current) return
      setPoint(previous => ({ ...previous, address: address ?? '' }))
      if (!address) setLookupError('주소를 찾지 못했어요. 기본주소를 직접 입력해 주세요.')
    } catch {
      if (current === version.current) setLookupError('주소를 불러오지 못했어요. 재시도하거나 직접 입력해 주세요.')
    } finally { if (current === version.current) setLookup(false) }
  }
  async function submit(event) {
    event.preventDefault()
    if (busy || lock.current) return
    const candidate = mode === 'map' ? point : manual ? { name: manualName } : selected
    if (!candidate) return
    const name = candidate.name.trim() || (mode === 'map' ? candidate.address?.trim().slice(0, 200) : '')
    if (!name || (mode === 'map' && (!candidate.address?.trim() || candidate.latitude == null || candidate.longitude == null || lookup))) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      await mutation.mutateAsync({ place: { ...candidate, name, address: candidate.address?.trim() || null, address_detail: candidate.address_detail?.trim() || null } })
      setQueries(previous => ({ ...previous, [mode]: '' }))
      if (mode === 'name') { setSelected(null); setManual(false); setManualName('') }
      else { setPoint(null); setLookupError('') }
      setMode(null)
      setNotice('장소를 담았어요')
      onClose?.()
    } catch (caught) { setError(getApiErrorMessage(caught)) }
    finally { lock.current = false; setSaving(false) }
  }
  const canSubmit = mode === 'map'
    ? Boolean(point?.address?.trim() && point.latitude != null && point.longitude != null && !lookup)
    : manual ? Boolean(manualName.trim()) : Boolean(selected)

  return <div className="place-selector">
    <div className="place-selector__choices">
      {['name', 'map'].map(value => <button key={value} type="button" disabled={busy} onClick={() => { setMode(value); setError(''); if (value === 'map' && !point) setCenter(initialCenter) }}>
        <span className="place-selector__icon" aria-hidden="true">{value === 'name' ? '⌕' : '⌖'}</span>
        <strong>{value === 'name' ? '장소 이름' : '지도로 검색'}</strong>
        <small>{value === 'name' ? '이름으로 찾아 선택해요' : '지도에서 위치와 주소를 정해요'}</small>
      </button>)}
    </div>
    <p role="status" className="place-selector__hint">{notice}</p>
    <dialog ref={dialog} className={'place-selector__dialog' + (mode === 'map' ? ' place-selector__dialog--map' : '')} aria-label={mode === 'map' ? '지도로 장소 찾기' : '장소 이름으로 찾기'} onCancel={event => { event.preventDefault(); close() }}>
      <form onSubmit={submit}>
        <header><h2>{mode === 'map' ? '지도로 장소 찾기' : '장소 이름으로 찾기'}</h2><button type="button" disabled={busy} onClick={close}>닫기</button></header>
        <div className="place-selector__body">
          <label> {mode === 'map' ? '주소 또는 장소 검색' : '장소 이름 검색'}
            <input type="search" value={query} maxLength={100} disabled={busy} placeholder={mode === 'map' ? '주소 또는 장소 이름으로 검색' : '장소 이름으로 검색'} onChange={event => {
              setQueries(previous => ({ ...previous, [mode]: event.target.value }))
              if (mode === 'name') { setSelected(null); setManual(false) }
            }} />
          </label>
          {mode === 'map' && <><LocationMap center={center} point={point} onPick={pickPoint} /><p className="place-selector__hint">지도에서 약속할 지점을 눌러 주세요.</p></>}
          {search.isFetching && <p role="status">검색 중…</p>}
          {search.isError && debounced === query.trim() && <button type="button" onClick={() => search.refetch()}>검색을 불러오지 못했어요. 다시 시도</button>}
          {search.data?.provider === 'mock' && debounced === query.trim() ? <p>검색을 준비하고 있어요. 이름을 직접 입력해 주세요.</p> : <ul className="place-selector__results">
            {items.map((item, index) => <li key={item.provider + '-' + (item.provider_place_id ?? item.address) + '-' + index}>
              <button type="button" disabled={busy || (mode === 'map' && (item.latitude == null || item.longitude == null))} aria-pressed={mode === 'name' ? selected === item : point?.provider_place_id != null && point.provider_place_id === item.provider_place_id} onClick={() => {
                if (mode === 'name') { setSelected(item); setManual(false) }
                else {
                  version.current += 1; setLookup(false); setLookupError('')
                  setPoint({ ...item, address_detail: '' })
                  setCenter({ latitude: Number(item.latitude), longitude: Number(item.longitude) })
                }
              }}><strong>{item.name}</strong>{item.address && <small>{item.address}</small>}</button>
            </li>)}
          </ul>}
          {query.trim() && search.isSuccess && !search.isFetching && debounced === query.trim() && !items.length && <p>검색 결과가 없어요. 지역명과 장소 이름을 함께 입력해 보세요.</p>}
          {mode === 'name' ? <>
            <button className="place-selector__link" type="button" disabled={busy} onClick={() => { setManual(!manual); setSelected(null) }}>검색에 없나요? 이름만 직접 입력</button>
            {manual && <label>장소 이름<input value={manualName} maxLength={200} disabled={busy} onChange={event => setManualName(event.target.value)} /></label>}
          </> : <>
            {lookup && <p role="status">선택한 위치의 주소를 확인하고 있어요…</p>}
            {lookupError && <div role="status">{lookupError}<button type="button" disabled={lookup || busy} onClick={() => pickPoint({ latitude: Number(point.latitude), longitude: Number(point.longitude) })}>주소 다시 찾기</button></div>}
            {point && <div className="place-selector__fields">
              <label>장소 이름<input value={point.name} maxLength={200} disabled={busy} placeholder="비워두면 기본주소를 이름으로 사용해요" onChange={event => setPoint(previous => ({ ...previous, name: event.target.value, provider: 'manual', provider_place_id: null }))} /></label>
              <label>기본주소<input value={point.address ?? ''} maxLength={500} disabled={busy || lookup} onChange={event => setPoint(previous => ({ ...previous, address: event.target.value, provider: 'manual', provider_place_id: null }))} /></label>
              <p className="place-selector__hint">주소를 직접 고쳤다면 지도 위치도 확인해 주세요.</p>
              <label>상세주소 (선택)<input value={point.address_detail ?? ''} maxLength={200} disabled={busy} placeholder="2층, 201호, 정문 앞" onChange={event => setPoint(previous => ({ ...previous, address_detail: event.target.value }))} /></label>
            </div>}
            <button className="place-selector__link" type="button" disabled={busy} onClick={() => setMode('name')}>장소 이름으로 찾기</button>
          </>}
          {error && <p role="alert" className="place-selector__error">{error}</p>}
        </div>
        <footer><button type="submit" disabled={busy || !canSubmit}>{saving ? '담는 중…' : mode === 'map' ? '이 위치 담기' : '이 장소 담기'}</button></footer>
      </form>
    </dialog>
  </div>
}

