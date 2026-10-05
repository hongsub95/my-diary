import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSpace, joinSpace, listSpaces } from '../../shared/api/spaces'
import { getApiErrorMessage } from '../../shared/api/apiError'
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar'
import { useSpaces } from './SpaceContext'
import { SpaceFrame } from './SpaceUI'
import { normalizeJoinCode, spaceInputError } from './spaceModel'

export default function SpaceFormPage({ mode }) {
  const joining = mode === 'join'
  const [value, setValue] = useState('')
  const [icon, setIcon] = useState('heart')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const input = useRef(null)
  const { rememberSpace } = useSpaces()
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const navigate = useNavigate()
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    const cleaned = joining ? normalizeJoinCode(value) : value.trim()
    const invalid = spaceInputError(value, joining)
    if (invalid) { input.current?.focus(); showSnackbar(invalid); return }
    lock.current = true
    setBusy(true)
    dismissSnackbar()
    try {
      let space
      try { space = joining ? await joinSpace(cleaned) : await createSpace({ name: cleaned, icon }) }
      catch (error) {
        if (!joining || error.response?.data?.code !== 'ALREADY_MEMBER') throw error
        space = (await listSpaces()).find(item => item.join_code === cleaned)
        if (!space) throw error
      }
      rememberSpace(space)
      navigate(`/spaces/${space.id}`, { replace: true })
    } catch (error) { showSnackbar(getApiErrorMessage(error)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <SpaceFrame title={joining ? '스페이스 참여' : '스페이스 만들기'}>
    <section className="space-intro"><span className="space-eyebrow">{joining ? '초대받은 공간으로' : '함께할 사람을 떠올려 보세요'}</span><h2>{joining ? '참여 번호를 받았나요?' : '우리만의 공간을 만들어요'}</h2><p>{joining ? '스페이스에 참여하면 기존 일정, 일기와 사진도 함께 볼 수 있어요.' : '연인, 친구와 함께 계획하고 기록을 쌓을 수 있어요. 최대 20명이 함께할 수 있습니다.'}</p></section>
    <form className="space-card space-form" onSubmit={submit} noValidate>
      {!joining && <fieldset disabled={busy}><legend>공간 아이콘</legend><div className="space-actions">{[['heart', '♡ 우리 둘'], ['friends', '♧ 친구들']].map(([key, label]) => <button type="button" className={`space-button${icon === key ? ' space-button--selected' : ''}`} key={key} aria-pressed={icon === key} onClick={() => setIcon(key)}>{label}</button>)}</div></fieldset>}
      <label htmlFor="space-form-value">{joining ? '참여 번호' : '스페이스 이름'}</label>
      <input ref={input} id="space-form-value" value={value} disabled={busy} autoComplete="off" placeholder={joining ? '예: K7M2QX9P' : '예: 우리 둘, 주말 여행 친구들'} onChange={event => setValue(joining ? event.target.value.toUpperCase() : event.target.value)} aria-describedby="space-form-hint" />
      <p id="space-form-hint" className="space-hint">{joining ? '영문과 숫자 8자리예요. 붙여넣은 공백과 하이픈은 자동으로 제외해요.' : '1~30자로 입력해 주세요. 만든 뒤 참여 번호를 전달할 수 있어요.'}</p>
      <button type="submit" disabled={busy} className="space-button space-button--primary">{busy ? '처리 중…' : joining ? '이 스페이스에 참여하기' : '스페이스 만들기'}</button>
    </form><Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </SpaceFrame>
}
