import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import { getSpace } from '@/features/spaces/space-api';
import type { Schedule } from '@/shared/api/types';
import { seoulDateKey } from '@/shared/utils/date';
import { TIME_OPTIONS } from './time-select';
import type { UpdateScheduleInput } from './schedule-api';

export type ScheduleForm = { title: string; description: string; start_date: string; end_date: string; start_time: string; end_time: string };
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function scheduleForm(schedule: Pick<Schedule, 'title' | 'description' | 'start_at' | 'end_at'>): ScheduleForm {
  return { title: schedule.title, description: schedule.description ?? '', start_date: seoulDateKey(schedule.start_at), end_date: seoulDateKey(schedule.end_at), start_time: timeFormat.format(new Date(schedule.start_at)), end_time: timeFormat.format(new Date(schedule.end_at)) };
}

export function formError(form: ScheduleForm): string | null {
  if (!form.title.trim()) return '하루의 이름을 입력해 주세요.';
  if (form.title.trim().length > 200) return '하루의 이름을 200자 이내로 입력해 주세요.';
  for (const [value, label] of [[form.start_date, '시작일'], [form.end_date, '종료일']]) {
    const date = new Date(value + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return label + '을 선택해 주세요.';
  }
  if (form.end_date < form.start_date) return '종료일은 시작일보다 빠를 수 없어요.';
  if (!TIME_OPTIONS.includes(form.start_time)) return '시작 시간을 30분 단위로 다시 선택해 주세요.';
  if (!TIME_OPTIONS.includes(form.end_time)) return '종료 시간을 30분 단위로 다시 선택해 주세요.';
  if (form.start_date === form.end_date && form.end_time <= form.start_time) return '종료 시간은 시작 시간보다 늦어야 해요.';
  return null;
}

export function scheduleChanges(form: ScheduleForm, original: Schedule): UpdateScheduleInput {
  const changes: UpdateScheduleInput = {};
  const before = scheduleForm(original);
  if (form.title.trim() !== original.title) changes.title = form.title.trim();
  if (form.description !== before.description) changes.description = form.description.trim() || null;
  if ((['start_date', 'end_date', 'start_time', 'end_time'] as const).some(key => form[key] !== before[key])) {
    changes.start_at = new Date(form.start_date + 'T' + form.start_time + ':00+09:00').toISOString();
    changes.end_at = new Date(form.end_date + 'T' + form.end_time + ':00+09:00').toISOString();
  }
  return changes;
}

export function sameField(field: keyof UpdateScheduleInput, a: unknown, b: unknown) {
  return field.endsWith('_at') ? new Date(String(a)).getTime() === new Date(String(b)).getTime() : (a ?? null) === (b ?? null);
}
export function periodLabel(form: ScheduleForm) {
  const nights = (Date.parse(form.end_date + 'T00:00:00Z') - Date.parse(form.start_date + 'T00:00:00Z')) / 86400000;
  return Number.isFinite(nights) && nights >= 0 ? nights === 0 ? '당일' : nights + '박 ' + (nights + 1) + '일' : '';
}
export function scheduleWhen(schedule: Pick<Schedule, 'title' | 'description' | 'start_at' | 'end_at'>) {
  const form = scheduleForm(schedule);
  return form.start_date + ' ' + form.start_time + ' – ' + (form.start_date === form.end_date ? '' : form.end_date + ' ') + form.end_time;
}
export function errorStatus(error: unknown) { return isAxiosError(error) ? error.response?.status : undefined; }

export function useScheduleAccess(schedule?: Pick<Schedule, 'space_id' | 'created_by'>) {
  const { user } = useAuth();
  const space = useQuery({
    queryKey: ['space', user?.id, schedule?.space_id], queryFn: () => getSpace(schedule!.space_id),
    enabled: Boolean(user && schedule?.space_id), staleTime: 0, retry: false, refetchOnMount: 'always',
  });
  const canEdit = Boolean(user && space.data && !space.isError && space.isFetchedAfterMount);
  return { space, canEdit, canDelete: canEdit && (space.data?.my_role === 'owner' || schedule?.created_by?.id === user?.id) };
}
