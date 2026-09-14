import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text } from 'react-native';

const SYMBOLS: Record<string, SymbolViewProps['name']> = {
  home: { ios: 'house', android: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  schedules: { ios: 'list.bullet', android: 'view_list' },
  list: { ios: 'list.bullet', android: 'view_list' },
  records: { ios: 'square.and.pencil', android: 'edit_note' },
  book: { ios: 'square.and.pencil', android: 'edit_note' },
  collection: { ios: 'square.grid.2x2', android: 'grid_view' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  'more-horizontal': { ios: 'ellipsis', android: 'more_horiz' },
};

type MenuIconProps = {
  name: string;
  size?: number;
  color: string;
};

export function MenuIcon({ name, size = 24, color }: MenuIconProps) {
  return (
    <SymbolView
      name={SYMBOLS[name] ?? { ios: 'square.grid.2x2', android: 'grid_view' }}
      size={size}
      tintColor={color}
      fallback={<Text style={{ color, fontSize: size }}>•</Text>}
    />
  );
}
