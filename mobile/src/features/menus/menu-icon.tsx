import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, View } from 'react-native';

// Keep the same meaning for navigation icons on every screen and platform.
const SYMBOLS: Record<string, SymbolViewProps['name']> = {
  home: { ios: 'house', android: 'home', web: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  schedules: { ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' },
  list: { ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' },
  records: { ios: 'note.text', android: 'edit_note', web: 'edit_note' },
  book: { ios: 'note.text', android: 'edit_note', web: 'edit_note' },
  collection: { ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  'more-horizontal': { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  smile: { ios: 'face.smiling', android: 'sentiment_satisfied', web: 'sentiment_satisfied' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  space: { ios: 'house', android: 'home', web: 'home' },
  password: { ios: 'lock', android: 'lock', web: 'lock' },
  notifications: { ios: 'bell', android: 'notifications_none', web: 'notifications_none' },
  theme: { ios: 'paintpalette', android: 'palette', web: 'palette' },
  privacy: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  terms: { ios: 'doc.text', android: 'description', web: 'description' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  'chevron-right': { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
};

type MenuIconProps = {
  name: string;
  size?: number;
  color: string;
};

export function MenuIcon({ name, size = 24, color }: MenuIconProps) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ height: size, width: size }}>
      <SymbolView
        name={SYMBOLS[name] ?? { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' }}
        size={size}
        tintColor={color}
        fallback={<Text style={{ color, fontSize: size }}>•</Text>}
      />
    </View>
  );
}
