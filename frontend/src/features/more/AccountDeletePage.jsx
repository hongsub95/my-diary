import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { useAuth } from '../../shared/contexts/AuthContext'
import { listSpaces } from '../../shared/api/spaces'
import { deleteAccount } from '../../shared/api/users'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './more.css'

// 실수로 누르는 것을 막는 마지막 관문. 비밀번호만 받으면 "확인" 버튼을 습관적으로
// 누르는 사람을 못 막는다. 정해진 글자를 직접 쳐야 넘어간다
// (docs/SPACE_MODEL_SPEC.md 7.4절이 스페이스 삭제에 요구하는 것과 같은 장치다).
const CONFIRM_WORD = '탈퇴합니다'

/**
 * 더보기 > 계정 > 계정 탈퇴.
 *
 * 되돌릴 수 없는 동작이라 세 가지를 요구한다.
 * 1. 무엇이 사라지는지 읽게 한다 (내가 owner인 공유 스페이스는 남은 멤버가 있어도 함께 보관된다)
 * 2. 확인 문구를 직접 입력하게 한다
 * 3. 비밀번호로 재인증한다 (docs/BOTTOM_NAVIGATION_SPEC.md 6.5절)
 */
export default function AccountDeletePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 경고 문구를 만들려면 내가 owner인 스페이스를 알아야 한다. 전용 API를 두지 않고
  // 스페이스 목록으로 계산한다 — 서버가 이미 my_role과 member_count를 준다.
  const spaces = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })

  const ownedShared = (spaces.data ?? []).filter(
    (space) => space.my_role === 'owner' && space.type === 'shared',
  )
  // 나를 뺀 인원이 접근을 잃는 사람 수다.
  const affectedMembers = ownedShared.reduce(
    (total, space) => total + Math.max(space.member_count - 1, 0),
    0,
  )

  const canSubmit = confirmText.trim() === CONFIRM_WORD && password.length > 0 && !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setError('')
    setSubmitting(true)
    try {
      await deleteAccount({ currentPassword: password })
    } catch (caught) {
      // 비밀번호가 틀리면 422다. 이때는 아무것도 지워지지 않았으므로 화면을 유지한다.
      setError(getApiErrorMessage(caught))
      setSubmitting(false)
      return
    }

    // 여기부터는 계정이 이미 사라졌다. 무엇이 실패해도 오류를 보여주지 않는다 —
    // 성공한 탈퇴를 실패로 읽히게 하는 쪽이 더 나쁘다. 서버가 세션과 쿠키를 이미
    // 지웠으므로 logout()은 남은 화면 상태를 비우는 용도다.
    try {
      await logout()
    } catch {
      // 화면 상태는 logout 내부의 finally에서 비로그인으로 되돌려진다.
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="more-page">
      <div className="more-sub__header">
        <button type="button" onClick={() => navigate(-1)} className="more-sub__back" aria-label="뒤로">
          <Icon raw={arrowLeftRaw} size={20} />
        </button>
        <h1 className="more-page__heading">계정 탈퇴</h1>
      </div>

      <form onSubmit={handleSubmit} className="more-sub__body">
        <section className="more-danger">
          <h2 className="more-danger__title">탈퇴하면 되돌릴 수 없습니다</h2>
          <ul className="more-danger__list">
            <li><strong>{user?.email}</strong> 계정으로 다시 로그인할 수 없습니다.</li>
            <li>같은 이메일과 닉네임으로 다시 가입할 수 없습니다.</li>
            <li>내가 만든 스페이스는 함께 사라집니다. 남은 멤버도 열 수 없습니다.</li>
            <li>남긴 일기와 사진은 지워지지 않고 기록으로 남습니다.</li>
          </ul>
        </section>

        {/* 내가 owner인 공유 스페이스는 남의 하루까지 함께 닫는다. 숫자로 보여주지
            않으면 "내 것만 지우는 것"으로 오해한다. */}
        {ownedShared.length > 0 && (
          <section className="more-danger more-danger--spaces">
            <h2 className="more-danger__title">
              함께 사라지는 스페이스 {ownedShared.length}개
            </h2>
            <ul className="more-danger__list">
              {ownedShared.map((space) => (
                <li key={space.id}>
                  {space.name} <span className="more-danger__count">멤버 {space.member_count}명</span>
                </li>
              ))}
            </ul>
            {affectedMembers > 0 && (
              <p className="more-danger__note">
                나를 포함하지 않은 {affectedMembers}명이 이 스페이스의 일정과 기록에 더 이상
                접근할 수 없게 됩니다.
              </p>
            )}
          </section>
        )}

        <div className="more-form">
          <div className="more-form__field">
            <label className="more-form__label" htmlFor="delete-confirm">
              확인을 위해 <strong>{CONFIRM_WORD}</strong>를 입력해주세요
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="more-form__input"
              placeholder={CONFIRM_WORD}
              autoComplete="off"
            />
          </div>

          <div className="more-form__field">
            <label className="more-form__label" htmlFor="delete-password">비밀번호</label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="more-form__input"
            />
            <p className="more-form__hint">본인 확인을 위해 한 번 더 입력받습니다.</p>
          </div>
        </div>

        {error && <p className="more-form__error" role="alert">{error}</p>}

        <button type="submit" className="more-form__submit more-form__submit--danger" disabled={!canSubmit}>
          {submitting ? '탈퇴 처리 중…' : '계정 탈퇴'}
        </button>
      </form>
    </div>
  )
}
