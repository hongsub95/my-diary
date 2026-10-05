import { StyleSheet, Text, View } from 'react-native';
import { SelectPopover } from '@/shared/components/select-popover';
import { colors } from '@/shared/theme';
import type { Choice } from './recommendation-api';

export function ChoiceField({ label, value, choices, disabled, onChange }: {
  label: string; value: string; choices: Choice[]; disabled: boolean; onChange: (value: string) => void;
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <SelectPopover value={value} options={choices.map(choice => ({ value: choice.code, label: choice.label }))}
      accessibilityLabel={label} disabled={disabled} onChange={onChange} />
  </View>;
}
const styles = StyleSheet.create({
  field: { flex: 1, gap: 8 }, label: { color: colors.muted, fontSize: 12 },
});
