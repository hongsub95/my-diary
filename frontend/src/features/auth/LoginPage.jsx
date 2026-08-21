import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/contexts/AuthContext'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './auth.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await login({ email: form.email.trim(), password: form.password })
      // 어느 화면으로 갈지는 App.jsx의 index 라우트가 정한다. 여기서 특정 경로를
      // 박아두면 시작 화면을 바꿀 때 고쳐야 할 곳이 늘어난다.
      navigate('/', { replace: true })
    } catch (caught) {
      // 서버가 한국어 문구를 내려주므로 그대로 보여준다. 비밀번호가 틀렸는지
      // 없는 계정인지는 서버가 일부러 구분하지 않는다.
      setError(getApiErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <h1 className="auth-page__title">나의 일기</h1>
        <p className="auth-page__subtitle">내일의 나를 위한 기록</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="auth-form__input"
            placeholder="example@email.com"
          />
        </div>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="auth-form__input"
            placeholder="비밀번호"
          />
        </div>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <p className="auth-page__footer">
        계정이 없으신가요?{' '}
        <Link to="/register" className="auth-page__link">회원가입</Link>
      </p>
    </div>
  )
}
