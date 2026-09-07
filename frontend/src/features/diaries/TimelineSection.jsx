import { useState } from 'react'
import { Icon } from '../../shared/components/Icon'
import plusRaw from '../../assets/icons/plus.svg?raw'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import { getApiErrorMessage } from '../../shared/api/apiError'

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * 화면에서 고른 시각을 서버가 받는 UTC ISO 문자열로 바꾼다.
 *
 * @param {string} dateKey 일정 날짜 `YYYY-MM-DD`
 * @param {string} timeText `HH:MM`
 *
 * 한국 시간으로 고정해 변환한다. 기기 시간대에 맡기면 해외에 있거나 시계가 어긋난
 * 사용자의 기록이 엉뚱한 시각에 남는다.
 */
function toUtcIso(dateKey, timeText) {
  return new Date(`${dateKey}T${timeText}:00+09:00`).toISOString()
}

/**
 * 타임라인 항목 추가 폼.
 *
 * @param {object} props
 * @param {string} props.dateKey 이 일정의 날짜. 시각만 받고 날짜는 여기서 채운다
 * @param {Array} props.places 일정에 담아둔 장소들. 연결할 대상 후보다
 * @param {object} props.mutation useDiary의 addTimeline
 * @param {() => void} props.onClose 닫기
 */
function TimelineForm({ dateKey, places, mutation, onClose }) {
  const [time, setTime] = useState('12:00')
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('무엇을 했는지 입력해 주세요.')
      return
    }

    setError('')
    try {
      await mutation.mutateAsync({
        occurredAt: toUtcIso(dateKey, time),
        title: title.trim(),
        memo: memo.trim(),
        // 고르지 않았으면 장소 없이 남긴다. 계획에 없던 곳도 기록할 수 있어야 한다.
        schedulePlaceId: placeId ? Number(placeId) : null,
      })
      onClose()
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="timeline-form">
      <div className="timeline-form__row">
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="timeline-form__time"
          aria-label="시각"
        />
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="timeline-form__title"
          placeholder="무엇을 했나요?"
          autoFocus
        />
      </div>

      {places.length > 0 && (
        <select
          value={placeId}
          onChange={(event) => setPlaceId(event.target.value)}
          className="timeline-form__place"
          aria-label="장소 연결"
        >
          <option value="">장소 연결 안 함</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>{place.name}</option>
          ))}
        </select>
      )}

      <input
        type="text"
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        className="timeline-form__memo"
        placeholder="메모 (선택)"
      />

      {error && <p className="diary-editor__error" role="alert">{error}</p>}

      <div className="diary-editor__actions">
        <button type="button" onClick={onClose} className="diary-editor__cancel">취소</button>
        <button type="submit" className="diary-editor__submit" disabled={mutation.isPending}>
          {mutation.isPending ? '남기는 중…' : '남기기'}
        </button>
      </div>
    </form>
  )
}

/**
 * 실제 방문 타임라인. 계획이 아니라 "그날 실제로 어땠는지"를 남기는 영역이다.
 *
 * @param {object} props
 * @param {string} props.dateKey 일정 날짜 `YYYY-MM-DD`
 * @param {Array} props.places 일정에 담아둔 장소들
 * @param {object} props.timeline useDiary의 timeline 조회 결과
 * @param {object} props.addTimeline 추가 mutation
 * @param {object} props.removeTimeline 삭제 mutation
 *
 * 위치 권한을 쓰지 않는다. 사용자가 시각과 내용을 직접 적으며, 나중에 GPS 자동
 * 타임라인이 생겨도 이 수동 입력은 유지된다(docs/DEVELOPMENT_BRIEF.md 9절).
 */
export default function TimelineSection({ dateKey, places, timeline, addTimeline, removeTimeline }) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const items = timeline.data ?? []

  const handleRemove = async (itemId) => {
    setError('')
    try {
      await removeTimeline.mutateAsync(itemId)
    } catch (caught) {
      // 남이 남긴 항목은 서버가 막는다. 왜 안 되는지 그대로 보여준다.
      setError(getApiErrorMessage(caught))
    }
  }

  return (
    <section className="sdetail-section">
      <div className="sdetail-section__header">
        <h2 className="sdetail-section__title">방문 기록</h2>
        {!adding && (
          <button type="button" className="sdetail-section__edit" onClick={() => setAdding(true)}>
            <Icon raw={plusRaw} size={14} />
            추가
          </button>
        )}
      </div>

      {adding && (
        <TimelineForm
          dateKey={dateKey}
          places={places}
          mutation={addTimeline}
          onClose={() => setAdding(false)}
        />
      )}

      {error && <p className="diary-editor__error" role="alert">{error}</p>}

      {items.length > 0 ? (
        <ol className="timeline-list">
          {items.map((item) => (
            <li key={item.id} className="timeline-item">
              <time className="timeline-item__time">
                {timeFormatter.format(new Date(item.occurred_at))}
              </time>
              <div className="timeline-item__body">
                <strong className="timeline-item__title">{item.title}</strong>
                {item.place_name && (
                  <span className="timeline-item__place">
                    <Icon raw={mapPinRaw} size={12} />
                    {item.place_name}
                  </span>
                )}
                {item.memo && <p className="timeline-item__memo">{item.memo}</p>}
              </div>
              <button
                type="button"
                className="timeline-item__remove"
                onClick={() => handleRemove(item.id)}
                disabled={removeTimeline.isPending}
                aria-label={`${item.title} 기록 지우기`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      ) : (
        !adding && (
          <p className="diary-section__empty">
            몇 시에 어디를 다녀왔는지 남겨두면 나중에 하루가 더 잘 떠올라요.
          </p>
        )
      )}
    </section>
  )
}
