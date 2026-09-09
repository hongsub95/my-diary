import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { useCreateSchedule } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './schedules.css'

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0')
  const minutes = index % 2 === 0 ? '00' : '30'
  return `${hours}:${minutes}`
})

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
  const navigate = useNavigate()
  const createSchedule = useCreateSchedule()
  const [error, setError] = useState('')
  const today = serviceDateFormatter.format(new Date())
  const [form, setForm] = useState({
    title: '',
    start_date: today,
    end_date: today,
    start_time: '12:00',
    end_time: '15:00',
    memo: '',
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    const startAt = toUtcIso(form.start_date, form.start_time)
    const endAt = toUtcIso(form.end_date, form.end_time)
    // 서버도 같은 규칙으로 막지만(422), 화면에서 먼저 걸러 왕복을 줄인다.
    if (endAt <= startAt) {
      setError('종료 날짜와 시간은 시작보다 뒤여야 합니다.')
      return
    }

    setError('')
    try {
      const created = await createSchedule.mutateAsync({
        title: form.title.trim(),
        description: form.memo.trim(),
        startAt,
        endAt,
      })
      // 만든 일정으로 바로 들어가야 장소를 이어서 추가할 수 있다.
      navigate(`/schedules/${created.id}`, { replace: true })
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  return (
    <div className="snew-page">
      <div className="snew-header">
        <button onClick={() => navigate(-1)} className="sdetail-back-btn">
          <Icon raw={arrowLeftRaw} size={20} />
        </button>
        <h1 className="snew-header__title">새 일정</h1>
      </div>

      <form onSubmit={handleSubmit} className="snew-form">
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

        {error && <p className="snew-form__error" role="alert">{error}</p>}
        <button type="submit" className="snew-form__submit" disabled={createSchedule.isPending}>
          {createSchedule.isPending ? '저장 중…' : '갈 곳 정하기 →'}
        </button>
      </form>
    </div>
  )
}
