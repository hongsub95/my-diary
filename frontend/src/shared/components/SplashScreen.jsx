import './SplashScreen.css'

/**
 * 로그인 상태를 확인하는 동안 잠깐 보여주는 화면.
 *
 * @param {{message?: string}} props
 */
export default function SplashScreen({ message = '로그인 정보를 확인하고 있어요.' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="splash__spinner" aria-hidden="true" />
      <p className="splash__message">{message}</p>
    </div>
  )
}
