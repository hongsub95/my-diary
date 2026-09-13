import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../shared/contexts/AuthContext'
import { apiClient } from '../../shared/api/client'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import './collection.css'

const dateLabel = value => new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })

export default function CollectionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') === 'records' ? 'records' : 'schedules'
  const q = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const [draft, setDraft] = useState({ q, from, to })
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const spaceId = user?.default_space_id
  const query = useInfiniteQuery({
    queryKey: ['schedules', 'collection', spaceId, kind, q, from, to],
    queryFn: async ({ pageParam, signal }) => (await apiClient.get(`/spaces/${spaceId}/schedules/collection`, {
      params: { kind, q, from: from || undefined, to: to || undefined, cursor: pageParam }, signal,
    })).data,
    initialPageParam: undefined,
    getNextPageParam: page => page.next_cursor ?? undefined,
    enabled: Boolean(spaceId),
  })
  useEffect(() => {
    if (query.error) showSnackbar('모아보기를 불러오지 못했어요. 다시 시도해 주세요.')
  }, [query.error, showSnackbar])
  const apply = event => {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) {
      showSnackbar('종료일은 시작일과 같거나 이후로 선택해 주세요.')
      return
    }
    setParams({ kind, q: draft.q.trim(), from: draft.from, to: draft.to }, { replace: true })
  }
  const items = query.data?.pages.flatMap(page => page.items) ?? []
  return <div className="collection-page">
    <header><Link to="/more">‹ 전체 메뉴</Link><h1>모아보기</h1><p>계획한 하루와 남겨둔 기억을 찾아보세요.</p></header>
    <div className="collection-tabs" role="tablist" aria-label="모아보기 종류">
      {[['schedules', '일정'], ['records', '기록']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={kind === value} onClick={() => setParams({ kind: value, q, from, to }, { replace: true })}>{label}</button>)}
    </div>
    <form className="collection-filters" onSubmit={apply} noValidate>
      <label className="collection-search">검색<input type="search" maxLength={100} placeholder={kind === 'records' ? '제목, 장소, 일기 내용 검색' : '제목, 장소 검색'} value={draft.q} onChange={e => setDraft({ ...draft, q: e.target.value })} /></label>
      <div className="collection-date-row">
        <label>시작일<input type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
        <span aria-hidden="true">~</span>
        <label>종료일<input type="date" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      </div>
      <div className="collection-actions"><button type="submit">검색 적용</button><button type="button" onClick={() => { setDraft({ q: '', from: '', to: '' }); setParams({ kind }, { replace: true }) }}>초기화</button></div>
    </form>
    <p className="collection-hint">{from || to ? `${from || '처음부터'} ~ ${to || '전체'}` : '전체 기간'} · 날짜순</p>
    {query.isPending && <p role="status">불러오고 있어요.</p>}
    {query.isError && <button type="button" onClick={() => query.refetch()}>다시 불러오기</button>}
    {!query.isPending && !query.isError && !items.length && <div className="collection-empty"><strong>{q || from || to ? '조건에 맞는 항목이 없어요.' : kind === 'records' ? '아직 남겨둔 기록이 없어요.' : '아직 등록한 일정이 없어요.'}</strong><p>{q || from || to ? '검색어나 날짜 범위를 바꿔보세요.' : '하루를 만들고 기억을 하나씩 모아보세요.'}</p></div>}
    <div className="collection-grid">
      {items.map(item => <button type="button" className="collection-card" key={item.id} onClick={() => navigate(`/schedules/${item.id}`)}>
        {item.record_summary.cover_thumbnail_url ? <img src={item.record_summary.cover_thumbnail_url} alt="" loading="lazy" /> : <span className="collection-cover" aria-hidden="true">{kind === 'records' ? '❏' : '▦'}</span>}
        <span className="collection-card-body"><small>{dateLabel(item.start_at)}</small><strong>{item.title}</strong><span>장소 {item.place_count}곳{item.status === 'canceled' ? ' · 취소됨' : ''}</span></span>
      </button>)}
    </div>
    {query.hasNextPage && <button type="button" className="collection-load" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</button>}
    <Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </div>
}
