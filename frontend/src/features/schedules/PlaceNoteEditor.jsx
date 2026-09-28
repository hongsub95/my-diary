import { useState } from 'react'
import { TIME_OPTIONS, formatPlannedTime, toApiTime, toTimeOption } from '../../shared/utils/time'
import { getApiErrorMessage } from '../../shared/api/apiError'

// 서버 상한과 같은 값이다 (app/places/schemas.py MAX_MEMO_LENGTH). 여기서 먼저 막아야
// 다 쓰고 나서 422를 받는 일이 없다.
const MAX_MEMO_LENGTH = 500

/**
 * 장소 하나에 붙는 예정시각·메모.
 *
 * @param {object} props
 * @param {string} props.placeName 장소 이름. 보조 기술이 읽을 문구에 쓴다
 * @param {string|null} props.plannedTime 서버 형식 `HH:MM:SS`
 * @param {string|null} props.memo
 * @param {boolean} props.editable 고칠 수 있는지. 끝난 하루에서는 보여주기만 한다
 * @param {boolean} props.busy 저장 중인지
 * @param {(changes: object) => Promise<unknown>} props.onSave 바뀐 값만 담아 넘긴다
 *
 * **장소 이름 아래에 둔다.** 행 오른쪽 버튼 줄(순서·빼기)에 하나를 더 붙이면 좁은
 * 화면에서 네 개가 겹친다. 값이 보이는 자리를 그대로 누르게 해서 "여기를 고친다"가
 * 위치로 읽히게 했다.
 */
export default function PlaceNoteEditor({ placeName, plannedTime, memo, editable, busy, onSave }) {
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const summary = [plannedTime && formatPlannedTime(plannedTime), memo].filter(Boolean).join(' · ')

  // 열 때마다 서버 값에서 다시 시작한다. 저장 후 부모가 새 값을 내려줘도 입력 상태는
  // 따라오지 않기 때문에, 여는 순간을 맞추는 지점으로 삼는다.
  const start = () => {
    setTime(toTimeOption(plannedTime))
    setText(memo ?? '')
    setError('')
    setOpen(true)
  }

  const save = async () => {
    setError('')
    try {
      await onSave({ planned_time: toApiTime(time), memo: text.trim() || null })
      setOpen(false)
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  if (!editable) {
    return summary ? <p className="splace-note__text">{summary}</p> : null
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`splace-note__trigger${summary ? '' : ' splace-note__trigger--empty'}`}
        onClick={start}
        aria-label={`${placeName} 예정시각·메모 ${summary ? '고치기' : '넣기'}`}
      >
        {summary || '시각·메모 넣기'}
      </button>
    )
  }

  // 30분 눈금 밖의 값(예전에 다른 경로로 들어온 14:15)도 고를 수 있게 남긴다. 목록에
  // 없으면 select가 빈 칸으로 보여서, 고치지도 않았는데 시각이 지워진 것처럼 읽힌다.
  const options = !time || TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [time, ...TIME_OPTIONS]

  return (
    <div className="splace-note">
      <label className="splace-note__label">
        예정시각
        <select
          className="splace-note__time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        >
          <option value="">시각 없음</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="splace-note__label">
        메모
        <textarea
          className="splace-note__memo"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_MEMO_LENGTH}
          rows={2}
          placeholder="예약 필요, 2층 안쪽처럼 기억할 것을 적어두세요"
        />
      </label>

      {error && (
        <p className="splace-note__error" role="alert">
          {error}
        </p>
      )}

      <div className="splace-note__actions">
        <button type="button" className="splace-note__cancel" onClick={() => setOpen(false)}>
          취소
        </button>
        <button type="button" className="splace-note__save" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
