import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import userRaw from '../../assets/icons/user.svg?raw'
import logoutRaw from '../../assets/icons/logout.svg?raw'
import chevronRightRaw from '../../assets/icons/chevron-right.svg?raw'
import { useAuth } from '../../shared/contexts/AuthContext'
import './more.css'

// 더보기 안의 항목은 동작이 제각각이라 DB로 관리하지 않고 여기서 관리한다
// (docs/BOTTOM_NAVIGATION_SPEC.md 8.1절). 그룹 구성은 같은 문서 6.5절을 따른다.
//
// ready는 "이 빌드에서 실제로 열 수 있는가"다. false면 눌리지 않고 '준비 중'으로
// 표시한다. 화면과 API가 준비되면 ready를 true로 바꾸고 to를 채우면 된다.
// 미구현 항목을 눌러 빈 화면이나 오류를 보여주지 않기 위한 장치다(같은 문서 7절).
const MENU_GROUPS = [
  {
    title: '내 정보',
    items: [
      { key: 'profile', label: '프로필 수정', ready: false },
      // 소셜 로그인 계정에는 노출하지 않아야 하는 항목이다. 판별 필드는 6.5절 요구사항이지만
      // /auth/me 응답(UserResponse)에 아직 없고 소셜 로그인 자체가 미구현이라, 필드가 생기기
      // 전까지는 이메일·비밀번호 계정으로 본다. 판별 로직은 canChangePassword 참고.
      { key: 'password', label: '비밀번호 변경', ready: false, emailAccountOnly: true },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { key: 'notifications', label: '알림 설정', ready: false },
      { key: 'theme', label: '테마', ready: false },
    ],
  },
  {
    title: '서비스 정보',
    items: [
      { key: 'privacy', label: '개인정보 처리방침', ready: false },
      { key: 'terms', label: '서비스 이용약관', ready: false },
    ],
  },
]

/**
 * 더보기 탭. 프로필 요약과 저빈도 관리 기능을 모아둔 화면이다.
 *
 * 기존 설정 화면을 대체한다. /settings로 들어와도 App.jsx가 이리로 보낸다.
 */
export default function MorePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // 소셜 로그인이 생기면 서버가 계정 유형을 내려준다. 그 전까지 이 값은 항상 true다.
  const canChangePassword = user?.auth_provider ? user.auth_provider === 'email' : true

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="more-page">
      <div className="more-page__header">
        <h1 className="more-page__heading">더보기</h1>
      </div>

      <div className="more-page__body">
        <section className="more-profile">
          <div className="more-profile__avatar">
            <Icon raw={userRaw} size={32} className="more-profile__avatar-icon" />
          </div>
          <div>
            <p className="more-profile__name">{user?.nickname}</p>
            <p className="more-profile__email">{user?.email}</p>
          </div>
        </section>

        {MENU_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.emailAccountOnly || canChangePassword)
          if (items.length === 0) return null

          return (
            <section key={group.title} className="more-group">
              <h2 className="more-group__title">{group.title}</h2>
              <div className="more-menu">
                {items.map((item, i) => (
                  <div key={item.key}>
                    <button
                      type="button"
                      className="more-menu__item"
                      disabled={!item.ready}
                      aria-disabled={!item.ready}
                    >
                      <span>{item.label}</span>
                      {item.ready ? (
                        <Icon raw={chevronRightRaw} size={16} className="more-menu__arrow" />
                      ) : (
                        <span className="more-menu__badge">준비 중</span>
                      )}
                    </button>
                    {i < items.length - 1 && <div className="more-menu__divider" />}
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {/* 계정 그룹은 되돌리기 어려운 동작이라 일반 탐색 메뉴와 시각적으로 떼어 놓는다(6.5절). */}
        <section className="more-group">
          <h2 className="more-group__title">계정</h2>
          <button type="button" onClick={handleLogout} className="more-logout">
            <Icon raw={logoutRaw} size={20} className="more-logout__icon" />
            로그아웃
          </button>
          {/* 탈퇴는 데이터 처리 안내와 재인증이 함께 필요해(6.5절) API가 생긴 뒤에 연다. */}
          <button type="button" className="more-withdraw" disabled aria-disabled="true">
            <span>계정 탈퇴</span>
            <span className="more-menu__badge">준비 중</span>
          </button>
        </section>
      </div>
    </div>
  )
}
