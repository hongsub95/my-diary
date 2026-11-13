import type { RefObject } from 'react';
import type { View } from 'react-native';
import { DatePickerPopover } from '@/shared/components/date-picker-popover';

/** Shared start/end selection stays attached to the schedule's date field. */
export function ScheduleRangeSheet({ visible, anchorRef, start, end, onApply, onClose }: {
  visible: boolean; anchorRef: RefObject<View | null>; start: string; end: string;
  onApply: (range: { start: string; end: string }) => void; onClose: () => void;
}) {
  return <DatePickerPopover visible={visible} anchorRef={anchorRef} value={start}
    range={{ start, end }} onChange={() => {}} onRangeApply={onApply} onClose={onClose} />;
}
