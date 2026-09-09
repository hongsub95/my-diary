import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import plusRaw from '../../assets/icons/plus.svg?raw'
import {
  useCompleteSchedule,
  useSchedule,
  useSchedulePlaceMutations,
} from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import PlacePicker from './PlacePicker'
import DiarySection from '../diaries/DiarySection'
import './schedules.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

const PHASE_LABELS = {
  upcoming: '예정',
  today: '오늘',
  record_pending: '기록을 기다리는 중',
  recorded: '기록함',
  canceled: '취소됨',
}

function formatFullDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  return `${ampm} ${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

/**
 * 장소 목록. 당일에는 방문 체크를 함께 보여준다.
 *
 * @param {object} props
 * @param {Array} props.places 담은 장소들
 * @param {boolean} props.checkable 방문 체크를 쓸 수 있는지. 당일에만 켠다
 * @param {object} props.mutations useSchedulePlaceMutations
 * @param {(message: string) => void} props.onError 실패 문구 전달
 */
function PlaceList({ places, checkable, mutations, onError }) {
  const act = async (run) => {
    onError('')
    try {
      await run()
    } catch (caught) {
      onError(getApiErrorMessage(caught))
    }
  }

  return (
    <div className="sdetail-places">
      {places.map((place, index) => (
        <div key={place.id} className="sdetail-place">
          {/* 화면에는 방문 차례를 1부터 보여준다. sort_order는 0부터 시작하는
              내부 값이라 그대로 찍으면 첫 장소가 0번이 된다. */}
          <div className="sdetail-place__order">{index + 1}</div>
          <div className="sdetail-place__info">
            <div className="sdetail-place__name-row">
              <p className={`sdetail-place__name${place.visited ? ' sdetail-place__name--visited' : ''}`}>
                {place.name}
              </p>
              {place.visited && <span className="sdetail-place__check">✓</span>}
            </div>
            {place.address && <p className="sdetail-place__address">{place.address}</p>}
            {place.memo && <p className="sdetail-place__memo">{place.memo}</p>}
          </div>

          {checkable ? (
            <button
              type="button"
              className="sdetail-place__visit"
              onClick={() =>
                act(() =>
                  mutations.toggleVisited.mutateAsync({
                    schedulePlaceId: place.id,
                    visited: !place.visited,
                  }),
                )
              }
              disabled={mutations.toggleVisited.isPending}
            >
              {place.visited ? '취소' : '다녀왔어요'}
            </button>
          ) : (
            <button
              type="button"
              className="sdetail-place__remove"
              onClick={() => act(() => mutations.remove.mutateAsync(place.id))}
              disabled={mutations.remove.isPending}
              aria-label={`${place.name} 빼기`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * 하루 상세. 같은 화면이지만 시간 상태에 따라 무엇을 앞에 두는지가 달라진다.
 *
 * - 예정: 장소 흐름이 먼저다. 어디를 어떤 순서로 갈지 정하는 화면이다
 * - 당일: 다음 장소와 진행 상태가 먼저다. 지금 뭘 하면 되는지만 보면 된다
 * - 완료: 사진과 일기가 먼저다. 시간표가 아니라 그날의 기억을 보러 오는 화면이다
 *
 * 기준은 docs/UX_IDENTITY_REDIRECTION_SPEC.md 7절과
 * docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.3~3.5절이다.
 */
export default function ScheduleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: schedule, isLoading } = useSchedule(id)
  const mutations = useSchedulePlaceMutations(id)
  const complete = useCompleteSchedule(id)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  if (isLoading) return <div className="sdetail-loading">로딩 중...</div>
  if (!schedule) return <div className="sdetail-loading">일정을 찾을 수 없어요</div>

  const phase = schedule.experience_phase
  const isToday = phase === 'today'
  // 다녀왔거나 완료한 하루. 기록이 앞에 오고 계획 정보는 뒤로 물러난다.
  const isDone = phase === 'recorded' || phase === 'record_pending'
  const visited = schedule.places.filter((place) => place.visited).length
  const nextPlace = schedule.places.find((place) => !place.visited) ?? null

  const placesSection = (
    <section className="sdetail-section">
      <div className="sdetail-section__header">
        <h2 className="sdetail-section__title">{isDone ? '다녀온 장소' : '장소'}</h2>
        {/* 완료한 하루에는 계획을 더 담지 않는다. 그날 있었던 일은 방문 기록으로 남긴다. */}
        {!picking && !isDone && (
          <button type="button" className="sdetail-section__edit" onClick={() => setPicking(true)}>
            <Icon raw={plusRaw} size={14} />
            추가
          </button>
        )}
      </div>

      {picking && <PlacePicker mutation={mutations.add} onClose={() => setPicking(false)} />}

      {schedule.places.length === 0 && !picking ? (
        <p className="sdetail-places-empty">
          {isDone ? '담아둔 장소가 없었어요.' : '아직 담은 장소가 없어요.'}
        </p>
      ) : (
        <PlaceList
          places={schedule.places}
          checkable={isToday}
          mutations={mutations}
          onError={setError}
        />
      )}
    </section>
  )

  const diarySection = (
    <DiarySection scheduleId={id} dateKey={schedule.date_key} places={schedule.places} />
  )

  return (
    <div className="sdetail-page">
      <div className="sdetail-header">
        <div className="sdetail-header__row">
          <button onClick={() => navigate(-1)} className="sdetail-back-btn">
            <Icon raw={arrowLeftRaw} size={20} />
          </button>
          <h1 className="sdetail-header__title">{schedule.title}</h1>
          <span className={`sdetail-header__badge sdetail-header__badge--${phase}`}>
            {PHASE_LABELS[phase] ?? phase}
          </span>
        </div>
        <p className="sdetail-header__time">
          {schedule.space_name} · {formatFullDate(schedule.start_at)} ·{' '}
          {formatTime(schedule.start_at)} – {formatTime(schedule.end_at)}
        </p>
      </div>

      <div className="sdetail-body">
        {error && <p className="sdetail-error" role="alert">{error}</p>}

        {/* 당일에는 다음 장소와 진행률을 맨 위에 둔다. 지금 뭘 하면 되는지가 먼저다. */}
        {isToday && schedule.places.length > 0 && (
          <section className="sdetail-next">
            <p className="sdetail-next__label">
              {nextPlace ? '다음 장소' : '모든 장소를 다녀왔어요'}
            </p>
            {nextPlace && <h2 className="sdetail-next__name">{nextPlace.name}</h2>}
            <p className="sdetail-next__progress">
              {visited} / {schedule.places.length}곳 방문
            </p>
          </section>
        )}

        {/* 완료한 하루는 사진과 일기가 먼저, 계획 정보가 나중이다. */}
        {isDone ? (
          <>
            {diarySection}
            {placesSection}
          </>
        ) : (
          <>
            {placesSection}
            {diarySection}
          </>
        )}

        {schedule.description && (
          <section className="sdetail-section">
            <h2 className="sdetail-section__title">메모</h2>
            <p className="sdetail-memo">{schedule.description}</p>
          </section>
        )}

        {/* 완료 처리는 계획에서 기억으로 넘어가는 전환이다. 아직 안 넘어간 하루에만 둔다. */}
        {!isDone && phase !== 'canceled' && (
          <button
            type="button"
            className="sdetail-complete"
            onClick={async () => {
              setError('')
              try {
                await complete.mutateAsync()
              } catch (caught) {
                setError(getApiErrorMessage(caught))
              }
            }}
            disabled={complete.isPending}
          >
            {complete.isPending ? '처리 중…' : '하루 마치기'}
          </button>
        )}
      </div>
    </div>
  )
}
