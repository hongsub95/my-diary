import type { Space } from './space-api';

export function resolveCurrentSpace(spaces: Space[] | undefined, selectedId: string | null | undefined, defaultId: string | null | undefined): Space | null {
  return spaces?.find(space => space.id === (selectedId ?? defaultId))
    ?? spaces?.find(space => space.is_default) ?? spaces?.[0] ?? null;
}

export function spacePermissions(space: Space | undefined | null) {
  const shared = space?.type === 'shared';
  const owner = space?.my_role === 'owner';
  return { shared, owner, canManage: shared && owner, mustTransfer: Boolean(shared && owner && space.member_count > 1) };
}

export function normalizeJoinCode(value: string) { return value.replace(/[\s-]/g, '').toUpperCase(); }

export function spaceInputError(value: string, joining: boolean): string | null {
  if (joining) return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(normalizeJoinCode(value))
    ? null : '8자리 영문·숫자 참여 번호를 확인해 주세요.';
  const length = [...value.trim()].length;
  return length >= 1 && length <= 30 ? null : '공간 이름을 1~30자로 입력해 주세요.';
}
