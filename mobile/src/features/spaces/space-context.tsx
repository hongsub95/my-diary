import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-context';
import { listSpaces, setDefaultSpace, type Space } from './space-api';
import { resolveCurrentSpace } from './space-model';

function useSpaceState() {
  const { user, status, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{ userId: number; id: string } | null>(() => user?.default_space_id ? { userId: user.id, id: user.default_space_id } : null);
  const spacesQuery = useQuery({ queryKey: ['spaces', user?.id], queryFn: listSpaces, enabled: status === 'authenticated', staleTime: 0 });
  const spaces = spacesQuery.data;
  const preferredId = selection?.userId === user?.id ? selection?.id : user?.default_space_id;
  const currentSpace = resolveCurrentSpace(spaces, preferredId, user?.default_space_id);
  const currentSpaceId = spaces ? currentSpace?.id ?? null : preferredId ?? null;

  function selectSpace(input: string | Space) {
    const id = typeof input === 'string' ? input : input.id;
    if (!user || (typeof input === 'string' && !spaces?.some(space => space.id === id))) return false;
    if (typeof input !== 'string') rememberSpace(input);
    setSelection({ userId: user.id, id });
    return true;
  }
  async function saveDefault(id: string) {
    const space = await setDefaultSpace(id);
    if (user) updateUser({ ...user, default_space_id: space.id });
    queryClient.setQueryData<Space[]>(['spaces', user?.id], old => old?.map(item => ({ ...item, is_default: item.id === space.id })));
    return space;
  }
  function rememberSpace(space: Space) {
    queryClient.setQueryData<Space[]>(['spaces', user?.id], (old = []) => old.some(item => item.id === space.id)
      ? old.map(item => item.id === space.id ? space : item) : [...old, space]);
    queryClient.setQueryData(['space', user?.id, space.id], space);
  }
  function forgetSpace(id: string) {
    const personal = spaces?.find(space => space.type === 'personal');
    const lostDefault = user?.default_space_id === id;
    queryClient.setQueryData<Space[]>(['spaces', user?.id], (old = []) => old.filter(space => space.id !== id)
      .map(space => lostDefault ? { ...space, is_default: space.id === personal?.id } : space));
    if (lostDefault && user) updateUser({ ...user, default_space_id: personal?.id ?? null });
    for (const key of ['schedules', 'diaries', 'diary', 'space', 'space-members']) queryClient.removeQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: ['spaces', user?.id] });
  }
  return { spacesQuery, spaces: spaces ?? [], currentSpace, currentSpaceId, selectSpace, saveDefault, rememberSpace, forgetSpace };
}

const SpaceContext = createContext<ReturnType<typeof useSpaceState> | null>(null);
export function SpaceProvider({ children }: PropsWithChildren) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (status === 'anonymous') queryClient.clear();
  }, [status, queryClient]);
  return <SpaceSession key={user?.id ?? status}>{children}</SpaceSession>;
}
function SpaceSession({ children }: PropsWithChildren) {
  return <SpaceContext.Provider value={useSpaceState()}>{children}</SpaceContext.Provider>;
}
export function useSpaces() {
  const value = useContext(SpaceContext);
  if (!value) throw new Error('useSpaces requires SpaceProvider');
  return value;
}
export function useCurrentSpaceId() { return useSpaces().currentSpaceId; }
