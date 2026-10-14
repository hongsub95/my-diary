import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSchedule, updateSchedule } from '../../shared/api/schedules'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { useCreateSchedule } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import LoadingIndicator from '../../shared/components/LoadingIndicator'
import { TIME_OPTIONS } from '../../shared/utils/time'
import './schedules.css'
import { useSpaces } from '../spaces/SpaceContext'

const serviceDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * 화면에서 고른 날짜와 시각을 서버가 받는 UTC ISO 문자열로 바꾼다.
 *
 * @param {string} date `YYYY-MM-DD`
 * @param {string} timeText `HH:MM`
 * @returns {string} UTC ISO 문자열
 *
 * date 입력과 time 입력을 합치면 브라우저가 그 값을 사용자의 시간대로 읽는다.
 * 서버는 UTC로 저장하므로(API_SPEC 2.4절) 여기서 변환해 보낸다.
 */
function toUtcIso(date, timeText) {
  return new Date(`${date}T${timeText}:00+09:00`).toISOString()
}

export default function ScheduleNewPage() {
  const [params] = useSearchParams()
  const id = params.get('scheduleId')
  const query = useQuery({ queryKey: ['schedules', 'step-one', id], queryFn: () => getSchedule(id), enabled: Boolean(id), staleTime: 0 })
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  if (id && query.isPending) return <div className="snew-page"><LoadingIndicator>하루를 불러오고 있어요.</LoadingIndicator></div>
  if (id && (query.isError || !query.data)) return <div className="snew-page"><button type="button" onClick={() => { showSnackbar('하루를 불러오지 못했어요. 다시 시도해 주세요.'); query.refetch() }}>하루 다시 불러오기</button><Snackbar notice={notice} onDismiss={dismissSnackbar} /></div>
  return <ScheduleBasicsForm key={id ?? 'new'} existing={id ? query.data : null} />
}

function ScheduleBasicsForm({ existing }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const update = useMutation({ mutationFn: changes => updateSchedule(existing.id, changes) })
  const { spaces, spacesQuery, currentSpaceId } = useSpaces()
  const targetSpaceId = existing?.space_id ?? currentSpaceId
  const targetSpace = spaces.find(space => space.id === targetSpaceId)
  const submitLock = useRef(false)
  const createSchedule = useCreateSchedule()
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const today = serviceDateFormatter.format(new Date())
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    start_date: existing ? serviceDateFormatter.format(new Date(existing.start_at)) : today,
    end_date: existing ? serviceDateFormatter.format(new Date(existing.end_at)) : today,
    start_time: existing ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(existing.start_at)) : '12:00',
    end_time: existing ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(existing.end_at)) : '15:00',
    memo: existing?.description ?? '',
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitLock.current) return
    if (!targetSpace || spacesQuery.isError) { showSnackbar('현재 공간을 확인하지 못했어요. 다시 시도해 주세요.'); void spacesQuery.refetch(); return }
    const invalid = !form.title.trim() ? ['하루의 이름을 입력해 주세요.', 'schedule-title']
      : !form.start_date ? ['시작일을 선택해 주세요.', 'schedule-start-date']
        : !form.end_date ? ['종료일을 선택해 주세요.', 'schedule-end-date']
          : !TIME_OPTIONS.includes(form.start_time) ? ['시작 시간을 선택해 주세요.', 'schedule-start-time']
            : !TIME_OPTIONS.includes(form.end_time) ? ['종료 시간을 선택해 주세요.', 'schedule-end-time'] : null
    if (invalid) {
      e.currentTarget.elements.namedItem(invalid[1])?.focus()
      showSnackbar(invalid[0])
      return
    }
    if (!Number.isFinite(Date.parse(`${form.start_date}T${form.start_time}:00+09:00`)) || !Number.isFinite(Date.parse(`${form.end_date}T${form.end_time}:00+09:00`))) {
      showSnackbar('시작일과 종료일을 확인해 주세요.')
      return
    }

    const startAt = toUtcIso(form.start_date, form.start_time)
    const endAt = toUtcIso(form.end_date, form.end_time)
    // 서버도 같은 규칙으로 막지만(422), 화면에서 먼저 걸러 왕복을 줄인다.
    if (endAt <= startAt) {
      showSnackbar('종료 날짜와 시간은 시작보다 뒤여야 합니다.')
      return
    }

    dismissSnackbar()
    submitLock.current = true
    try {
      const created = existing ? await update.mutateAsync({ title: form.title.trim(), description: form.memo.trim() || null, start_at: startAt, end_at: endAt }) : await createSchedule.mutateAsync({
        spaceId: targetSpaceId,
        title: form.title.trim(),
        description: form.memo.trim(),
        startAt,
        endAt,
      })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
      // 만든 일정으로 바로 들어가야 장소를 이어서 추가할 수 있다.
      // 저장하고 끝내지 않고 곧바로 갈 곳을 정하러 보낸다. 제품이 말하는 하루는
      // 제목과 시간이 아니라 장소와 순서다(3.2절).
      navigate(`/schedules/${created.id}/plan`, { replace: true })
    } catch (caught) {
      showSnackbar(getApiErrorMessage(caught))
    } finally {
      submitLock.current = false
    }
  }

  return (
    <div className="snew-page">
      <div className="snew-header">
        <button type="button" aria-label="뒤로 가기" disabled={createSchedule.isPending || update.isPending} onClick={() => existing ? navigate(`/schedules/${existing.id}/plan`, { replace: true }) : navigate(-1)} className="sdetail-back-btn">
          <Icon raw={arrowLeftRaw} size={20} />
        </button>
        <h1 className="snew-header__title">새 일정</h1>
      </div>

      <form onSubmit={handleSubmit} className="snew-form" noValidate>
        <div className="snew-form__intro">
          <span className="snew-form__eyebrow">NEW PLAN</span>
          <h2>어떤 하루를 보내고 싶나요?</h2>
          <p>날짜와 시간을 먼저 정하고, 다음 화면에서 갈 곳을 채워보세요.</p>
        </div>

        <section className="snew-form__section">
          <div className="snew-form__section-heading">
            <span className="snew-form__step">1</span>
            <div>
              <h3>기본 정보</h3>
              <p>나중에 한눈에 알아볼 수 있는 이름을 붙여주세요.</p>
            </div>
          </div>

          {/* 저장될 공간과 보는 사람을 늘 보여준다(SPACE_MODEL_SPEC 9.3, 2026-10-13 결정).
              공유 공간을 열어 둔 채 혼자만의 하루를 만들면, 표시가 없을 땐 모르고 함께하는
              사람에게 보이게 된다. 고르는 칸은 두지 않는다 — 다른 곳에 저장하려면 공간을
              바꾼 뒤 만든다. */}
          {targetSpace && (
            <p className="snew-space-target">
              <strong>{targetSpace.name}</strong>에 저장돼요 ·{' '}
              {targetSpace.type === 'shared' ? `${targetSpace.member_count}명이 함께 봐요` : '나만 볼 수 있어요'}
            </p>
          )}

          <div className="snew-form__field">
            <label className="snew-form__label" htmlFor="schedule-title">하루의 이름 <span className="snew-form__required" aria-hidden="true">*</span></label>
            <input
              id="schedule-title"
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="snew-form__input"
              placeholder="하루의 이름을 작성해주세요"
              required
            />
          </div>
        </section>

        <section className="snew-form__section snew-form__section--timing">
          <div className="snew-form__section-heading">
            <span className="snew-form__step">2</span>
            <div>
              <h3>일정 구간</h3>
            </div>
          </div>

          <div className="snew-timing-grid">
            <div className="snew-timing-row">
              <div className="snew-form__field">
                <label className="snew-form__label" htmlFor="schedule-start-date">시작일 <span className="snew-form__required" aria-hidden="true">*</span></label>
                <input
                  id="schedule-start-date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => {
                    const startDate = e.target.value
                    setForm((current) => ({
                      ...current,
                      start_date: startDate,
                      end_date: current.end_date < startDate ? startDate : current.end_date,
                    }))
                  }}
                  className="snew-form__input"
                  required
                />
              </div>
              <div className="snew-form__field snew-timing-row__time">
                <label className="snew-form__label" htmlFor="schedule-start-time">시작 시간 <span className="snew-form__required" aria-hidden="true">*</span></label>
                <select
                  id="schedule-start-time"
                  required
                  value={form.start_time}
                  onChange={(e) => set('start_time', e.target.value)}
                  className="snew-form__input snew-form__select"
                >
                  {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
            </div>

            <div className="snew-timing-row snew-timing-row--end">
              <div className="snew-form__field">
                <label className="snew-form__label" htmlFor="schedule-end-date">종료일 <span className="snew-form__required" aria-hidden="true">*</span></label>
                <input
                  id="schedule-end-date"
                  type="date"
                  min={form.start_date}
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                  className="snew-form__input"
                  required
                />
              </div>
              <div className="snew-form__field snew-timing-row__time">
                <label className="snew-form__label" htmlFor="schedule-end-time">종료 시간 <span className="snew-form__required" aria-hidden="true">*</span></label>
                <select
                  id="schedule-end-time"
                  required
                  value={form.end_time}
                  onChange={(e) => set('end_time', e.target.value)}
                  className="snew-form__input snew-form__select"
                >
                  {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
            </div>
          </div>

        </section>

        <section className="snew-form__section snew-form__section--compact">
          <div className="snew-form__field">
            <label className="snew-form__label" htmlFor="schedule-memo">하루의 밑그림</label>
            <textarea
              id="schedule-memo"
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              className="snew-form__input snew-form__textarea"
              placeholder="어떤 하루를 보내고 싶은지 적어주세요"
              rows={3}
            />
          </div>
        </section>

        <button type="submit" className="snew-form__submit" disabled={createSchedule.isPending || update.isPending}>
          {createSchedule.isPending || update.isPending ? <LoadingIndicator variant="ring" inline>저장 중…</LoadingIndicator> : '갈 곳 정하기 →'}
        </button>
      </form>
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </div>
  )
}
