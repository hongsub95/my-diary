import { useState } from 'react'
import { Icon } from '../../shared/components/Icon'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import plusRaw from '../../assets/icons/plus.svg?raw'
import { usePlaceSearch } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'

/**
 * 일정에 장소를 담는 패널.
 *
 * 검색해서 고르는 길과 직접 입력하는 길을 함께 둔다. 지도 공급자가 아직 mock이라
 * 검색만 두면 실제로 쓸 수 없고, 공급자가 붙은 뒤에도 검색에 안 나오는 장소는
 * 직접 넣어야 하기 때문이다(docs/DEVELOPMENT_BRIEF.md 6절).
 *
 * @param {object} props
 * @param {object} props.mutation useSchedulePlaceMutations의 add
 * @param {() => void} props.onClose 닫기
 */
export default function PlacePicker({ mutation, onClose }) {
  const [query, setQuery] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [error, setError] = useState('')
  const search = usePlaceSearch(query)

  const submit = async (place) => {
    setError('')
    try {
      await mutation.mutateAsync({ place })
      onClose()
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  const submitManual = (event) => {
    event.preventDefault()
    if (!manualName.trim()) {
      setError('장소 이름을 입력해주세요.')
      return
    }
    submit({ name: manualName.trim(), address: manualAddress.trim() || null })
  }

  return (
    <div className="place-picker">
      <div className="place-picker__field">
        <label className="place-picker__label">장소 검색</label>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="place-picker__input"
          placeholder="장소 이름으로 검색"
        />
      </div>

      {search.isFetching && <p className="place-picker__hint">검색 중…</p>}

      {search.data && (
        <>
          {/* 아직 지도 공급자가 붙기 전이라는 사실을 화면에서 숨기지 않는다.
              결과가 그럴듯해 보여서 실제 장소로 오해하는 편이 더 위험하다. */}
          {search.data.provider === 'mock' && (
            <p className="place-picker__notice">
              지도 공급자 연동 전이라 검색 결과는 예시입니다. 실제 장소는 직접 입력해주세요.
            </p>
          )}
          <ul className="place-picker__results">
            {search.data.items.map((item) => (
              <li key={`${item.provider}-${item.provider_place_id ?? item.name}`}>
                <button
                  type="button"
                  className="place-picker__result"
                  onClick={() => submit(item)}
                  disabled={mutation.isPending}
                >
                  <Icon raw={mapPinRaw} size={16} className="place-picker__pin" />
                  <span className="place-picker__result-text">
                    <strong>{item.name}</strong>
                    {item.address && <em>{item.address}</em>}
                  </span>
                  <Icon raw={plusRaw} size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <form onSubmit={submitManual} className="place-picker__manual">
        <p className="place-picker__label">직접 입력</p>
        <input
          type="text"
          value={manualName}
          onChange={(event) => setManualName(event.target.value)}
          className="place-picker__input"
          placeholder="장소 이름 *"
        />
        <input
          type="text"
          value={manualAddress}
          onChange={(event) => setManualAddress(event.target.value)}
          className="place-picker__input"
          placeholder="주소 (선택)"
        />
        {error && <p className="place-picker__error" role="alert">{error}</p>}
        <div className="place-picker__actions">
          <button type="button" onClick={onClose} className="place-picker__cancel">취소</button>
          <button type="submit" className="place-picker__submit" disabled={mutation.isPending}>
            {mutation.isPending ? '추가 중…' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
