import { ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline'
import KakaoMap from '../../shared/map/KakaoMap'
import { formatDistance } from '../../shared/utils/distance'
import { formatCourseLeg, toBatchPlaces, WARNING_LABELS } from './recommendationModel'

export default function RecommendationResults({ result, selected, options, conditions, busy, saving,
  selectedPlace, checkedIndexes, placementPending, onTogglePlace, onChoose, onRefresh, onSave, onSelectPlace, onNotice }) {
  const mapPlaces = selected.places.map((place, index) => ({ ...place, id: String(index) }))
  const count = toBatchPlaces(selected, checkedIndexes).length
  const selectionLocked = busy || placementPending
  return <>
    <div className="course-section-heading">
      <h2>추천 코스 <span>{result.candidates.length}</span></h2>
      <button type="button" disabled={selectionLocked} onClick={onRefresh}><ArrowPathIcon /> 다시 추천</button>
    </div>
    <div className="course-candidates" role="group" aria-label="추천 코스 선택">
      {result.candidates.map(candidate => <button type="button" key={candidate.rank}
        aria-pressed={selected.rank === candidate.rank} disabled={selectionLocked}
        className={`course-candidate${selected.rank === candidate.rank ? ' course-candidate--selected' : ''}`}
        onClick={() => onChoose(candidate.rank)}>
        <div className="course-candidate__top"><span>코스 {candidate.rank.toString().padStart(2, '0')}</span>{selected.rank === candidate.rank && <CheckIcon />}</div>
        <strong>직선거리 {formatDistance(candidate.total_distance_m)}</strong>
        <p>{candidate.places.map(place => place.name).join(' → ')}</p>
        <span className="course-candidate__tag">{candidate.rank === 1 ? '가장 가까운 동선' : '다른 장소로 즐기는 하루'}</span>
      </button>)}
    </div>
    <div className="course-detail-grid">
      <section className="course-map-card">
        <div><span className="course-eyebrow">한눈에 보는 코스</span><h2>{result.center.label}에서 이어지는 하루</h2></div>
        <KakaoMap key={selected.rank} places={mapPlaces} selectedId={selectedPlace} onSelect={onSelectPlace} />
        <p className="course-muted">지도는 추천 코스 전체를 보여줘요. 담을 장소는 아래에서 선택해 주세요.</p>
      </section>
      <section className="course-route">
        <div className="course-section-heading"><h2>담을 장소를 골라 주세요</h2><span>{count}곳 선택</span></div>
        <ol>{selected.places.map((place, index) => <li key={`${place.kind}-${place.provider_place_id ?? index}`}>
          {index > 0 && <p className="course-leg">↓ {formatCourseLeg(selected.legs.find(leg => leg.to_index === index)?.distance_m)}</p>}
          <article className={`course-place${selectedPlace === String(index) ? ' course-place--active' : ''}`}>
            <button type="button" className="course-number" aria-label={`${index + 1}번 ${place.name} 지도에서 보기`} onClick={() => onSelectPlace(String(index))}>{index + 1}</button>
            <div className="course-place__body">
              <span className="course-place__category">{place.kind === 'anchor' ? '기준 장소 · 이미 담은 곳' : options.categories.find(category => category.code === place.category)?.label}</span>
              <h3>{place.name}</h3>
              {place.kind === 'recommended' && <label className="course-place__selection">
                <input type="checkbox" checked={checkedIndexes.includes(index)} disabled={selectionLocked}
                  onChange={() => onTogglePlace(index)} aria-label={`${place.name} 일정에 담기`} />
                일정에 담기
              </label>}
              {place.address && <p className="course-muted">{place.address}</p>}
              {place.reason && <p className="course-place__reason">{place.reason}</p>}
              {place.phone && <a href={`tel:${place.phone}`}>{place.phone}</a>}
              {place.warnings?.length > 0 && <div className="course-place__checks">{place.warnings.map(warning => <button type="button" key={warning}
                onClick={() => onNotice(warning === 'PARTY_SIZE_UNVERIFIED' ? '방문 전 장소에 연락해 함께하는 인원의 이용 가능 여부를 확인해 주세요.' : '방문 전 장소의 영업시간을 확인해 주세요.')}>
                {WARNING_LABELS[warning] ?? '이용 조건 확인 필요'}
              </button>)}</div>}
            </div>
          </article>
        </li>)}</ol>
      </section>
    </div>
    <aside className="course-note">
      <strong>{placementPending ? '장소는 담았고 순서를 맞추는 단계가 남았어요' : '방문 전 확인해 주세요'}</strong>
      <p>{placementPending ? '아래 버튼을 누르면 추가 저장 없이 기준 장소 앞 순서만 다시 맞춰요.' : '표시된 거리는 추천 코스 전체의 직선거리이며, 실제 길과 이동시간은 달라요. 영업시간과 예약 여부는 방문 전에 확인해 주세요.'}</p>
      {conditions.anchor?.position === 'before' && <p>선택한 장소를 코스 순서대로 기준 장소 바로 앞에 배치해요.</p>}
    </aside>
    <footer className="course-footer">
      <div><strong>코스 {selected.rank} · {count}곳 선택</strong><p>선택한 장소만 내 하루에 더해요.</p></div>
      <button type="button" className="course-primary" onClick={onSave} disabled={busy || !count}>
        {saving ? '저장하는 중…' : placementPending ? '기준 장소 앞 순서 다시 맞추기' : '선택한 장소 일정에 담기'}
      </button>
    </footer>
  </>
}
