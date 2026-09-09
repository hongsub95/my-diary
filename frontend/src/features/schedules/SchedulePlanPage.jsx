import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import { useSchedule, useSchedulePlaceMutations } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import PlacePicker from './PlacePicker'
import './schedules.css'

/**
 * 하루 만들기 2단계 — 갈 곳 정하기.
 *
 * 1단계에서 저장한 하루에 장소를 담는다. 저장 후 곧바로 상세로 보내지 않고 이 단계를
 * 두는 이유: 제품이 말하는 하루는 "제목과 시간"이 아니라 "장소와 순서"이기 때문이다.
 * 장소 없이 끝내는 것도 허용하되 기본 경로로 강조하지 않는다
 * (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.2절).
 *
 * 하단 탭 밖에 있는 화면이다. 작성 중에는 탭을 숨긴다(같은 절).
 */
export default function SchedulePlanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: schedule, isPending } = useSchedule(id)
  const { add, remove } = useSchedulePlaceMutations(id)
  const [error, setError] = useState('')

  const places = schedule?.places ?? []
  const done = () => navigate(`/schedules/${id}`, { replace: true })

  const handleRemove = async (schedulePlaceId) => {
    setError('')
    try {
      await remove.mutateAsync(schedulePlaceId)
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  if (isPending) return <div className="splan-page__status">하루를 불러오고 있어요.</div>
  if (!schedule) return <div className="splan-page__status">일정을 찾을 수 없어요.</div>

  return (
    <div className="splan-page">
      <header className="splan-page__header">
        <p className="splan-page__step">2 / 2 · 갈 곳 정하기</p>
        <h1 className="splan-page__title">{schedule.title}</h1>
        <p className="splan-page__hint">
          첫 장소를 추가해 하루를 완성해 보세요.
        </p>
      </header>

      <div className="splan-page__body">
        {/* 검색과 직접 입력을 함께 둔다. 지도 공급자가 아직 mock이라 검색만으로는
            실제로 쓸 수 없고, 붙은 뒤에도 검색에 안 나오는 장소가 있다. */}
        <PlacePicker mutation={add} />

        {error && <p className="splan-page__error" role="alert">{error}</p>}

        <section className="splan-picked">
          <h2 className="splan-picked__title">담은 장소 {places.length > 0 && `· ${places.length}곳`}</h2>

          {places.length === 0 ? (
            <p className="splan-picked__empty">아직 담은 장소가 없어요.</p>
          ) : (
            <ol className="splan-picked__list">
              {places.map((place, index) => (
                <li key={place.id} className="splan-picked__item">
                  {/* 화면에는 방문 차례를 1부터 보여준다. sort_order는 0부터 시작하는 내부 값이다. */}
                  <span className="splan-picked__order">{index + 1}</span>
                  <span className="splan-picked__info">
                    <strong>{place.name}</strong>
                    {place.address && <em>{place.address}</em>}
                  </span>
                  <button
                    type="button"
                    className="splan-picked__remove"
                    onClick={() => handleRemove(place.id)}
                    disabled={remove.isPending}
                    aria-label={`${place.name} 빼기`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 지도는 공급자 연동 전까지 자리를 비워둔다. 가짜 지도를 그리면 실제 위치로
            오해할 수 있어, 담은 장소를 순서대로 보여주는 것으로 대신한다. */}
        {places.length > 0 && (
          <p className="splan-page__flow">
            <Icon raw={mapPinRaw} size={13} />
            {places.map((place) => place.name).join(' → ')}
          </p>
        )}
      </div>

      <footer className="splan-page__footer">
        <button type="button" className="splan-page__skip" onClick={done}>
          장소 없이 끝내기
        </button>
        <button type="button" className="splan-page__submit" onClick={done}>
          하루 완성하기
        </button>
      </footer>
    </div>
  )
}
