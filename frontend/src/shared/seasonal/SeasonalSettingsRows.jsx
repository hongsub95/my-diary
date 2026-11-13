import { Icon } from '../components/Icon'
import snowflakeRaw from '../../assets/icons/snowflake.svg?raw'
import sunMoonRaw from '../../assets/icons/sun-moon.svg?raw'
import { getApiErrorMessage } from '../api/apiError'
import { TIME_MODE_DESCRIPTIONS, TIME_MODE_LABELS, TIME_MODES } from './seasonRules'
import { useSeasonal } from './SeasonalContext'
import './seasonal-settings.css'

/**
 * 더보기 › 나에게 맞추기 안의 "크리스마스 배경" 스위치와 "사용자 설정"(자동·낮·밤) 줄.
 *
 * @param {{onError: (message: string) => void}} props 저장 실패 안내를 띄울 더보기의 스낵바
 *
 * 기간 밖이면 두 줄 모두 숨긴다. 끌 수 없는 배경의 스위치가 남아 있으면 무엇을 끄는지
 * 알 수 없다. 배경을 끄면 "사용자 설정" 줄만 숨긴다 — 낮·밤은 배경이 보일 때만 뜻이 있다.
 * 고르는 즉시 화면에 적용하고, 저장에 실패하면 되돌린 뒤 안내한다 (테마 화면과 같다).
 *
 * 부모 카드(.more-menu) 안의 마지막 줄들로 들어간다. 위 항목과의 구분선은 여기서 그린다.
 */
export default function SeasonalSettingsRows({ onError }) {
  const { inSeason, enabled, timeMode, setEnabled, setTimeMode } = useSeasonal()
  if (!inSeason) return null

  async function toggle() {
    try {
      await setEnabled(!enabled)
    } catch (error) {
      onError(getApiErrorMessage(error))
    }
  }

  async function choose(mode) {
    if (mode === timeMode) return
    try {
      await setTimeMode(mode)
    } catch (error) {
      onError(getApiErrorMessage(error))
    }
  }

  return (
    <>
      <div className="more-menu__divider" />
      <div className="more-menu__item season-row">
        <span className="more-menu__icon" aria-hidden="true"><Icon raw={snowflakeRaw} size={20} /></span>
        <span className="more-menu__label season-row__copy">
          <span id="season-switch-label">크리스마스 배경<span className="season-row__limited">기간 한정</span></span>
          <small>12월 26일까지만 보여요</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="season-switch-label"
          className="season-switch"
          onClick={toggle}
        />
      </div>

      {enabled && (
        <>
          <div className="more-menu__divider" />
          <div className="more-menu__item season-mode">
            <div className="season-mode__line">
              <span className="more-menu__icon" aria-hidden="true"><Icon raw={sunMoonRaw} size={20} /></span>
              <span className="more-menu__label" id="season-mode-label">사용자 설정</span>
              <div className="season-segment" role="radiogroup" aria-labelledby="season-mode-label">
                {TIME_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={mode === timeMode}
                    className="season-segment__item"
                    onClick={() => choose(mode)}
                  >
                    {TIME_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
            <small className="season-mode__description">{TIME_MODE_DESCRIPTIONS[timeMode]}</small>
          </div>
        </>
      )}
    </>
  )
}
