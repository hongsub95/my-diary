import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { changePassword } from '../../shared/api/users'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './more.css'

/**
 * 더보기 > 내 정보 > 비밀번호 변경.
 *
 * 현재 비밀번호를 함께 받는다. 로그인된 화면을 잠깐 빌린 사람이 비밀번호만 바꿔
 * 계정을 가져가는 것을 막기 위해서다(docs/API_SPEC.md 3-U절).
 *
 * 확인용 입력칸은 서버에 보내지 않는다. 서버가 검사할 수 없는 종류의 실수(오타)를
 * 화면에서 잡는 용도이고, 이걸 보내면 서버가 쓰지도 않을 평문 비밀번호를 한 번 더
 * 네트워크에 싣게 된다.
 */
export default function PasswordChangePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const filled = form.current && form.next && form.confirm

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.next !== form.confirm) {
      setError('새 비밀번호가 서로 다릅니다.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await changePassword({ currentPassword: form.current, newPassword: form.next })
      // 성공해도 로그아웃되지 않는다. 서버가 지금 쓰는 세션만 남기고 다른 기기의
      // 세션을 끊기 때문이다(3-U절). 그래서 로그인 화면이 아니라 더보기로 돌아간다.
      navigate('/more', { replace: true, state: { notice: '비밀번호를 변경했습니다.' } })
    } catch (caught) {
      // 현재 비밀번호가 틀리면 422다. 401이 아니라서 이 화면이 유지되고, 사용자는
      // 다시 입력할 수 있다.
      setError(getApiErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="more-page">
      <div className="more-sub__header">
        <button type="button" onClick={() => navigate(-1)} className="more-sub__back" aria-label="뒤로">
          <Icon raw={arrowLeftRaw} size={20} />
        </button>
        <h1 className="more-page__heading">비밀번호 변경</h1>
      </div>

      <form onSubmit={handleSubmit} className="more-sub__body">
        <div className="more-form">
          <div className="more-form__field">
            <label className="more-form__label" htmlFor="password-current">현재 비밀번호</label>
            <input
              id="password-current"
              type="password"
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => set('current', e.target.value)}
              className="more-form__input"
            />
          </div>

          <div className="more-form__field">
            <label className="more-form__label" htmlFor="password-next">새 비밀번호</label>
            <input
              id="password-next"
              type="password"
              autoComplete="new-password"
              value={form.next}
              onChange={(e) => set('next', e.target.value)}
              className="more-form__input"
            />
            <p className="more-form__hint">9자 이상, 영문·숫자·특수문자를 각각 1개 이상 포함해주세요.</p>
          </div>

          <div className="more-form__field">
            <label className="more-form__label" htmlFor="password-confirm">새 비밀번호 확인</label>
            <input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              className="more-form__input"
            />
          </div>
        </div>

        {/* 다른 기기가 끊긴다는 사실을 누르기 전에 알린다. 바꾸고 나서 다른 기기가
            로그아웃된 것을 발견하면 고장으로 오해한다. */}
        <p className="more-form__notice">
          비밀번호를 바꾸면 다른 기기에서 열어둔 웹 로그인이 모두 해제됩니다. 지금 쓰는
          이 화면은 그대로 유지됩니다.
        </p>

        {error && <p className="more-form__error" role="alert">{error}</p>}

        <button type="submit" className="more-form__submit" disabled={submitting || !filled}>
          {submitting ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}
