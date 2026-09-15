import { useState } from 'react'
import { formatDistance } from '../../shared/utils/distance'
import { getApiErrorMessage } from '../../shared/api/apiError'

/**
 * 순서 다듬기 제안.
 *
 * @param {object} props
 * @param {Array} props.places 지금 담긴 장소들 (이름을 보여주는 데 쓴다)
 * @param {object} props.optimize 제안을 받아오는 mutation
 * @param {object} props.reorder 적용할 때 쓰는 순서 변경 mutation
 *
 * **받은 제안을 바로 적용하지 않는다.** 서버는 거리만 보기 때문에 "카페 → 저녁 → 술"
 * 처럼 순서에 뜻이 있는 하루를 뒤섞을 수 있다. 바뀐 순서를 눈으로 확인하고 사람이
 * 적용을 누르게 한다.
 */
export default function OptimizeSuggestion({ places, optimize, reorder }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const nameOf = (schedulePlaceId) =>
    places.find((place) => place.id === schedulePlaceId)?.name ?? '알 수 없는 장소'

  const request = async () => {
    setError('')
    try {
      setPreview(await optimize.mutateAsync())
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  const apply = async () => {
    setError('')
    try {
      await reorder.mutateAsync(preview.suggested.schedule_place_ids)
      setPreview(null)
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  // 두 곳 이하는 바꿀 것이 없다. 눌러도 "그대로가 좋아요"만 나오는 버튼을 두지 않는다.
  if (places.length < 3) return null

  return (
    <div className="sopt">
      {!preview && (
        <button type="button" className="sopt__trigger" onClick={request} disabled={optimize.isPending}>
          {optimize.isPending ? '살펴보는 중…' : '순서 다듬기'}
        </button>
      )}

      {preview && !preview.recommended && (
        <div className="sopt__panel">
          <p className="sopt__title">지금 순서가 이미 괜찮아요</p>
          <p className="sopt__note">더 짧게 돌 방법을 찾지 못했어요.</p>
          <button type="button" className="sopt__ghost" onClick={() => setPreview(null)}>
            닫기
          </button>
        </div>
      )}

      {preview && preview.recommended && (
        <div className="sopt__panel">
          <p className="sopt__title">
            이렇게 돌면 <strong>{formatDistance(preview.saved_distance_m)}</strong> 짧아져요
          </p>

          <ol className="sopt__order">
            {preview.suggested.schedule_place_ids.map((placeId, index) => (
              <li key={placeId}>
                <span className="sopt__order-number">{index + 1}</span>
                {nameOf(placeId)}
              </li>
            ))}
          </ol>

          {/* 근거를 숨기지 않는다. 실제 도로 거리로 오해하면 "왜 이 순서지?" 싶을 때
              설명할 길이 없다. */}
          <p className="sopt__note">
            직선거리로 계산한 제안이에요. 실제 길이나 이동 시간과는 다를 수 있어요.
            {preview.skipped_place_ids.length > 0 &&
              ' 주소가 없는 장소는 순서를 그대로 뒀어요.'}
          </p>

          {error && <p className="sopt__error" role="alert">{error}</p>}

          <div className="sopt__actions">
            <button type="button" className="sopt__ghost" onClick={() => setPreview(null)}>
              그대로 둘래요
            </button>
            <button type="button" className="sopt__apply" onClick={apply} disabled={reorder.isPending}>
              {reorder.isPending ? '바꾸는 중…' : '이 순서로 바꾸기'}
            </button>
          </div>
        </div>
      )}

      {error && !preview && <p className="sopt__error" role="alert">{error}</p>}
    </div>
  )
}
