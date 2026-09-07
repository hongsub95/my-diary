import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import bookOpenRaw from '../../assets/icons/book-open.svg?raw'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import { useDiaryFeed } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './records.css'

/**
 * 기록 카드 하나.
 *
 * @param {object} props
 * @param {object} props.record 화면용 기록 모델 (diaryAdapter)
 * @param {boolean} props.featured 목록 맨 위 큰 카드인지
 * @param {() => void} props.onOpen 카드를 눌렀을 때
 */
function RecordCard({ record, featured, onOpen }) {
  // 함께한 사람을 날짜 옆에 붙인다. 제품 정체성상 "언제, 누구와"가 제목보다 먼저다
  // (docs/UX_IDENTITY_REDIRECTION_SPEC.md 8절).
  const people = record.authorNames.length > 0 ? record.authorNames.join(' · ') : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`record-card${featured ? ' record-card--featured' : ''}`}
    >
      {record.coverUrl ? (
        <img src={record.coverUrl} alt="" className="record-card__photo" loading="lazy" />
      ) : (
        // 사진 없이 글이나 타임라인만 남긴 하루도 기록이다. 자리를 비우지 않고 표시한다.
        <span className="record-card__photo record-card__photo--empty">
          <Icon raw={bookOpenRaw} size={featured ? 28 : 20} />
        </span>
      )}

      <span className="record-card__body">
        <span className="record-card__meta">
          {record.dateLabel}
          {people && ` · ${people}`}
        </span>
        <strong className="record-card__title">{record.title}</strong>
        {record.excerpt && <span className="record-card__excerpt">{record.excerpt}</span>}
        <span className="record-card__footer">
          {record.placeCount > 0 && (
            <span>
              <Icon raw={mapPinRaw} size={13} />
              {record.placeCount}곳
            </span>
          )}
          {record.photoCount > 0 && <span>사진 {record.photoCount}</span>}
          {record.timelineCount > 0 && <span>기록 {record.timelineCount}</span>}
        </span>
      </span>
    </button>
  )
}

/**
 * 기록 탭. 완료한 하루를 최신순으로 훑는 화면이다.
 *
 * 예정된 하루는 여기 오지 않는다. 계획은 일정 탭, 기억은 기록 탭으로 역할을 나눈다
 * (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 2절).
 */
export default function RecordsPage() {
  const navigate = useNavigate()
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiaryFeed()

  // 커서로 이어 받은 페이지들을 한 줄로 편다. 화면은 페이지 경계를 알 필요가 없다.
  const records = data?.pages.flatMap((page) => page.records) ?? []

  return (
    <div className="records-page">
      <header className="records-page__header">
        <p className="records-page__eyebrow">MY DAYBOOK</p>
        <h1 className="records-page__title">우리가 보낸 하루들</h1>
        <p className="records-page__subtitle">날짜보다 장면으로 먼저 기억해 보세요.</p>
      </header>

      {isPending && <p className="records-page__status">기록을 불러오고 있어요.</p>}

      {isError && (
        <p className="records-page__status records-page__status--error" role="alert">
          {getApiErrorMessage(error)}
        </p>
      )}

      {!isPending && !isError && records.length === 0 && (
        <div className="records-empty">
          <Icon raw={bookOpenRaw} size={32} className="records-empty__icon" />
          <p className="records-empty__title">아직 남긴 하루가 없어요.</p>
          <p className="records-empty__text">
            다녀온 하루에 사진 한 장만 올려도 기록이 됩니다.
          </p>
          <button type="button" onClick={() => navigate('/schedules')} className="records-empty__button">
            지난 일정 보기
          </button>
        </div>
      )}

      {records.length > 0 && (
        <div className="records-list">
          {records.map((record, index) => (
            <RecordCard
              key={record.scheduleId}
              record={record}
              // 맨 위 하나만 크게 보여준다. 가장 최근 하루를 장면으로 먼저 보게 한다.
              featured={index === 0}
              onOpen={() => navigate(`/schedules/${record.scheduleId}`)}
            />
          ))}
        </div>
      )}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="records-page__more"
        >
          {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  )
}
