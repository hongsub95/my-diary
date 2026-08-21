import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/contexts/AuthContext'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './auth.css'

// 서버와 같은 규칙을 화면에서도 미리 확인해, 틀린 게 확실한 입력으로 왕복하지 않게 한다.
// 최종 판단은 서버가 한다(app/auth/schemas.py). 이 목록을 고치면 그쪽도 함께 봐야 한다.
const SPECIAL_CHARACTERS = `!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`

function satisfiesPasswordPolicy(value) {
  return value.length >= 9
    && /[A-Za-z]/.test(value)
    && /[0-9]/.test(value)
    && [...value].some((character) => SPECIAL_CHARACTERS.includes(character))
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nickname: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nickname || !form.email || !form.password) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    if (!satisfiesPasswordPolicy(form.password)) {
      setError('비밀번호는 9자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해 주세요.')
      return
    }
    // 비밀번호 확인은 화면에만 있는 항목이라 서버로 보내지 않는다.
    if (form.password !== form.confirm) {
      setError('비밀번호가 일치하지 않아요.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      // 가입에 성공하면 세션 쿠키까지 함께 내려와서 바로 로그인 상태가 된다.
      await register({
        email: form.email.trim(),
        nickname: form.nickname.trim(),
        password: form.password,
      })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <h1 className="auth-page__title">회원가입</h1>
        <p className="auth-page__subtitle">나의 일기를 시작해요</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="register-nickname">닉네임</label>
          <input
            id="register-nickname"
            type="text"
            autoComplete="nickname"
            value={form.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            className="auth-form__input"
            placeholder="닉네임을 입력하세요"
          />
        </div>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="register-email">이메일</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="auth-form__input"
            placeholder="example@email.com"
          />
        </div>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="register-password">비밀번호</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="auth-form__input"
            placeholder="비밀번호"
          />
          <p className="auth-form__hint">9자 이상 · 영문, 숫자, 특수문자 포함</p>
        </div>
        <div className="auth-form__field">
          <label className="auth-form__label" htmlFor="register-confirm">비밀번호 확인</label>
          <input
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
            className="auth-form__input"
            placeholder="비밀번호 다시 입력"
          />
        </div>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? '가입 중…' : '가입하기'}
        </button>
      </form>

      <p className="auth-page__footer">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="auth-page__link">로그인</Link>
      </p>
    </div>
  )
}
