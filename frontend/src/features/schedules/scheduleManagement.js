import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../shared/contexts/AuthContext'
import { getSpace } from '../../shared/api/spaces'
import { TIME_OPTIONS } from '../../shared/utils/time'
import { toServiceDateKey } from '../../shared/api/scheduleAdapter'

const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function scheduleForm(schedule) {
  return { title: schedule.title, description: schedule.description ?? '', start_date: toServiceDateKey(schedule.start_at), end_date: toServiceDateKey(schedule.end_at), start_time: timeFormatter.format(new Date(schedule.start_at)), end_time: timeFormatter.format(new Date(schedule.end_at)) }
}

export function formError(form) {
  if (!form.title.trim()) return ['하루의 이름을 입력해 주세요.', 'title']
  if (form.title.trim().length > 200) return ['하루의 이름을 200자 이내로 입력해 주세요.', 'title']
  for (const [key, label] of [['start_date', '시작일'], ['end_date', '종료일']]) {
    const parsed = new Date(form[key] + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form[key]) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== form[key]) return [label + '을 선택해 주세요.', key]
  }
  if (form.end_date < form.start_date) return ['종료일은 시작일보다 빠를 수 없어요.', 'end_date']
  if (!TIME_OPTIONS.includes(form.start_time)) return ['시작 시간을 30분 단위로 다시 선택해 주세요.', 'start_time']
  if (!TIME_OPTIONS.includes(form.end_time)) return ['종료 시간을 30분 단위로 다시 선택해 주세요.', 'end_time']
  if (form.start_date === form.end_date && form.end_time <= form.start_time) return ['종료 시간은 시작 시간보다 늦어야 해요.', 'end_time']
  return null
}

export function scheduleChanges(form, original) {
  const changes = {}
  const before = scheduleForm(original)
  if (form.title.trim() !== original.title) changes.title = form.title.trim()
  if (form.description !== before.description) changes.description = form.description.trim() || null
  if (['start_date', 'end_date', 'start_time', 'end_time'].some(key => form[key] !== before[key])) {
    changes.start_at = new Date(form.start_date + 'T' + form.start_time + ':00+09:00').toISOString()
    changes.end_at = new Date(form.end_date + 'T' + form.end_time + ':00+09:00').toISOString()
  }
  return changes
}

export function sameField(field, a, b) {
  return field.endsWith('_at') ? new Date(a).getTime() === new Date(b).getTime() : (a ?? null) === (b ?? null)
}

export function periodLabel(form) {
  const nights = (Date.parse(form.end_date + 'T00:00:00Z') - Date.parse(form.start_date + 'T00:00:00Z')) / 86400000
  return Number.isFinite(nights) && nights >= 0 ? nights === 0 ? '당일' : nights + '박 ' + (nights + 1) + '일' : ''
}

export function scheduleWhen(schedule) {
  const form = scheduleForm(schedule)
  return form.start_date + ' ' + form.start_time + ' – ' + (form.start_date === form.end_date ? '' : form.end_date + ' ') + form.end_time
}

export function useScheduleAccess(schedule) {
  const { user } = useAuth()
  const space = useQuery({
    queryKey: ['space', user?.id, schedule?.space_id],
    queryFn: () => getSpace(schedule.space_id),
    enabled: Boolean(user && schedule?.space_id),
    staleTime: 0, retry: false, refetchOnMount: 'always',
  })
  const canEdit = Boolean(user && space.data && !space.isError && space.isFetchedAfterMount)
  return { space, canEdit, canDelete: canEdit && (space.data.my_role === 'owner' || schedule.created_by?.id === user.id) }
}

export async function refreshScheduleViews(client, deleted = false) {
  const keys = ['schedules', 'diaries', 'diary', 'collection']
  if (deleted) {
    await Promise.all(keys.map(key => client.cancelQueries({ queryKey: [key] })))
    keys.forEach(key => client.removeQueries({ queryKey: [key] }))
  } else {
    await Promise.all(keys.map(key => client.invalidateQueries({ queryKey: [key] })))
  }
}

