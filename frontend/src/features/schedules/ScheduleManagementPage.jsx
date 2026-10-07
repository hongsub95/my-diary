import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../shared/contexts/AuthContext'
import { deleteSchedule, getSchedule, updateSchedule } from '../../shared/api/schedules'
import { listDiaryTimeline } from '../../shared/api/diaries'
import { toServiceDateKey } from '../../shared/api/scheduleAdapter'
import { getApiErrorMessage } from '../../shared/api/apiError'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import { TIME_OPTIONS } from '../../shared/utils/time'
import { SpaceConfirm } from '../spaces/SpaceUI'
import { formError, periodLabel, refreshScheduleViews, sameField, scheduleChanges, scheduleForm, scheduleWhen, useScheduleAccess } from './scheduleManagement'
import './schedules.css'
import './schedule-management.css'

export default function ScheduleManagementPage({ mode }) {
  const { id } = useParams()
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['schedules', 'manage', user?.id, id], queryFn: () => getSchedule(id),
    enabled: Boolean(user && /^\d+$/.test(id)), staleTime: 0, retry: false, refetchOnMount: 'always',
  })
  const access = useScheduleAccess(query.data)
  const navigate = useNavigate()
  const heading = mode === 'edit' ? '일정 고치기' : '일정 지우기'
  const blocked = query.error?.response?.status === 404 || access.space.error?.response?.status === 404
  if (!/^\d+$/.test(id) || Number(id) < 1) return <main className="schedule-manage-loading"><h1>{heading}</h1><p>일정을 찾을 수 없어요.</p><button className="space-button" onClick={() => navigate('/schedules', { replace: true })}>일정 목록으로</button></main>
  if (query.isPending || (query.isFetching && !query.isFetchedAfterMount) || (query.data && access.space.isPending)) {
    return <main className="schedule-manage-loading" role="status">일정을 불러오고 있어요.</main>
  }
  if (query.isError || access.space.isError || !query.data || !access.canEdit) {
    return <main className="schedule-manage-loading"><h1>{heading}</h1><p>{blocked ? '일정을 찾을 수 없거나 접근할 수 없어요.' : '일정을 불러오지 못했어요.'}</p>
      {!blocked && <button className="space-button" onClick={() => { query.refetch(); access.space.refetch() }}>다시 불러오기</button>}
      <button className="space-button" onClick={() => navigate('/schedules', { replace: true })}>일정 목록으로</button></main>
  }
  return <ManagementForm key={user.id + ':' + id + ':' + mode} schedule={query.data} access={access} mode={mode} />
}

function ManagementForm({ schedule, access, mode }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [original, setOriginal] = useState(schedule)
  const [form, setForm] = useState(() => scheduleForm(schedule))
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [conflict, setConflict] = useState(null)
  const lock = useRef(false)
  const alive = useRef(true)
  const saved = useRef(false)
  const formElement = useRef(null)
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const isEdit = mode === 'edit'
  const dirty = JSON.stringify(form) !== JSON.stringify(scheduleForm(original))
  const blocker = useBlocker(() => !saved.current && (busy || (isEdit && dirty)))
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const protect = event => {
      if (!saved.current && (busy || (isEdit && dirty))) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [busy, dirty, isEdit])
  useEffect(() => {
    if (blocker.state === 'blocked' && busy) blocker.reset()
  }, [blocker, busy])

  function leave(path, message) {
    saved.current = true
    setLeaving(true)
    navigate(path, { replace: true, state: message ? { notice: message } : null })
  }

  async function save(event) {
    event.preventDefault()
    if (lock.current || leaving) return
    const invalid = formError(form)
    if (invalid) {
      showSnackbar(invalid[0])
      formElement.current?.elements.namedItem(invalid[1])?.focus()
      return
    }
    const changes = scheduleChanges(form, original)
    if (!Object.keys(changes).length) { leave('/schedules/' + schedule.id); return }
    lock.current = true
    setBusy(true)
    dismissSnackbar()
    try {
      const latest = await getSchedule(schedule.id)
      if (!alive.current) return
      if (Object.keys(changes).some(field => !sameField(field, latest[field], original[field]))) {
        setConflict(latest)
        return
      }
      if (changes.start_at || changes.end_at) {
        const timeline = await listDiaryTimeline(schedule.id)
        if (!alive.current) return
        if (timeline.some(item => {
          const date = toServiceDateKey(item.occurred_at)
          return date < form.start_date || date > form.end_date
        })) {
          showSnackbar('범위 밖에 남긴 기록이 있어요. 타임라인 날짜를 고치거나 일정 기간을 다시 선택해 주세요.')
          return
        }
      }
      let updated
      try { updated = await updateSchedule(schedule.id, changes) }
      catch (caught) {
        if (!caught.response || caught.response.status >= 500) {
          const check = await getSchedule(schedule.id).catch(() => null)
          if (check && Object.keys(changes).every(field => sameField(field, check[field], changes[field]))) updated = check
        }
        if (!updated) throw caught
      }
      if (!alive.current) return
      await refreshScheduleViews(client)
      if (alive.current) leave('/schedules/' + schedule.id, '일정을 고쳤어요.')
    } catch (caught) {
      if (!alive.current) return
      if (caught.response?.status === 404) {
        await refreshScheduleViews(client, true)
        leave('/schedules', '일정을 찾을 수 없거나 접근할 수 없어요. 목록을 확인해 주세요.')
      } else {
        showSnackbar(getApiErrorMessage(caught))
        const field = caught.response?.data?.field
        const target = field === 'start_at' ? 'start_date' : field === 'end_at' ? 'end_date' : field
        formElement.current?.elements.namedItem(target)?.focus()
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function remove() {
    if (lock.current || !access.canDelete || leaving) return
    lock.current = true
    setBusy(true)
    dismissSnackbar()
    try {
      await deleteSchedule(schedule.id)
      if (!alive.current) return
      await refreshScheduleViews(client, true)
      if (alive.current) leave('/schedules', '일정을 지웠어요.')
    } catch (caught) {
      if (!alive.current) return
      if (caught.response?.status === 403) {
        await access.space.refetch()
        showSnackbar('일정 작성자나 공간 소유자만 지울 수 있어요.')
      } else if (caught.response?.status === 404) {
        await refreshScheduleViews(client, true)
        leave('/schedules', '일정을 찾을 수 없거나 접근할 수 없어요. 목록을 확인해 주세요.')
      } else if (!caught.response || caught.response.status >= 500) {
        try { await getSchedule(schedule.id); showSnackbar('지우지 못했어요. 연결을 확인하고 다시 시도해 주세요.') }
        catch (check) {
          if (check.response?.status === 404) {
            await refreshScheduleViews(client, true)
            leave('/schedules', '일정을 찾을 수 없거나 접근할 수 없어요. 목록을 확인해 주세요.')
          } else showSnackbar('삭제 결과를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
        }
      } else showSnackbar(getApiErrorMessage(caught))
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }

  const set = (key, value) => setForm(before => ({ ...before, [key]: value }))
  const discard = blocker.state === 'blocked' && !busy ? {
    title: '변경 내용을 저장하지 않고 나갈까요?', message: '고친 내용은 저장되지 않아요.',
    label: '저장하지 않고 나가기', onConfirm: () => blocker.proceed(),
    cancelLabel: '계속 고치기',
  } : null
  const conflictConfirmation = conflict ? {
    title: '다른 사람이 일정을 고쳤어요.', message: '최신 내용을 불러오면 입력 중인 내용이 바뀌어요. 취소하면 내 입력을 유지하고 다시 저장할 수 있어요.',
    cancelLabel: '내 입력 유지',
    label: '최신 내용 불러오기', onConfirm: () => { setOriginal(conflict); setForm(scheduleForm(conflict)); setConflict(null) },
  } : null
  return <main className="snew-page schedule-manage">
    <header className="schedule-manage-header">
      <button type="button" disabled={busy || leaving} aria-label="뒤로 가기" onClick={() => navigate('/schedules/' + schedule.id, { replace: true })}>‹</button>
      <h1>{isEdit ? '일정 고치기' : '일정 지우기'}</h1><span />
    </header>
    {isEdit ? <form id="schedule-edit-form" ref={formElement} onSubmit={save} noValidate className="snew-form">
      <div className="schedule-manage-intro"><span className="snew-form__eyebrow">EDIT YOUR DAY</span><h2>계획이 바뀌었나요?</h2><p>저장해 둔 하루의 정보를 고쳐주세요.</p></div>
      <div className="schedule-manage-space"><span>저장된 공간</span><strong>{schedule.space_name}</strong>
        {access.space.data?.type === 'shared' && <p>함께 쓰는 공간의 일정은 변경 내용이 모두에게 보여요.</p>}</div>
      <fieldset disabled={busy || leaving} className="schedule-manage-fields">
        <div className="snew-form__field"><label className="snew-form__label" htmlFor="edit-title">하루의 이름 *</label>
          <input id="edit-title" name="title" required className="snew-form__input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
        <div className="snew-timing-card">{['start', 'end'].map(edge => <div key={edge} className={'snew-timing-row snew-timing-row--' + edge}>
          <div className="snew-form__field"><label className="snew-form__label" htmlFor={'edit-' + edge + '-date'}>{edge === 'start' ? '시작일' : '종료일'} *</label>
            <input id={'edit-' + edge + '-date'} name={edge + '_date'} type="date" required className="snew-form__input" value={form[edge + '_date']} onChange={e => set(edge + '_date', e.target.value)} /></div>
          <div className="snew-form__field snew-timing-row__time"><label className="snew-form__label" htmlFor={'edit-' + edge + '-time'}>{edge === 'start' ? '시작 시간' : '종료 시간'} *</label>
            <select id={'edit-' + edge + '-time'} name={edge + '_time'} className="snew-form__input" value={form[edge + '_time']} onChange={e => set(edge + '_time', e.target.value)}>
              {!TIME_OPTIONS.includes(form[edge + '_time']) && <option value={form[edge + '_time']} disabled>{form[edge + '_time']} (기존)</option>}
              {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
            </select></div>
        </div>)}</div>
        <p className="schedule-manage-period">{periodLabel(form)}</p>
        <div className="snew-form__field"><label className="snew-form__label" htmlFor="edit-description">메모</label>
          <textarea id="edit-description" name="description" className="snew-form__input snew-form__textarea" rows={4} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      </fieldset>
      <p className="schedule-manage-hint">담아 둔 장소와 사진·글·타임라인은 그대로 남아요.</p>
    </form> : <div className="snew-form">
      <div className="schedule-manage-intro"><span className="snew-form__eyebrow">DELETE YOUR DAY</span><h2>이 일정을 지울까요?</h2><p>지우기 전에 어떤 하루인지 확인해 주세요.</p></div>
      <section className="schedule-delete-summary"><span>{schedule.space_name}</span><h2>{schedule.title}</h2><p>{scheduleWhen(schedule)}</p>
        <div className="schedule-delete-counts"><span>장소 {schedule.place_count}곳</span><span>사진 {schedule.record_summary.photo_count}장</span><span>글 {schedule.record_summary.has_diary_text ? '있음' : '없음'}</span><span>타임라인 {schedule.record_summary.timeline_count}개</span></div></section>
      <div className="schedule-delete-explanation"><h3>연결된 기록도 함께 지워져요</h3><p>이 일정과 연결된 장소·사진·글·타임라인이 함께 지워져요. 앱에서 되돌릴 수 없어요.</p>
        {access.space.data?.type === 'shared' && <p>함께 남긴 다른 사람의 기록도 지워지고, 모든 멤버의 화면에서 사라져요.</p>}</div>
      {!access.canDelete && <p className="schedule-manage-hint">일정 작성자나 공간 소유자만 지울 수 있어요.</p>}
    </div>}
    <footer className="schedule-manage-footer">{isEdit ? <button form="schedule-edit-form" className="snew-form__submit" type="submit" disabled={busy || !dirty || leaving}>{busy ? '저장 중…' : '저장하기'}</button> :
      <div className="schedule-manage-actions"><button type="button" className="space-button" disabled={busy || leaving} onClick={() => navigate('/schedules/' + schedule.id, { replace: true })}>돌아가기</button>
        {access.canDelete && <button type="button" className="schedule-delete-button" disabled={busy || leaving} onClick={remove}>{busy ? '지우는 중…' : '일정 지우기'}</button>}</div>}
    </footer>
    <SpaceConfirm confirmation={discard ?? conflictConfirmation} busy={busy} onClose={() => {
      if (discard) blocker.reset()
      else {
        const before = scheduleForm(original)
        const latest = scheduleForm(conflict)
        setForm(draft => ({ ...latest, ...Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== before[key])) }))
        setOriginal(conflict)
        setConflict(null)
      }
    }} />
    <Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </main>
}
