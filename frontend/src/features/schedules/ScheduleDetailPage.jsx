import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
import KakaoMap from '../../shared/map/KakaoMap'
import { moveItem } from '../../shared/utils/reorder'
import OptimizeSuggestion from './OptimizeSuggestion'
import PlaceNoteEditor from './PlaceNoteEditor'
import DiarySection from '../diaries/DiarySection'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import { scheduleWhen, useScheduleAccess } from './scheduleManagement'
import './schedules.css'
import './schedule-management.css'

const PHASE_LABELS = {
  upcoming: '예정',
  today: '오늘',
  record_pending: '기록을 기다리는 중',
  recorded: '기록함',
  canceled: '취소됨',
}

/**
 * 장소 목록. 당일에는 방문 체크를 함께 보여준다.
 *
 * @param {object} props
 * @param {Array} props.places 담은 장소들
 * @param {boolean} props.checkable 방문 체크를 쓸 수 있는지. 당일에만 켠다
 * @param {boolean} props.reorderable 순서를 바꿀 수 있는지. 아직 오지 않은 하루에만 켠다
 * @param {boolean} props.editable 예정시각·메모를 고칠 수 있는지. 끝난 하루에서는 보여주기만 한다
 * @param {object} props.mutations useSchedulePlaceMutations
 * @param {(message: string) => void} props.onError 실패 문구 전달
 */
function PlaceList({ places, checkable, reorderable, editable, mutations, onError, active }) {
  const act = async (run) => {
    onError('')
    try {
      await run()
    } catch (caught) {
      onError(getApiErrorMessage(caught))
    }
  }

  /**
   * 장소를 한 칸 옮긴다. 서버에는 바뀐 전체 순서를 보낸다(API_SPEC 6.4절).
   *
   * @param {number} index 옮길 자리
   * @param {number} step -1이면 위로, 1이면 아래로
   */
  const move = (index, step) => {
    const next = moveItem(places, index, step)
    if (next === places) return
    act(() => mutations.reorder.mutateAsync(next.map((place) => place.id)))
  }

  return (
    <div className="sdetail-places">
      {/* 목록 위에 지도를 둔다. 마커 번호가 아래 목록의 순번과 같아서 "몇 번째로
          어디를 가는지"를 지도에서 바로 읽을 수 있다. */}
      {active && <KakaoMap places={places} />}

      {/* 순서를 바꿀 수 있는 하루에만 둔다. 목록 바로 위에 두어 "아래 순서를 다듬는
          버튼"이라는 것이 읽히게 한다. */}
      {reorderable && (
        <OptimizeSuggestion
          places={places}
          optimize={mutations.optimize}
          reorder={mutations.reorder}
        />
      )}

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
            <PlaceNoteEditor
              placeName={place.name}
              plannedTime={place.planned_time}
              memo={place.memo}
              editable={editable}
              busy={mutations.updateNote.isPending}
              onSave={(changes) =>
                mutations.updateNote.mutateAsync({ schedulePlaceId: place.id, changes })
              }
            />
          </div>

          {/* 순서 바꾸기는 아직 오지 않은 하루에만 둔다. 당일이나 끝난 하루의 순서를
              바꾸는 것은 기록을 고치는 일이라 뜻이 다르다. */}
          {reorderable && (
            <span className="sdetail-place__moves">
              <button
                type="button"
                className="sdetail-place__move"
                onClick={() => move(index, -1)}
                disabled={index === 0 || mutations.reorder.isPending}
                aria-label={`${place.name} 순서 올리기`}
              >
                ↑
              </button>
              <button
                type="button"
                className="sdetail-place__move"
                onClick={() => move(index, 1)}
                disabled={index === places.length - 1 || mutations.reorder.isPending}
                aria-label={`${place.name} 순서 내리기`}
              >
                ↓
              </button>
            </span>
          )}

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
          ) : reorderable ? (
            <button
              type="button"
              className="sdetail-place__remove"
              onClick={() => act(() => mutations.remove.mutateAsync(place.id))}
              disabled={mutations.remove.isPending}
              aria-label={`${place.name} 빼기`}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/**
 * 하루 상세. 공통 요약 아래에서 장소·계획과 사진·기록을 전환한다.
 *
 * - 예정: 장소 흐름이 먼저다. 어디를 어떤 순서로 갈지 정하는 화면이다
 * - 당일: 다음 장소와 진행 상태가 먼저다. 지금 뭘 하면 되는지만 보면 된다
 * - 기록 있는 지난 하루: 사진·기록 탭을 먼저 연다. 탭 선택과 작성 중 입력은 유지한다
 *
 * 기준은 docs/UX_IDENTITY_REDIRECTION_SPEC.md 7절과
 * docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.3~3.5절이다.
 */
export default function ScheduleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: schedule, isLoading, isError } = useSchedule(id)
  const access = useScheduleAccess(schedule)
  const feedback = useSnackbar()
  const [successNotice, setSuccessNotice] = useState(location.state?.notice ? { message: location.state.notice } : null)
  const mutations = useSchedulePlaceMutations(id)
  const complete = useCompleteSchedule(id)
  const [picking, setPicking] = useState(false)
  const managementRef = useRef(null)
  useEffect(() => {
    const closeOutside = event => {
      const menu = managementRef.current
      if (menu && !menu.contains(event.target)) menu.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  const [selection, setSelection] = useState(null)
  // state.tab === 'record'는 캘린더의 "이 하루 남기기"처럼 기록을 쓰려고 들어올 때 사진·기록 탭으로 바로 연다.
  const defaultTab = location.state?.tab === 'record' || (schedule && ['recorded', 'record_pending'].includes(schedule.experience_phase)
    && schedule.record_summary.has_content) ? 'record' : 'plan'
  const activeTab = selection?.id === id ? selection.tab : defaultTab
  // 같은 하루를 재조회할 때에는 기본 탭으로 되돌리지 않는다.
  if (schedule && selection?.id !== id) setSelection({ id, tab: defaultTab })
  function selectTab(tab, focus = false) {
    setSelection({ id, tab })
    if (focus) document.getElementById(`day-${id}-${tab}-tab`)?.focus()
  }
  function handleTabKey(event) {
    const next = { ArrowRight: activeTab === 'plan' ? 'record' : 'plan', ArrowLeft: activeTab === 'plan' ? 'record' : 'plan', Home: 'plan', End: 'record' }[event.key]
    if (!next) return
    event.preventDefault()
    selectTab(next, true)
  }
  const showError = message => { if (message) feedback.showSnackbar(message) }

  if (isLoading) return <div className="sdetail-loading">로딩 중...</div>
  if (isError || access.space.isError || !schedule) return <div className="sdetail-loading">일정을 찾을 수 없거나 접근할 수 없어요. <button type="button" className="space-button" onClick={() => navigate('/schedules', { replace: true })}>일정 목록으로</button></div>

  const phase = schedule.experience_phase
  const isToday = phase === 'today'
  // 다녀왔거나 완료한 하루에서는 기존 장소 계획 편집을 제한한다.
  const isDone = phase === 'recorded' || phase === 'record_pending'
  const visited = schedule.places.filter((place) => place.visited).length
  const nextPlace = schedule.places.find((place) => !place.visited) ?? null

  const placesSection = (
    <section className="sdetail-section">
      <div className="sdetail-section__header">
        <h2 className="sdetail-section__title">{isDone ? '다녀온 장소' : '장소'}</h2>
        {schedule.status === 'planned' && ['upcoming', 'today'].includes(phase) && (
          <button type="button" className="sdetail-section__edit" onClick={() => navigate(`/schedules/${id}/recommendations`)}>코스 추천</button>
        )}
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
          reorderable={!isToday && !isDone}
          editable={!isDone}
          mutations={mutations}
          onError={showError}
          active={activeTab === 'plan'}
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
          {access.canEdit && <details ref={managementRef} className="sdetail-dropdown" onKeyDown={event => {
            if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus() }
          }}>
            <summary aria-label="일정 관리">⋯</summary>
            <div className="sdetail-dropdown__options" role="group" aria-label="일정 관리 메뉴">
              <button type="button" onClick={() => { managementRef.current.open = false; navigate(`/schedules/${id}/edit`) }}>수정</button>
              {access.canDelete && <button type="button" className="sdetail-dropdown__delete" onClick={() => { managementRef.current.open = false; navigate(`/schedules/${id}/delete`) }}>삭제</button>}
            </div>
          </details>}
        </div>
        <p className="sdetail-header__time">
          {schedule.space_name} · {scheduleWhen(schedule)}
        </p>
      </div>

      <div className="sdetail-body">
        <div className="sdetail-tabs" role="tablist" aria-label="하루 내용" onKeyDown={handleTabKey}>
          {[{ key: 'plan', label: '장소·계획' }, { key: 'record', label: '사진·기록' }].map(tab => (
            <button key={tab.key} type="button" role="tab" id={`day-${id}-${tab.key}-tab`} aria-controls={`day-${id}-${tab.key}-panel`} aria-selected={activeTab === tab.key} tabIndex={activeTab === tab.key ? 0 : -1} onClick={() => selectTab(tab.key)}>{tab.label}</button>
          ))}
        </div>

        {/* 탭을 숨길 때 폼을 제거하지 않아 작성 중인 입력값이 유지된다. */}
        <div className="sdetail-tab-panel" role="tabpanel" id={`day-${id}-plan-panel`} aria-labelledby={`day-${id}-plan-tab`} hidden={activeTab !== 'plan'}>
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

        {placesSection}

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
              feedback.dismissSnackbar()
              try {
                await complete.mutateAsync()
              } catch (caught) {
                feedback.showSnackbar(getApiErrorMessage(caught))
              }
            }}
            disabled={complete.isPending}
          >
            {complete.isPending ? '처리 중…' : '하루 마치기'}
          </button>
        )}
        </div>
        <div key={`record-${id}`} className="sdetail-tab-panel" role="tabpanel" id={`day-${id}-record-panel`} aria-labelledby={`day-${id}-record-tab`} hidden={activeTab !== 'record'}>
          {diarySection}
        </div>
      </div>
      <Snackbar notice={feedback.notice ?? successNotice} onDismiss={() => { feedback.dismissSnackbar(); setSuccessNotice(null) }} />
    </div>
  )
}
