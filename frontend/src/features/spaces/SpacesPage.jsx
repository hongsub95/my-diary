import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import { useSpaces } from './SpaceContext'
import { SpaceBadge, SpaceFrame } from './SpaceUI'

export default function SpacesPage() {
  const { spaces, spacesQuery, currentSpaceId, selectSpace } = useSpaces()
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (spacesQuery.error) showSnackbar('공간을 불러오지 못했어요. 다시 불러오기를 눌러 주세요.')
  }, [spacesQuery.error, showSnackbar])
  return <SpaceFrame title="내 공간" back={location.state?.from === '/home' ? '/home' : '/more'}>
    <section className="space-intro"><span className="space-eyebrow">함께 계획하고, 함께 기억하기</span><h2>우리의 하루가<br />쌓이는 곳</h2><p>나만의 기록도, 둘만의 약속도, 친구들과의 여행도.<br />함께할 사람마다 새로운 공간을 만들어 보세요.</p></section>
    <div className="space-actions"><Link className="space-button space-button--primary" to="/spaces/new">＋ 새 공간 만들기</Link><Link className="space-button" to="/spaces/join">참여 번호로 들어가기</Link></div>
    <section className="space-section"><h2>내 공간 <span>{spaces.length}</span></h2><p className="space-hint">전환은 지금 보는 공간만 바꿔요. 처음 열 공간은 상세에서 따로 지정할 수 있어요.</p>
      {spacesQuery.isPending && <p role="status">공간을 불러오고 있어요.</p>}
      {spacesQuery.isError && <button type="button" className="space-button" onClick={() => spacesQuery.refetch()}>다시 불러오기</button>}
      {!spacesQuery.isPending && !spacesQuery.isError && spaces.length === 0 && <p>아직 참여한 공간가 없어요. 만들거나 참여해 주세요.</p>}
      <div className="space-list">{spaces.map(space => <article className={`space-card${currentSpaceId === space.id ? ' space-card--current' : ''}`} key={space.id}>
        <div className="space-card__heading"><SpaceBadge space={space} /><div><h3>{space.name}</h3><p>{space.type === 'personal' ? '나만의 공간' : `함께 ${space.member_count}명 · ${space.my_role === 'owner' ? '주인' : '멤버'}`}</p></div></div>
        <div className="space-tags">{currentSpaceId === space.id && <span>지금 보는 공간</span>}{space.is_default && <span>처음 열 공간</span>}</div>
        <div className="space-actions"><button type="button" className="space-button" onClick={() => { if (selectSpace(space.id)) navigate('/home', { replace: true }) }}>{currentSpaceId === space.id ? '하루 보러 가기' : '이 공간으로 바꾸기'}</button><Link className="space-text-button" to={`/spaces/${space.id}`}>상세 · 관리 ›</Link></div>
      </article>)}</div>
    </section><Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </SpaceFrame>
}
