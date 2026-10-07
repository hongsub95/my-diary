import { SelectPopover } from '@/shared/components/select-popover';
export { SelectButton } from '@/shared/components/select-popover';

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  return `${hours}:${index % 2 === 0 ? '00' : '30'}`;
});

/** 시각과 추천 조건은 같은 칸에 붙는 팝오버를 사용한다. 기존 분 단위 값도 보존한다. */
export function TimeSelect({ value, onChange, clearable = false, placeholder = '시각 없음', disabled = false, accessibilityLabel }: {
  value: string; onChange: (value: string) => void; clearable?: boolean; placeholder?: string; disabled?: boolean; accessibilityLabel?: string;
}) {
  const times = !value || TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [value, ...TIME_OPTIONS];
  const options = times.map(time => ({ value: time, label: time, muted: false }));
  if (clearable) options.unshift({ value: '', label: placeholder, muted: true });
  return <SelectPopover value={value} options={options} placeholder={placeholder} onChange={onChange} disabled={disabled} accessibilityLabel={accessibilityLabel} />;
}
