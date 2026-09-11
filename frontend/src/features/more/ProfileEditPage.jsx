import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { useAuth } from '../../shared/contexts/AuthContext'
import { updateProfile } from '../../shared/api/users'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './more.css'

/**
 * 더보기 > 내 정보 > 프로필 수정.
 *
 * 지금 바꿀 수 있는 값은 닉네임뿐이다. 이메일은 로그인 수단이라 본인 확인 절차가
 * 따로 필요하고(docs/API_SPEC.md 3-U절), 그 절차가 정해지기 전까지 서버도 받지 않는다.
 * 그래서 화면에는 읽기 전용으로 보여주고 왜 못 바꾸는지 함께 적는다. 입력칸만 막아
 * 두면 고장 난 것으로 오해한다.
 */
export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const trimmed = nickname.trim()
  // 값이 그대로면 저장할 것이 없다. 서버는 같은 닉네임 재저장을 허용하지만(3-U절),
  // 아무것도 안 바뀌는 요청을 보내고 화면을 닫는 것보다 버튼을 잠그는 편이 정직하다.
  const changed = trimmed !== user?.nickname

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setSubmitting(true)
    try {
      const me = await updateProfile({ nickname: trimmed })
      // 컨텍스트를 갱신해야 더보기 상단 카드와 아바타가 곧바로 새 이름을 보여준다.
      updateUser(me)
      // 따로 성공 문구를 띄우지 않는다. 돌아간 화면의 프로필 카드에 바뀐 이름이
      // 그대로 보이는 것이 가장 확실한 확인이다.
      navigate('/more', { replace: true })
    } catch (caught) {
      // 닉네임 중복(409)과 길이 규칙(422) 모두 서버가 한국어 문구를 내려준다.
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
        <h1 className="more-page__heading">프로필 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="more-sub__body">
        <div className="more-form">
          <div className="more-form__field">
            <label className="more-form__label" htmlFor="profile-nickname">닉네임</label>
            <input
              id="profile-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="more-form__input"
              placeholder="2~50자"
              autoComplete="nickname"
              maxLength={50}
            />
            <p className="more-form__hint">함께 쓰는 스페이스에서 이 이름으로 보입니다.</p>
          </div>

          <div className="more-form__field">
            <label className="more-form__label" htmlFor="profile-email">이메일</label>
            <input
              id="profile-email"
              type="email"
              value={user?.email ?? ''}
              className="more-form__input more-form__input--readonly"
              readOnly
              disabled
            />
            <p className="more-form__hint">로그인에 쓰는 주소라 여기서는 바꿀 수 없습니다.</p>
          </div>
        </div>

        {error && <p className="more-form__error" role="alert">{error}</p>}

        <button type="submit" className="more-form__submit" disabled={submitting || !changed || !trimmed}>
          {submitting ? '저장 중…' : '저장'}
        </button>
      </form>
    </div>
  )
}
