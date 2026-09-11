import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { useAuth } from '../../shared/contexts/AuthContext'
import { applyTheme, getPalette, THEME_KEYS, DEFAULT_THEME_KEY } from '../../shared/theme/palettes'
import { updateProfile } from '../../shared/api/users'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './more.css'

/**
 * 더보기 > 앱 설정 > 테마.
 *
 * 고르는 즉시 화면 전체에 미리보기를 적용하고, 저장에 실패하면 이전 테마로 되돌린다
 * (docs/DESIGN_SPEC.md 2.3절). 저장을 기다렸다가 바꾸면 색을 비교해볼 수 없고,
 * 되돌리지 않으면 저장되지 않은 색을 계속 보게 된다.
 */
export default function ThemePage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const savedKey = user?.theme_key ?? DEFAULT_THEME_KEY

  // 화면에 지금 적용된 키. 저장에 실패하면 이전 값으로 되돌아가므로 savedKey와 같아진다.
  const [previewKey, setPreviewKey] = useState(savedKey)
  // 저장에 실패한 키. 되돌린 뒤에도 "무엇을 시도했는지"를 알아야 다시 시도할 수 있다.
  const [failedKey, setFailedKey] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (key) => {
    // 이전 값을 미리 잡아둔다. 실패했을 때 돌아갈 곳이다.
    const previous = savedKey

    setError('')
    setFailedKey(null)
    setSaving(true)
    setPreviewKey(key)
    applyTheme(key)

    try {
      const me = await updateProfile({ themeKey: key })
      // AuthContext를 갱신하면 ThemeSync가 같은 값으로 다시 맞춘다. 이걸 하지 않으면
      // 다른 화면으로 갔다가 돌아왔을 때 옛 값으로 되돌아간다.
      updateUser(me)
    } catch (caught) {
      setPreviewKey(previous)
      applyTheme(previous)
      setFailedKey(key)
      setError(getApiErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="more-page">
      <div className="more-sub__header">
        <button type="button" onClick={() => navigate(-1)} className="more-sub__back" aria-label="뒤로">
          <Icon raw={arrowLeftRaw} size={20} />
        </button>
        <h1 className="more-page__heading">테마</h1>
      </div>

      <div className="more-sub__body">
        <p className="more-form__hint">고른 색은 계정에 저장되어 웹과 앱에서 함께 적용됩니다.</p>

        <div className="more-menu">
          {THEME_KEYS.map((key, index) => {
            const palette = getPalette(key)
            const selected = previewKey === key

            return (
              <div key={key}>
                <button
                  type="button"
                  className="theme-option"
                  onClick={() => save(key)}
                  disabled={saving}
                  aria-pressed={selected}
                >
                  {/* 색 견본과 이름을 함께 둔다. 견본만 두면 색을 구분하기 어려운
                      사용자가 고를 수 없다(2.3절: 색상만으로 전달하지 않는다).
                      선택 표시도 색이 아니라 체크 기호로 한다. */}
                  <span className="theme-option__swatch" style={{ background: palette.primary }} />
                  <span className="theme-option__label">{palette.label}</span>
                  {selected && <span className="theme-option__check" aria-hidden="true">✓</span>}
                </button>
                {index < THEME_KEYS.length - 1 && <div className="more-menu__divider" />}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="theme-error" role="alert">
            <p className="more-form__error">{error}</p>
            {/* 실패하면 색은 이전으로 돌아가 있다. 무엇을 시도했는지는 failedKey가
                들고 있으므로 같은 선택을 다시 보낼 수 있다. */}
            <button type="button" className="theme-retry" onClick={() => save(failedKey)} disabled={saving}>
              {getPalette(failedKey).label}(으)로 다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
