import { RangeSheet } from '@/shared/components/date-sheets/range-sheet';
import { formatRangeFull, periodBetween } from './schedule-dates';

/**
 * 하루의 시작·끝 날짜 고르기. 하루 만들기 1단계와 일정 고치기가 함께 쓴다.
 *
 * 아래에서 올라오는 기간 시트다(시안 B). 시작만 고르고 적용하면 하루짜리가 된다.
 * 박수(당일·1박 2일)는 날짜 칸에는 두지 않고 시트 위쪽 요약에서 고르는 동안 보여준다
 * (2026-10-15 사용자 결정).
 */
export function ScheduleRangeSheet({ visible, start, end, onApply, onClose }: {
  visible: boolean; start: string; end: string;
  onApply: (range: { start: string; end: string }) => void; onClose: () => void;
}) {
  return <RangeSheet visible={visible} start={start} end={end} onApply={onApply} onClose={onClose}
    describe={range => `${formatRangeFull(range.start, range.end)} · ${periodBetween(range.start, range.end)}`} />;
}
