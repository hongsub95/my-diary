import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import { useSchedule, useSchedulePlaceMutations } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import PlacePicker from './PlacePicker'
import KakaoMap from '../../shared/map/KakaoMap'
import { moveItem } from '../../shared/utils/reorder'
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
  const { add, remove, reorder } = useSchedulePlaceMutations(id)
  const [error, setError] = useState('')

  const places = schedule?.places ?? []
  const done = () => navigate(`/schedules/${id}`, { replace: true })

  /**
   * 장소를 한 칸 옮긴다.
   *
   * @param {number} index 옮길 자리
   * @param {number} step -1이면 위로, 1이면 아래로
   *
   * 서버에는 바뀐 **전체 순서**를 보낸다. 한 칸씩 옮기는 화면이라도 API는 전체를
   * 받기 때문이다(API_SPEC 6.4절). 끝에서 더 못 가면 요청하지 않는다.
   */
  const handleMove = async (index, step) => {
    const next = moveItem(places, index, step)
    if (next === places) return

    setError('')
    try {
      await reorder.mutateAsync(next.map((place) => place.id))
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

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
        {/* 검색과 직접 입력을 함께 둔다. 검색에 안 나오는 장소는 직접 넣어야 한다.
            이미 담은 장소가 있으면 마지막 장소를 지도 중심으로 넘겨, 다음 장소를
            그 근처에서 찾게 한다. */}
        <PlacePicker mutation={add} initialCenter={(() => {
          const last = [...places].reverse().find(place => place.latitude != null && place.longitude != null)
          return last ? { latitude: Number(last.latitude), longitude: Number(last.longitude) } : undefined
        })()} />

        {error && <p className="splan-page__error" role="alert">{error}</p>}

        <section className="splan-picked">
          <h2 className="splan-picked__title">담은 장소 {places.length > 0 && `· ${places.length}곳`}</h2>

          {places.length === 0 ? (
            <p className="splan-picked__empty">아직 담은 장소가 없어요.</p>
          ) : (
            <>
              {/* 목록 위에 지도를 둔다. 마커 번호가 아래 순번과 같아서 "몇 번째로
                  어디를 가는지"를 지도에서 바로 읽을 수 있다. 일정 상세와 같은 구성이다. */}
              <KakaoMap places={places} />

              <ol className="splan-picked__list">
                {places.map((place, index) => (
                  <li key={place.id} className="splan-picked__item">
                    {/* 화면에는 방문 차례를 1부터 보여준다. sort_order는 0부터 시작하는 내부 값이다. */}
                    <span className="splan-picked__order">{index + 1}</span>
                    <span className="splan-picked__info">
                      <strong>{place.name}</strong>
                      {place.address && <em>{place.address}</em>}
                    </span>
                    {/* 위·아래 한 칸씩 옮긴다. 드래그 대신 버튼을 쓰는 이유는
                        shared/utils/reorder.js에 적어 두었다. */}
                    <span className="splan-picked__moves">
                      <button
                        type="button"
                        className="splan-picked__move"
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0 || reorder.isPending}
                        aria-label={`${place.name} 순서 올리기`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="splan-picked__move"
                        onClick={() => handleMove(index, 1)}
                        disabled={index === places.length - 1 || reorder.isPending}
                        aria-label={`${place.name} 순서 내리기`}
                      >
                        ↓
                      </button>
                    </span>
                    <button
                      type="button"
                      className="splan-picked__remove"
                      onClick={() => handleRemove(place.id)}
                      disabled={remove.isPending || reorder.isPending}
                      aria-label={`${place.name} 빼기`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        {/* 지도와 별개로 이름만 이어 붙인 한 줄도 남긴다. 좌표가 없어 지도에 못 찍는
            장소(직접 입력)도 여기에는 순서대로 보이기 때문이다. */}
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
