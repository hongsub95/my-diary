import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { useCreateSchedule } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './schedules.css'

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
  return new Date(date + 'T' + timeText + ':00').toISOString()
}

export default function ScheduleNewPage() {
  const navigate = useNavigate()
  const createSchedule = useCreateSchedule()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '12:00',
    end_time: '15:00',
    memo: '',
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    const startAt = toUtcIso(form.date, form.start_time)
    const endAt = toUtcIso(form.date, form.end_time)
    // 서버도 같은 규칙으로 막지만(422), 화면에서 먼저 걸러 왕복을 줄인다.
    if (endAt < startAt) {
      setError('종료 시간이 시작 시간보다 빠릅니다.')
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
        <div className="snew-form__field">
          <label className="snew-form__label">제목 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="snew-form__input"
            placeholder="일정 이름을 입력하세요"
            required
          />
        </div>

        <div className="snew-form__field">
          <label className="snew-form__label">날짜 *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="snew-form__input"
            required
          />
        </div>

        <div className="snew-form__row">
          <div className="snew-form__field">
            <label className="snew-form__label">시작 시간</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set('start_time', e.target.value)}
              className="snew-form__input"
            />
          </div>
          <div className="snew-form__field">
            <label className="snew-form__label">종료 시간</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set('end_time', e.target.value)}
              className="snew-form__input"
            />
          </div>
        </div>

        <div className="snew-form__field">
          <label className="snew-form__label">메모</label>
          <textarea
            value={form.memo}
            onChange={(e) => set('memo', e.target.value)}
            className="snew-form__input snew-form__textarea"
            placeholder="메모를 입력하세요 (선택)"
            rows={4}
          />
        </div>

        {error && <p className="snew-form__error" role="alert">{error}</p>}
        <button type="submit" className="snew-form__submit" disabled={createSchedule.isPending}>
          {createSchedule.isPending ? '저장 중…' : '일정 추가하기'}
        </button>
      </form>
    </div>
  )
}
