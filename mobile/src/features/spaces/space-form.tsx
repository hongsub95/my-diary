import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { createSpace, joinSpace, listSpaces, type Space } from './space-api';
import { useSpaces } from './space-context';
import { createSpaceStyles, SpaceButton, SpaceFrame } from './space-ui';
import { normalizeJoinCode, spaceInputError } from './space-model';
import { getApiError } from '@/shared/api/api-error';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { colors } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export function SpaceForm({ joining = false }: { joining?: boolean }) {
  const [value, setValue] = useState('');
  const [icon, setIcon] = useState('heart');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<TextInput>(null);
  const { rememberSpace } = useSpaces();
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const router = useRouter();
  const s = useThemedStyles(createSpaceStyles);
  async function submit() {
    if (lock.current) return;
    const cleaned = joining ? normalizeJoinCode(value) : value.trim();
    const invalid = spaceInputError(value, joining);
    if (invalid) { input.current?.focus(); showSnackbar(invalid); return; }
    lock.current = true; setBusy(true); dismissSnackbar();
    try {
      let space: Space;
      try { space = joining ? await joinSpace(cleaned) : await createSpace({ name: cleaned, icon }); }
      catch (error) {
        if (!joining || getApiError(error).code !== 'ALREADY_MEMBER') throw error;
        const existing = (await listSpaces()).find(item => item.join_code === cleaned);
        if (!existing) throw error;
        space = existing;
      }
      rememberSpace(space);
      router.replace({ pathname: '/spaces/[id]', params: { id: space.id } });
    } catch (error) { showSnackbar(getApiError(error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <SpaceFrame title={joining ? '스페이스 참여' : '스페이스 만들기'} overlay={<Snackbar notice={notice} onDismiss={dismissSnackbar} />}>
    <View style={s.intro}><Text style={s.eyebrow}>{joining ? '초대받은 공간으로' : '함께할 사람을 떠올려 보세요'}</Text><Text style={s.title}>{joining ? '참여 번호를 받았나요?' : '우리만의 공간을 만들어요'}</Text><Text style={s.text}>{joining ? '스페이스에 참여하면 기존 일정, 일기와 사진도 함께 볼 수 있어요.' : '연인, 친구와 함께 계획하고 기록을 쌓을 수 있어요. 최대 20명이 함께할 수 있습니다.'}</Text></View>
    <View style={s.card}>{!joining && <><Text style={s.label}>공간 아이콘</Text><View style={{ gap: 8 }}>{[['heart', '♡ 우리 둘'], ['friends', '♧ 친구들']].map(([key, label]) => <SpaceButton key={key} kind={icon === key ? 'selected' : 'secondary'} disabled={busy} onPress={() => setIcon(key)}>{label}</SpaceButton>)}</View></>}
      <Text style={s.label}>{joining ? '참여 번호' : '스페이스 이름'}</Text>
      <TextInput ref={input} accessibilityLabel={joining ? '참여 번호' : '스페이스 이름'} editable={!busy} value={value} onChangeText={text => setValue(joining ? text.toUpperCase() : text)} autoCapitalize={joining ? 'characters' : 'none'} autoCorrect={false} style={s.input} placeholderTextColor={colors.muted} placeholder={joining ? '예: K7M2QX9P' : '예: 우리 둘, 주말 여행 친구들'} onSubmitEditing={() => { void submit(); }} returnKeyType="done" />
      <Text style={s.hint}>{joining ? '영문과 숫자 8자리예요. 붙여넣은 공백과 하이픈은 자동으로 제외해요.' : '1~30자로 입력해 주세요. 만든 뒤 참여 번호를 전달할 수 있어요.'}</Text>
      <SpaceButton disabled={busy} kind="primary" onPress={() => { void submit(); }}>{busy ? '처리 중…' : joining ? '이 스페이스에 참여하기' : '스페이스 만들기'}</SpaceButton>
    </View>
  </SpaceFrame>;
}
