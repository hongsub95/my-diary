import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';

import { useSpaces } from '@/features/spaces/space-context';
import { SpaceButton, SpaceFrame, createSpaceStyles } from '@/features/spaces/space-ui';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { useThemedStyles } from '@/shared/theme-context';

export default function SpacesScreen() {
  const { spaces, spacesQuery, currentSpaceId, selectSpace } = useSpaces();
  const { refetch } = spacesQuery;
  const { from } = useLocalSearchParams<{ from?: string }>();
  const router = useRouter();
  const s = useThemedStyles(createSpaceStyles);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  useEffect(() => { if (spacesQuery.error) showSnackbar('공간을 불러오지 못했어요. 다시 불러오기를 눌러 주세요.'); }, [spacesQuery.error, showSnackbar]);
  return <SpaceFrame title="내 공간" back={from === 'home' ? '/(tabs)/home' : '/(tabs)/more'} overlay={<Snackbar notice={notice} onDismiss={dismissSnackbar} />}>
    <View style={s.intro}><Text style={s.eyebrow}>함께 계획하고, 함께 기억하기</Text><Text style={s.title}>우리의 하루가{ '\n' }쌓이는 곳</Text><Text style={s.text}>나만의 기록도, 둘만의 약속도, 친구들과의 여행도. 함께할 사람마다 새로운 공간을 만들어 보세요.</Text></View>
    <View style={{ gap: 10 }}><SpaceButton kind="primary" onPress={() => router.push('/spaces/new')}>＋ 새 공간 만들기</SpaceButton><SpaceButton onPress={() => router.push('/spaces/join')}>참여 번호로 들어가기</SpaceButton></View>
    <View style={{ gap: 8 }}><Text style={s.heading}>내 공간 {spaces.length}</Text><Text style={s.hint}>전환은 지금 보는 공간만 바꿔요. 처음 열 공간은 상세에서 따로 지정할 수 있어요.</Text></View>
    {spacesQuery.isPending && <Text style={s.text}>공간을 불러오고 있어요.</Text>}
    {spacesQuery.isError && <SpaceButton onPress={() => { void refetch(); }}>다시 불러오기</SpaceButton>}
    {!spacesQuery.isPending && !spacesQuery.isError && !spaces.length && <Text style={s.text}>아직 참여한 공간이 없어요. 만들거나 참여해 주세요.</Text>}
    {spaces.map(space => <View key={space.id} style={[s.card, currentSpaceId === space.id && s.currentCard]}>
      <View style={s.row}><View style={s.symbol}><Text style={s.symbolText}>{space.type === 'personal' ? '✎' : space.icon === 'friends' ? '♧' : '♡'}</Text></View><View style={s.grow}><Text style={s.name}>{space.name}</Text><Text style={s.hint}>{space.type === 'personal' ? '나만의 공간' : `함께 ${space.member_count}명 · ${space.my_role === 'owner' ? '주인' : '멤버'}`}</Text></View></View>
      {(currentSpaceId === space.id || space.is_default) && <View style={s.tags}>{currentSpaceId === space.id && <Text style={s.tag}>지금 보는 공간</Text>}{space.is_default && <Text style={s.tag}>처음 열 공간</Text>}</View>}
      <SpaceButton onPress={() => { if (selectSpace(space.id)) router.replace('/(tabs)/home'); }}>{currentSpaceId === space.id ? '하루 보러 가기' : '이 공간으로 바꾸기'}</SpaceButton>
      <SpaceButton onPress={() => router.push({ pathname: '/spaces/[id]', params: { id: space.id } })}>상세 · 관리 ›</SpaceButton>
    </View>)}
  </SpaceFrame>;
}
