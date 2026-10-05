import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, MapPinIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useSchedule } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import RecommendationResults from './RecommendationResults'
import { addRecommendedCourse, getRecommendationOptions, previewCourse } from './recommendationApi'
import { recommendedIndexes, recommendationReturnPath, relaxConditions, toBatchPlaces } from './recommendationModel'
import { formatDistance } from '../../shared/utils/distance'
import { listSchedulePlaces } from '../../shared/api/schedules'
import { reorderSchedulePlaces } from '../../shared/api/places'
import { CourseSaveError, createCourseSaver } from './courseSave'
import './recommendations.css'

function ConditionForm({ options, places, initial, busy, onSubmit }) {
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const [area, setArea] = useState(initial?.area_query ?? '')
  const [anchor, setAnchor] = useState(initial?.anchor?.schedule_place_id ?? '')
  const [position, setPosition] = useState(initial?.anchor?.position ?? 'after')
  const [radius, setRadius] = useState(initial?.radius_m ?? options.default_radius_m)
  const [party, setParty] = useState(initial?.party_size ?? '2')
  const [items, setItems] = useState(initial?.items ?? Array.from({ length: options.default_item_count }, (_, index) => ({
    category: options.categories[index % options.categories.length].code, subcategory: 'any',
  })))
  const areaInput = useRef(null)
  const updateItem = (index, changes) => setItems(items.map((item, i) => i === index ? { ...item, ...changes } : item))
  return <form className="course-form" noValidate onSubmit={event => {
    event.preventDefault()
    if (!anchor && !area.trim()) {
      showSnackbar('추천받을 지역을 입력하거나 기준 장소를 선택해 주세요.')
      areaInput.current?.focus()
      return
    }
    onSubmit({ ...(anchor ? { anchor: { schedule_place_id: Number(anchor), position } } : { area_query: area.trim() }), radius_m: Number(radius), party_size: party, items })
  }}>
    <h2>어떤 하루를 보내고 싶나요?</h2>
    <p className="course-muted">지역이나 담아 둔 장소 주변에서 갈 곳을 찾아요.</p>
    <div className="course-form__grid">
      <label>기준 장소<select value={anchor} onChange={event => setAnchor(event.target.value)} disabled={busy}>
        <option value="">지역으로 찾기</option>
        {places.filter(place => place.latitude != null && place.longitude != null).map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
      </select></label>
      {anchor ? <label>방문 순서<select value={position} onChange={event => setPosition(event.target.value)} disabled={busy}><option value="after">기준 장소 이후</option><option value="before">기준 장소 이전</option></select></label>
        : <label>지역<input ref={areaInput} value={area} maxLength={100} placeholder="예: 성수, 연남동, 강남역" onChange={event => setArea(event.target.value)} disabled={busy} /></label>}
      <label>검색 반경<select value={radius} onChange={event => setRadius(event.target.value)} disabled={busy}>{options.radius_options_m.map(value => <option key={value} value={value}>{formatDistance(value)}</option>)}</select></label>
      <label>함께하는 인원<select value={party} onChange={event => setParty(event.target.value)} disabled={busy}>{options.party_sizes.map(value => <option key={value.code} value={value.code}>{value.label}</option>)}</select></label>
    </div>
    <div className="course-form__heading"><h3>방문하고 싶은 순서</h3><span>{items.length} / {options.max_item_count}</span></div>
    <ol className="course-form__items">{items.map((item, index) => <li key={index}>
      <span className="course-number">{index + 1}</span>
      <select aria-label={`${index + 1}번째 대분류`} value={item.category} disabled={busy} onChange={event => updateItem(index, { category: event.target.value, subcategory: 'any' })}>{options.categories.map(category => <option key={category.code} value={category.code}>{category.label}</option>)}</select>
      <select aria-label={`${index + 1}번째 소분류`} value={item.subcategory} disabled={busy} onChange={event => updateItem(index, { subcategory: event.target.value })}>{options.categories.find(category => category.code === item.category)?.subcategories.map(sub => <option key={sub.code} value={sub.code}>{sub.label}</option>)}</select>
      <button type="button" aria-label={`${index + 1}번째 항목 삭제`} disabled={busy || items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== index))}>×</button>
    </li>)}</ol>
    <button type="button" className="course-form__add" disabled={busy || items.length >= options.max_item_count} onClick={() => setItems([...items, { category: options.categories[0].code, subcategory: 'any' }])}>+ 코스 항목 추가</button>
    <p className="course-muted">거리 반경은 직선 기준이에요. 방문 순서는 선택한 순서 그대로 유지돼요.</p>
    <button className="course-primary" disabled={busy}>{busy ? '어울리는 장소를 찾는 중…' : '코스 추천받기'}</button>
    <Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </form>
}

export default function RecommendationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = recommendationReturnPath(id, searchParams.get('from'))
  const client = useQueryClient()
  const schedule = useSchedule(id)
  const options = useQuery({ queryKey: ['recommendation-options'], queryFn: getRecommendationOptions })
  const preview = useMutation({ mutationFn: conditions => previewCourse(id, conditions) })
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const [result, setResult] = useState(null)
  const [conditions, setConditions] = useState(null)
  const [editing, setEditing] = useState(true)
  const [selectedRank, setSelectedRank] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [checksByRank, setChecksByRank] = useState({})
  const [placementPending, setPlacementPending] = useState(false)
  const saveCourse = useMemo(() => createCourseSaver({
    listPlaces: () => listSchedulePlaces(id),
    addPlaces: places => addRecommendedCourse(id, places),
    reorderPlaces: schedulePlaceIds => reorderSchedulePlaces({ scheduleId: id, schedulePlaceIds }),
    onPendingChange: setPlacementPending,
  }), [id])
  const apply = useMutation({ mutationFn: ({ places, anchor }) => saveCourse(places, anchor) })
  const locked = useRef(false)
  const selected = result?.candidates.find(candidate => candidate.rank === selectedRank)
  const busy = preview.isPending || apply.isPending
  const checkedIndexes = checksByRank[selectedRank] ?? []
  const selectionLocked = busy || placementPending
  const eligible = schedule.data?.status === 'planned' && ['upcoming', 'today'].includes(schedule.data?.experience_phase)

  async function request(next) {
    if (locked.current || placementPending) return
    locked.current = true
    try {
      const data = await preview.mutateAsync(next)
      setConditions(next)
      setResult(data)
      setSelectedRank(data.candidates[0]?.rank ?? null)
      setSelectedPlace(null)
      setChecksByRank(Object.fromEntries(data.candidates.map(candidate => [candidate.rank, recommendedIndexes(candidate)])))
      setEditing(false)
      if (!data.candidates.length) showSnackbar('조건에 맞는 코스가 없어요. 반경이나 소분류를 바꿔 다시 찾아보세요.')
    } catch (caught) { showSnackbar(getApiErrorMessage(caught)) }
    finally { locked.current = false }
  }

  async function save() {
    if (locked.current || !selected || !eligible || !checkedIndexes.length) return
    locked.current = true
    try {
      await apply.mutateAsync({ places: toBatchPlaces(selected, checkedIndexes), anchor: conditions.anchor })
      await client.invalidateQueries({ queryKey: ['schedules'] })
      navigate(returnPath, { replace: true })
    } catch (caught) {
      await client.invalidateQueries({ queryKey: ['schedules'] })
      showSnackbar(caught instanceof CourseSaveError ? caught.message : getApiErrorMessage(caught))
    }
    finally { locked.current = false }
  }

  return <main className="course-page">
    <header className="course-header"><button type="button" className="course-back" aria-label={searchParams.get('from') === 'plan' ? '갈 곳 정하기로 돌아가기' : '일정으로 돌아가기'} disabled={busy} onClick={() => navigate(returnPath, { replace: true })}><ArrowLeftIcon /></button><span>{schedule.data?.title ?? '하루의 코스'}</span></header>
    <div className="course-intro"><span className="course-eyebrow"><SparklesIcon /> 하루를 잇는 작은 제안</span><h1>{result ? '이런 하루는 어때요?' : '함께 갈 곳을 찾아볼까요?'}</h1><p>마음에 드는 코스를 골라, 나만의 하루에 담아 보세요.</p></div>
    {schedule.isPending || options.isPending ? <div className="course-state" role="status">추천 화면을 준비하고 있어요.</div>
      : schedule.isError || options.isError ? <div className="course-state"><h2>추천 화면을 불러오지 못했어요</h2><p>{getApiErrorMessage(schedule.error ?? options.error)}</p><button type="button" onClick={() => { schedule.refetch(); options.refetch() }}>다시 시도</button></div>
        : !eligible ? <div className="course-state"><h2>계획 중인 하루에서 추천받을 수 있어요</h2><button type="button" onClick={() => navigate(returnPath, { replace: true })}>이전 화면으로 돌아가기</button></div>
          : <>
            {editing ? <ConditionForm key={JSON.stringify(conditions)} options={options.data} places={schedule.data.places} initial={conditions} busy={busy} onSubmit={request} /> : result && <div className="course-conditions"><div><strong><MapPinIcon /> {result.center.label} 주변</strong><p>반경 {formatDistance(conditions.radius_m)} · {options.data.party_sizes.find(party => party.code === conditions.party_size)?.label} · {conditions.items.length}곳 추천</p></div><button type="button" disabled={selectionLocked} onClick={() => setEditing(true)}>조건 바꾸기</button></div>}
            {!editing && result && !result.candidates.length && <section className="course-state"><MapPinIcon /><h2>아직 어울리는 코스를 찾지 못했어요</h2><p>{result.empty_item_indexes.map(index => `${index + 1}번째 ${options.data.categories.find(category => category.code === conditions.items[index]?.category)?.label ?? '항목'}`).join(', ')}에 맞는 장소가 없어요.</p><div className="course-relax">{result.relaxation_suggestions.map((suggestion, index) => <button type="button" key={index} disabled={busy} onClick={() => request(relaxConditions(conditions, suggestion))}>{suggestion.code === 'WIDEN_RADIUS' ? `반경 ${formatDistance(suggestion.radius_m)}로 다시 찾기` : `${suggestion.item_index + 1}번째 소분류를 상관없음으로 찾기`}</button>)}</div><button type="button" disabled={selectionLocked} onClick={() => setEditing(true)}>다른 조건으로 찾기</button></section>}
            {!editing && selected && <>
              <RecommendationResults result={result} selected={selected} options={options.data} conditions={conditions} busy={busy} saving={apply.isPending} selectedPlace={selectedPlace} checkedIndexes={checkedIndexes} placementPending={placementPending} onTogglePlace={index => setChecksByRank(current => ({ ...current, [selectedRank]: checkedIndexes.includes(index) ? checkedIndexes.filter(value => value !== index) : [...checkedIndexes, index] }))} onChoose={rank => { setSelectedRank(rank); setSelectedPlace(null) }} onRefresh={() => request(conditions)} onSave={save} onSelectPlace={setSelectedPlace} onNotice={showSnackbar} />
            </>}
          </>}
    <Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </main>
}
