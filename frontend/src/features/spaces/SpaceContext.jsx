import { createContext, useContext, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../shared/contexts/AuthContext'
import { listSpaces, setDefaultSpace } from '../../shared/api/spaces'
import { resolveCurrentSpace } from './spaceModel'

const SpaceContext = createContext(null)

// Browsing another space never changes the account's startup preference.
export function SpaceProvider({ children }) {
  const { user, status } = useAuth()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (status === 'anonymous') queryClient.clear()
  }, [status, queryClient])
  return <SpaceSession key={user?.id ?? status}>{children}</SpaceSession>
}

function SpaceSession({ children }) {
  const { user, status, updateUser } = useAuth()
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState(() => user?.default_space_id ? { userId: user.id, id: user.default_space_id } : null)
  const spacesQuery = useQuery({
    queryKey: ['spaces', user?.id], queryFn: listSpaces,
    enabled: status === 'authenticated', staleTime: 0,
  })
  const spaces = spacesQuery.data
  const preferredId = selection && selection.userId === user?.id ? selection.id : user?.default_space_id
  const currentSpace = resolveCurrentSpace(spaces, preferredId, user?.default_space_id)
  const currentSpaceId = spaces ? currentSpace?.id ?? null : preferredId ?? null

  function selectSpace(input) {
    const id = typeof input === 'string' ? input : input.id
    if (typeof input === 'string' && !spaces?.some(space => space.id === id)) return false
    if (typeof input !== 'string') rememberSpace(input)
    setSelection({ userId: user.id, id })
    return true
  }

  async function saveDefault(id) {
    const space = await setDefaultSpace(id)
    updateUser({ ...user, default_space_id: space.id })
    queryClient.setQueryData(['spaces', user.id], old => old?.map(item => ({ ...item, is_default: item.id === space.id })))
    return space
  }

  function rememberSpace(space) {
    queryClient.setQueryData(['spaces', user.id], (old = []) => old.some(item => item.id === space.id)
      ? old.map(item => item.id === space.id ? space : item) : [...old, space])
    queryClient.setQueryData(['space', user.id, space.id], space)
  }

  function forgetSpace(id) {
    const personal = spaces?.find(space => space.type === 'personal')
    const lostDefault = user?.default_space_id === id
    queryClient.setQueryData(['spaces', user.id], (old = []) => old.filter(space => space.id !== id)
      .map(space => lostDefault ? { ...space, is_default: space.id === personal?.id } : space))
    if (lostDefault) updateUser({ ...user, default_space_id: personal?.id ?? null })
    // Erase inaccessible content, including detail caches that use schedule IDs.
    for (const key of ['schedules', 'diaries', 'diary', 'space', 'space-members']) queryClient.removeQueries({ queryKey: [key] })
    queryClient.invalidateQueries({ queryKey: ['spaces', user.id] })
  }

  const value = { spacesQuery, spaces: spaces ?? [], currentSpace, currentSpaceId, selectSpace, saveDefault, rememberSpace, forgetSpace }
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useSpaces() {
  const value = useContext(SpaceContext)
  if (!value) throw new Error('useSpaces requires SpaceProvider')
  return value
}

export function useCurrentSpaceId() {
  return useSpaces().currentSpaceId
}
