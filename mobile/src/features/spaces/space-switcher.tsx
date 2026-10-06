import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useSpaces } from './space-context';
import { createSpaceStyles } from './space-ui';
import { useThemedStyles } from '@/shared/theme-context';

export function SpaceSwitcher() {
  const { currentSpace } = useSpaces();
  const router = useRouter();
  const s = useThemedStyles(createSpaceStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={`공간 바꾸기, 현재 ${currentSpace?.name ?? '공간'}`} onPress={() => router.push({ pathname: '/spaces', params: { from: 'home' } })} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
    <View style={s.row}><Text style={s.accentText}>{currentSpace?.type === 'shared' ? '♡' : '✎'}</Text><Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{currentSpace?.name ?? '공간 선택'}</Text><Text style={s.hint}>공간 바꾸기 ›</Text></View>
  </Pressable>;
}
