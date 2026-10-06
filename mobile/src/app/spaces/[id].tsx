import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { deleteSpace, getSpace, leaveSpace, listMembers, regenerateJoinCode, removeMember, transferOwnership, updateSpace, type SpaceMember } from '@/features/spaces/space-api';
import { useSpaces } from '@/features/spaces/space-context';
import { spaceInputError, spacePermissions } from '@/features/spaces/space-model';
import { createSpaceStyles, SpaceButton, SpaceFrame } from '@/features/spaces/space-ui';
import { getApiError } from '@/shared/api/api-error';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { useThemedStyles } from '@/shared/theme-context';

type Confirmation = { title: string; message: string; label: string; action: () => Promise<unknown>; success?: string };

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const context = useSpaces();
  const queryClient = useQueryClient();
  const router = useRouter();
  const s = useThemedStyles(createSpaceStyles);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInput = useRef<TextInput>(null);
  const lock = useRef(false);
  const spaceQuery = useQuery({ queryKey: ['space', user?.id, id], queryFn: () => getSpace(id), enabled: Boolean(id), staleTime: 0 });
  const membersQuery = useQuery({ queryKey: ['space-members', user?.id, id], queryFn: () => listMembers(id), enabled: Boolean(spaceQuery.data) && !spaceQuery.isError, staleTime: 0 });
  const { refetch } = spaceQuery;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const space = spaceQuery.data;
  const members = membersQuery.data ?? [];
  const { shared, owner, mustTransfer } = spacePermissions(space);
  useEffect(() => {
    if (spaceQuery.error || membersQuery.error) showSnackbar('공간 정보를 불러오지 못했어요. 다시 불러오기를 눌러 주세요.');
  }, [spaceQuery.error, membersQuery.error, showSnackbar]);

  async function run(action: () => Promise<unknown>, success?: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      await action();
      setConfirmation(null);
      if (success) showSnackbar(success);
      for (const key of ['spaces', 'space', 'space-members']) void queryClient.invalidateQueries({ queryKey: [key, user?.id] });
    } catch (error) {
      showSnackbar(getApiError(error).message);
      for (const key of ['spaces', 'space', 'space-members']) void queryClient.invalidateQueries({ queryKey: [key, user?.id] });
    } finally { lock.current = false; setBusy(false); }
  }
  function saveName() {
    const invalid = spaceInputError(nameDraft, false);
    if (invalid) { nameInput.current?.focus(); showSnackbar(invalid); return; }
    void run(async () => {
      const updated = await updateSpace(id, { name: nameDraft.trim() });
      context.rememberSpace(updated);
      setEditingName(false);
    }, '공간 이름을 바꿨어요.');
  }
  const modal = <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmation(null); }}>
    <SafeAreaView style={s.scrim}>
      <View style={s.dialog} accessibilityViewIsModal>
        <ScrollView><Text accessibilityRole="header" style={s.heading}>{confirmation?.title}</Text><Text style={[s.text, { marginTop: 12 }]}>{confirmation?.message}</Text></ScrollView>
        <SpaceButton disabled={busy} onPress={() => setConfirmation(null)}>취소</SpaceButton>
        <SpaceButton disabled={busy} kind="danger" onPress={() => { if (confirmation) void run(confirmation.action, confirmation.success); }}>{busy ? '처리 중…' : confirmation?.label}</SpaceButton>
      </View>
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </SafeAreaView>
  </Modal>;

  return <SpaceFrame title="공간 관리" overlay={<>{modal}{!confirmation && <Snackbar notice={notice} onDismiss={dismissSnackbar} />}</>}>
    {spaceQuery.isPending && <Text style={s.text}>공간을 불러오고 있어요.</Text>}
    {spaceQuery.isError && <View style={s.card}><Text style={s.text}>공간을 열 수 없어요. 참여 상태를 확인해 주세요.</Text><SpaceButton onPress={() => { void spaceQuery.refetch(); }}>다시 불러오기</SpaceButton><SpaceButton onPress={() => router.replace('/spaces')}>내 공간으로 돌아가기</SpaceButton></View>}
    {space && !spaceQuery.isError && <>
      <View style={s.card}><View style={s.row}><View style={s.symbol}><Text style={s.symbolText}>{shared ? space.icon === 'friends' ? '♧' : '♡' : '✎'}</Text></View><View style={s.grow}><Text style={s.heading}>{space.name}</Text><Text style={s.hint}>{shared ? `함께 ${space.member_count}명 · ${owner ? '주인' : '멤버'}` : '나만 볼 수 있는 개인 공간'}</Text></View></View>
        <SpaceButton disabled={busy} kind="primary" onPress={() => { if (context.selectSpace(space)) router.replace('/(tabs)/home'); }}>이 공간의 하루 보기</SpaceButton>
        <SpaceButton disabled={busy || space.is_default} onPress={() => { void run(() => context.saveDefault(id), '앱을 시작할 때 이 공간을 열어요.'); }}>{space.is_default ? '처음 열 공간으로 지정됨' : '앱을 시작할 때 이 공간 열기'}</SpaceButton>
      </View>
      {owner && <View style={s.card}><Text style={s.heading}>공간 이름</Text>
        {!shared && <Text style={s.hint}>개인 공간은 삭제할 수 없어요. 이름은 자유롭게 바꿀 수 있어요.</Text>}
        {!shared && <Text style={s.hint}>개인 공간은 삭제할 수 없어요. 이름은 자유롭게 바꿀 수 있어요.</Text>}
        {editingName ? <><Text style={s.label}>공간 이름</Text><TextInput ref={nameInput} autoFocus accessibilityLabel="공간 이름" editable={!busy} value={nameDraft} onChangeText={setNameDraft} style={s.input} returnKeyType="done" onSubmitEditing={saveName} /><Text style={s.hint}>1~30자로 입력해 주세요.</Text>
          <SpaceButton disabled={busy} onPress={() => setEditingName(false)}>취소</SpaceButton><SpaceButton disabled={busy} kind="primary" onPress={saveName}>{busy ? '저장 중…' : '이름 저장'}</SpaceButton>
        </> : <SpaceButton disabled={busy} onPress={() => { setNameDraft(space.name); setEditingName(true); }}>공간 이름 수정</SpaceButton>}
      </View>}
      {shared && owner && <View style={s.card}><Text style={s.heading}>공간 삭제</Text>
        <Text style={s.text}>{space.is_default ? '앱을 시작할 때 여는 공간은 삭제할 수 없어요. 다른 공간 관리에서 시작할 공간을 바꾼 뒤 삭제해 주세요.' : '삭제하면 모든 멤버의 목록에서 사라지고 일정과 기록에 접근할 수 없어요. 데이터는 서버 보관 정책에 따라 보관됩니다.'}</Text>
        <SpaceButton kind="danger" disabled={busy || space.is_default} onPress={() => setConfirmation({ title: '공간을 삭제할까요?', message: `“${space.name}” 공간을 삭제하면 함께하는 ${space.member_count}명 모두 이곳의 일정과 기록을 더 이상 열 수 없습니다. 공간은 목록에서 사라지고 데이터는 서버 보관 정책에 따라 보관됩니다.`, label: '공간 삭제', action: async () => { await deleteSpace(id); context.forgetSpace(id); router.replace('/spaces'); } })}>공간 삭제</SpaceButton>
      </View>}
      {shared ? <View style={s.card}><Text style={s.heading}>함께할 사람 초대하기</Text><Text style={s.text}>참여 번호를 받은 사람은 기존 일정과 기록도 볼 수 있어요. 함께할 사람에게만 전달해 주세요.</Text><Text selectable accessibilityLabel={`참여 번호 ${space.join_code}`} style={s.code}>{space.join_code}</Text>
        <SpaceButton disabled={busy} onPress={() => { void Share.share({ message: `${space.name} 공간에서 함께 하루를 계획해요. 나의 일기(내일)에서 참여 번호 ${space.join_code}를 입력해 주세요.` }).catch(() => showSnackbar('공유하지 못했어요. 위 참여 번호를 길게 눌러 복사해 주세요.')); }}>참여 번호 공유하기</SpaceButton>
        {owner && <SpaceButton disabled={busy} onPress={() => setConfirmation({ title: '참여 번호를 새로 받을까요?', message: '이전 번호는 바로 사용할 수 없게 됩니다. 새 번호를 함께할 사람에게 다시 전달해 주세요.', label: '새 번호 받기', action: async () => {
          const result = await regenerateJoinCode(id);
          context.rememberSpace({ ...space, join_code: result.join_code });
        }, success: '새 참여 번호를 발급했어요.' })}>새 번호 받기</SpaceButton>}
      </View> : <Text style={s.hint}>개인 공간에는 초대할 수 없어요. 함께 쓰려면 새 공간을 만들어 주세요.</Text>}
      <View style={s.card}><Text style={s.heading}>함께하는 사람 {space.member_count}명</Text>
        {membersQuery.isPending && <Text style={s.text}>멤버를 불러오고 있어요.</Text>}
        {membersQuery.isError && <SpaceButton onPress={() => { void membersQuery.refetch(); }}>멤버 다시 불러오기</SpaceButton>}
        {!membersQuery.isError && members.map(member => <View key={member.user_id} style={s.member}><View style={s.row}><View style={s.avatar}><Text style={s.name}>{member.nickname.slice(0, 1)}</Text></View><View style={s.grow}><Text style={s.name}>{member.nickname}{member.user_id === user?.id ? ' (나)' : ''}</Text><Text style={s.hint}>{member.role === 'owner' ? '주인' : '멤버'}</Text></View></View>
          {shared && owner && member.user_id !== user?.id && member.role !== 'owner' && <>
            <SpaceButton disabled={busy} onPress={() => setConfirmation({ title: '주인을 넘길까요?', message: `${member.nickname}님에게 소유권을 넘기면 나는 일반 멤버가 됩니다. 멤버 관리와 참여 번호 재발급 권한도 함께 넘어갑니다.`, label: '주인 넘기기', action: async () => {
              await transferOwnership(id, member.user_id);
              context.rememberSpace({ ...space, my_role: 'member' });
              queryClient.setQueryData<SpaceMember[]>(['space-members', user?.id, id], members.map(item => ({ ...item, role: item.user_id === member.user_id ? 'owner' : 'member' })));
            }, success: '주인을 넘겼어요. 나는 멤버로 계속 함께할 수 있어요.' })}>주인 넘기기</SpaceButton>
            <SpaceButton kind="danger" disabled={busy} onPress={() => setConfirmation({ title: '멤버를 내보낼까요?', message: `${member.nickname}님은 이 공간의 일정과 기록을 더 이상 볼 수 없습니다. 남긴 기록은 그대로 유지됩니다. 참여 번호로 다시 들어올 수 있으니 필요하면 번호도 새로 받아 주세요.`, label: '내보내기', action: async () => {
              await removeMember(id, member.user_id);
              queryClient.setQueryData(['space-members', user?.id, id], members.filter(item => item.user_id !== member.user_id));
              context.rememberSpace({ ...space, member_count: space.member_count - 1 });
            }, success: '멤버를 내보냈어요.' })}>내보내기</SpaceButton>
          </>}
        </View>)}
      </View>
      {shared && <View style={s.card}><Text style={s.heading}>공간 나가기</Text><Text style={s.text}>{mustTransfer ? '다른 멤버에게 주인을 넘긴 뒤 나갈 수 있어요. 위 멤버 목록에서 주인 넘기기를 선택해 주세요.' : owner ? '마지막 멤버인 내가 나가면 공간도 함께 보관되어 더 이상 열 수 없어요.' : '나가면 이곳의 일정과 기록을 볼 수 없어요. 내가 남긴 기록은 공간에 유지됩니다.'}</Text>
        <SpaceButton kind="danger" disabled={busy || mustTransfer} onPress={() => setConfirmation({ title: '공간에서 나갈까요?', message: owner ? '혼자 남은 공간이 함께 보관됩니다. 이곳의 일정과 기록을 더 이상 열 수 없어요.' : '이곳의 일정과 기록에 접근할 수 없게 됩니다. 남긴 기록은 다른 멤버에게 계속 보입니다.', label: '나가기', action: async () => { await leaveSpace(id); context.forgetSpace(id); router.replace('/spaces'); } })}>공간 나가기</SpaceButton>
      </View>}
    </>}
  </SpaceFrame>;
}
