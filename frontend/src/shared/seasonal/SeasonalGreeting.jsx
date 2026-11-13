import { useAuth } from '../contexts/AuthContext'
import { getApiErrorMessage } from '../api/apiError'
import { useSeasonal } from './SeasonalContext'

/**
 * 탭 화면 맨 위의 "{닉네임}님, 메리 크리스마스" 인사와 D-데이 칩.
 *
 * @param {{onNotice: (message: string, action?: {label: string, onClick: () => void}) => void}} props
 *   레이아웃의 스낵바. 끈 뒤 "되돌리기"와 저장 실패 안내를 띄운다
 *
 * 칩의 ×는 더보기 스위치와 같은 설정을 끈다. 끄자마자 배경이 사라지므로 "되돌리기"를
 * 함께 준다 — 무심코 눌렀다가 더보기까지 찾아가 다시 켜게 하지 않으려는 것이다.
 */
export default function SeasonalGreeting({ onNotice }) {
  const { user } = useAuth()
  const { chipLabel, setEnabled } = useSeasonal()
  const greeting = user?.nickname ? `${user.nickname}님, 메리 크리스마스` : '메리 크리스마스'

  async function turn(on) {
    try {
      await setEnabled(on)
      if (!on) {
        onNotice('크리스마스 배경을 껐어요. 더보기에서 다시 켤 수 있어요.', { label: '되돌리기', onClick: () => { turn(true) } })
      }
    } catch (error) {
      onNotice(getApiErrorMessage(error))
    }
  }

  return (
    <div className="season-greeting">
      <p className="season-greeting__hello">{greeting}</p>
      <span className="season-greeting__chip">
        <span aria-hidden="true" className="season-greeting__star">★</span>
        {chipLabel}
        <button type="button" className="season-greeting__close" aria-label="크리스마스 배경 끄기" onClick={() => turn(false)}>×</button>
      </span>
    </div>
  )
}
