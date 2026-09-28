import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TimeSelect } from '@/features/schedules/time-select';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { formatPlannedTime, toApiTime, toTimeOption } from '@/shared/utils/date';

// 서버 상한과 같은 값이다 (app/places/schemas.py MAX_MEMO_LENGTH). 여기서 먼저 막아야
// 다 쓰고 나서 422를 받는 일이 없다.
const MAX_MEMO_LENGTH = 500;

/**
 * 장소 하나에 붙는 예정시각·메모.
 *
 * @param placeName 장소 이름. 보조 기술이 읽을 문구에 쓴다
 * @param plannedTime 서버 형식 `HH:MM:SS`
 * @param memo
 * @param editable 고칠 수 있는지. 끝난 하루에서는 보여주기만 한다
 * @param busy 저장 중인지
 * @param onSave 바뀐 값을 넘긴다. 하루 만들기 화면에서는 서버가 아니라 임시 목록에 담긴다
 *
 * **장소 이름 아래에 둔다.** 행 오른쪽 버튼 줄(순서·빼기)에 하나를 더 붙이면 좁은
 * 화면에서 넷이 겹친다. 값이 보이는 자리를 그대로 누르게 해서 "여기를 고친다"가
 * 위치로 읽히게 했다. 웹의 PlaceNoteEditor.jsx와 같은 규칙이다.
 */
export function PlaceNoteEditor({
  placeName,
  plannedTime,
  memo,
  editable,
  busy = false,
  onSave,
}: {
  placeName: string;
  plannedTime: string | null;
  memo: string | null;
  editable: boolean;
  busy?: boolean;
  onSave: (note: { plannedTime: string | null; memo: string | null }) => Promise<unknown> | void;
}) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const summary = [plannedTime ? formatPlannedTime(plannedTime) : '', memo ?? '']
    .filter(Boolean)
    .join(' · ');

  // 열 때마다 서버 값에서 다시 시작한다. 저장 후 부모가 새 값을 내려줘도 입력 상태는
  // 따라오지 않기 때문에, 여는 순간을 맞추는 지점으로 삼는다.
  const start = () => {
    setTime(toTimeOption(plannedTime));
    setText(memo ?? '');
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setError(null);
    try {
      await onSave({ plannedTime: toApiTime(time), memo: text.trim() || null });
      setOpen(false);
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  };

  if (!editable) {
    return summary ? <Text style={styles.text}>{summary}</Text> : null;
  }

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${placeName} 예정시각·메모 ${summary ? '고치기' : '넣기'}`}
        onPress={start}
        style={[styles.trigger, !summary && styles.triggerEmpty]}
      >
        <Text style={[styles.triggerText, !summary && styles.triggerTextEmpty]}>
          {summary || '시각·메모 넣기'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>예정시각</Text>
      <TimeSelect value={time} onChange={setTime} clearable />

      <Text style={styles.label}>메모</Text>
      <TextInput
        accessibilityLabel={`${placeName} 메모`}
        multiline
        maxLength={MAX_MEMO_LENGTH}
        onChangeText={setText}
        placeholder="예약 필요, 2층 안쪽처럼 기억할 것을 적어두세요"
        placeholderTextColor={colors.muted}
        style={styles.memoInput}
        textAlignVertical="top"
        value={text}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable onPress={() => setOpen(false)} style={[styles.button, styles.cancel]}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={save}
          style={({ pressed }) => [styles.button, styles.confirm, pressed && styles.pressed]}
        >
          <Text style={styles.confirmText}>{busy ? '저장 중…' : '저장'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  // 값이 있을 때는 글처럼, 없을 때는 "적을 수 있다"는 빈 칸처럼 보인다.
  trigger: { backgroundColor: colors.background, borderRadius: 8, marginTop: 6, paddingHorizontal: 9, paddingVertical: 5 },
  triggerEmpty: { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed', borderWidth: 1 },
  triggerText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  triggerTextEmpty: { color: colors.border },
  text: { backgroundColor: colors.background, borderRadius: 8, color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6, paddingHorizontal: 9, paddingVertical: 5 },

  panel: { backgroundColor: colors.background, borderRadius: 12, gap: spacing.xs, marginTop: 8, padding: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  memoInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 13, lineHeight: 20, minHeight: 64, paddingHorizontal: 10, paddingVertical: 8 },
  error: { color: colors.danger, fontSize: 12 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  button: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 10 },
  cancel: { backgroundColor: colors.surface },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  confirm: { backgroundColor: palette.primary },
  confirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
