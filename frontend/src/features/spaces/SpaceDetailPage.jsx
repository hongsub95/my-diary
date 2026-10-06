import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../shared/contexts/AuthContext'
import { deleteSpace, getSpace, leaveSpace, listMembers, regenerateJoinCode, removeMember, transferOwnership, updateSpace } from '../../shared/api/spaces'
import { getApiErrorMessage } from '../../shared/api/apiError'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import { useSpaces } from './SpaceContext'
import { SpaceBadge, SpaceConfirm, SpaceFrame } from './SpaceUI'
import { spaceInputError, spacePermissions } from './spaceModel'

export default function SpaceDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const context = useSpaces()
  const navigate = useNavigate()
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const [confirmation, setConfirmation] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const nameInput = useRef(null)
  const lock = useRef(false)
  const spaceQuery = useQuery({ queryKey: ['space', user.id, id], queryFn: () => getSpace(id), staleTime: 0 })
  const membersQuery = useQuery({ queryKey: ['space-members', user.id, id], queryFn: () => listMembers(id), staleTime: 0, enabled: Boolean(spaceQuery.data) && !spaceQuery.isError })
  const space = spaceQuery.data
  const members = membersQuery.data ?? []
  const { shared, owner, mustTransfer } = spacePermissions(space)
  useEffect(() => {
    if (spaceQuery.error || membersQuery.error) showSnackbar('공간 정보를 불러오지 못했어요. 다시 불러오기를 눌러 주세요.')
  }, [spaceQuery.error, membersQuery.error, showSnackbar])

  async function run(action, success) {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      await action()
      setConfirmation(null)
      if (success) showSnackbar(success)
      queryClient.invalidateQueries({ queryKey: ['spaces', user.id] })
      queryClient.invalidateQueries({ queryKey: ['space', user.id, id] })
      queryClient.invalidateQueries({ queryKey: ['space-members', user.id, id] })
    } catch (error) {
      showSnackbar(getApiErrorMessage(error))
      queryClient.invalidateQueries({ queryKey: ['space', user.id, id] })
      queryClient.invalidateQueries({ queryKey: ['space-members', user.id, id] })
      queryClient.invalidateQueries({ queryKey: ['spaces', user.id] })
    } finally { lock.current = false; setBusy(false) }
  }
  function confirm(title, message, label, action, success) {
    setConfirmation({ title, message, label, onConfirm: () => run(action, success) })
  }
  return <SpaceFrame title="공간 관리">
    {spaceQuery.isPending && <p role="status">공간을 불러오고 있어요.</p>}
    {spaceQuery.isError && <section className="space-card"><p>공간을 열 수 없어요. 참여 상태를 확인해 주세요.</p><button type="button" className="space-button" onClick={() => spaceQuery.refetch()}>다시 불러오기</button><Link className="space-text-button" to="/spaces">내 공간으로 돌아가기</Link></section>}
    {space && !spaceQuery.isError && <>
      <section className="space-card"><div className="space-card__heading"><SpaceBadge space={space} /><div><h2>{space.name}</h2><p>{shared ? `함께 ${space.member_count}명 · ${owner ? '주인' : '멤버'}` : '나만 볼 수 있는 개인 공간'}</p></div></div>
        <button type="button" disabled={busy} className="space-button space-button--primary" onClick={() => { if (context.selectSpace(space)) navigate('/home', { replace: true }) }}>이 공간의 하루 보기</button>
        <button type="button" disabled={busy || space.is_default} className="space-button" onClick={() => run(() => context.saveDefault(id), '앱을 시작할 때 이 공간을 열어요.')}>{space.is_default ? '처음 열 공간으로 지정됨' : '앱을 시작할 때 이 공간 열기'}</button>
      </section>
      {owner && <section className="space-card"><h2>공간 이름</h2>
        {!shared && <p className="space-hint">개인 공간은 삭제할 수 없어요. 이름은 자유롭게 바꿀 수 있어요.</p>}
        {!shared && <p className="space-hint">개인 공간은 삭제할 수 없어요. 이름은 자유롭게 바꿀 수 있어요.</p>}
        {editingName ? <form className="space-form" noValidate onSubmit={event => {
          event.preventDefault()
          const invalid = spaceInputError(nameDraft, false)
          if (invalid) { nameInput.current?.focus(); showSnackbar(invalid); return }
          run(async () => { const updated = await updateSpace(id, { name: nameDraft.trim() }); context.rememberSpace(updated); setEditingName(false) }, '공간 이름을 바꿨어요.')
        }}><label htmlFor="space-name-edit">공간 이름</label><input ref={nameInput} id="space-name-edit" autoFocus disabled={busy} value={nameDraft} onChange={event => setNameDraft(event.target.value)} />
          <p className="space-hint">1~30자로 입력해 주세요.</p><div className="space-actions"><button type="button" className="space-button" disabled={busy} onClick={() => setEditingName(false)}>취소</button><button type="submit" className="space-button space-button--primary" disabled={busy}>{busy ? '저장 중…' : '이름 저장'}</button></div>
        </form> : <button type="button" className="space-button" disabled={busy} onClick={() => { setNameDraft(space.name); setEditingName(true) }}>공간 이름 수정</button>}
      </section>}
      {shared && owner && <section className="space-card"><h2>공간 삭제</h2>
        <p>{space.is_default ? '앱을 시작할 때 여는 공간은 삭제할 수 없어요. 다른 공간 관리에서 시작할 공간을 바꾼 뒤 삭제해 주세요.' : '삭제하면 모든 멤버의 목록에서 사라지고 일정과 기록에 접근할 수 없어요. 데이터는 서버 보관 정책에 따라 보관됩니다.'}</p>
        <button type="button" className="space-button space-button--danger" disabled={busy || space.is_default} onClick={() => confirm('공간을 삭제할까요?', `“${space.name}” 공간을 삭제하면 함께하는 ${space.member_count}명 모두 이곳의 일정과 기록을 더 이상 열 수 없습니다. 공간은 목록에서 사라지고 데이터는 서버 보관 정책에 따라 보관됩니다.`, '공간 삭제', async () => { await deleteSpace(id); context.forgetSpace(id); navigate('/spaces', { replace: true }) })}>공간 삭제</button>
      </section>}
      {shared ? <section className="space-card"><h2>함께할 사람 초대하기</h2><p>참여 번호를 받은 사람은 기존 일정과 기록도 볼 수 있어요. 함께할 사람에게만 전달해 주세요.</p>
        <p className="space-code" aria-label={`참여 번호 ${space.join_code}`}>{space.join_code}</p>
        <div className="space-actions"><button type="button" className="space-button" disabled={busy} onClick={async () => {
          try { await navigator.clipboard.writeText(space.join_code); showSnackbar('참여 번호를 복사했어요. 함께할 사람에게 전달해 주세요.') }
          catch { showSnackbar('복사하지 못했어요. 위 참여 번호를 선택해서 복사해 주세요.') }
        }}>참여 번호 복사</button>{owner && <button type="button" className="space-text-button" disabled={busy} onClick={() => confirm('참여 번호를 새로 받을까요?', '이전 번호는 바로 사용할 수 없게 됩니다. 새 번호를 함께할 사람에게 다시 전달해 주세요.', '새 번호 받기', async () => {
          const result = await regenerateJoinCode(id)
          context.rememberSpace({ ...space, join_code: result.join_code })
        }, '새 참여 번호를 발급했어요.')}>새 번호 받기</button>}</div>
      </section> : <p className="space-hint">개인 공간에는 초대할 수 없어요. 함께 쓰려면 새 공간을 만들어 주세요.</p>}
      <section className="space-card"><h2>함께하는 사람 {space.member_count}명</h2>
        {membersQuery.isPending && <p role="status">멤버를 불러오고 있어요.</p>}
        {membersQuery.isError && <button type="button" className="space-button" onClick={() => membersQuery.refetch()}>멤버 다시 불러오기</button>}
        {!membersQuery.isError && members.map(member => <div className="space-member" key={member.user_id}><span className="space-avatar" aria-hidden="true">{member.nickname.slice(0, 1)}</span><div className="space-member__name"><strong>{member.nickname}{member.user_id === user.id ? ' (나)' : ''}</strong><span>{member.role === 'owner' ? '주인' : '멤버'}</span></div>
          {shared && owner && member.user_id !== user.id && member.role !== 'owner' && <div className="space-member__actions">
            <button type="button" disabled={busy} onClick={() => confirm('주인을 넘길까요?', `${member.nickname}님에게 소유권을 넘기면 나는 일반 멤버가 됩니다. 멤버 관리와 참여 번호 재발급 권한도 함께 넘어갑니다.`, '주인 넘기기', async () => {
              await transferOwnership(id, member.user_id)
              context.rememberSpace({ ...space, my_role: 'member' })
              queryClient.setQueryData(['space-members', user.id, id], members.map(item => ({ ...item, role: item.user_id === member.user_id ? 'owner' : 'member' })))
            }, '주인을 넘겼어요. 나는 멤버로 계속 함께할 수 있어요.')}>주인 넘기기</button>
            <button type="button" disabled={busy} className="space-danger-text" onClick={() => confirm('멤버를 내보낼까요?', `${member.nickname}님은 이 공간의 일정과 기록을 더 이상 볼 수 없습니다. 남긴 기록은 그대로 유지됩니다. 참여 번호로 다시 들어올 수 있으니 필요하면 번호도 새로 받아 주세요.`, '내보내기', async () => {
              await removeMember(id, member.user_id)
              queryClient.setQueryData(['space-members', user.id, id], members.filter(item => item.user_id !== member.user_id))
              context.rememberSpace({ ...space, member_count: space.member_count - 1 })
            }, '멤버를 내보냈어요.')}>내보내기</button>
          </div>}
        </div>)}
      </section>
      {shared && <section className="space-card"><h2>공간 나가기</h2><p>{mustTransfer ? '다른 멤버에게 주인을 넘긴 뒤 나갈 수 있어요. 위 멤버 목록에서 주인 넘기기를 선택해 주세요.' : owner ? '마지막 멤버인 내가 나가면 공간도 함께 보관되어 더 이상 열 수 없어요.' : '나가면 이곳의 일정과 기록을 볼 수 없어요. 내가 남긴 기록은 공간에 유지됩니다.'}</p>
        <button type="button" disabled={busy || mustTransfer} className="space-button space-button--danger" onClick={() => confirm('공간에서 나갈까요?', owner ? '혼자 남은 공간이 함께 보관됩니다. 이곳의 일정과 기록을 더 이상 열 수 없어요.' : '이곳의 일정과 기록에 접근할 수 없게 됩니다. 남긴 기록은 다른 멤버에게 계속 보입니다.', '나가기', async () => { await leaveSpace(id); context.forgetSpace(id); navigate('/spaces', { replace: true }) })}>공간 나가기</button>
      </section>}
    </>}
    <SpaceConfirm confirmation={confirmation} busy={busy} onClose={() => setConfirmation(null)} /><Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </SpaceFrame>
}
