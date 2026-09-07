import { useRef, useState } from 'react'
import { Icon } from '../../shared/components/Icon'
import pencilRaw from '../../assets/icons/pencil.svg?raw'
import plusRaw from '../../assets/icons/plus.svg?raw'
import { useAuth } from '../../shared/contexts/AuthContext'
import { useDiary } from '../../shared/api/queries'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './diary.css'

/**
 * 본문 작성·수정 폼.
 *
 * @param {object} props
 * @param {object|null} props.entry 이미 쓴 내 본문. 없으면 새로 쓰는 중이다
 * @param {object} props.mutation useDiary의 saveEntry
 * @param {() => void} props.onClose 닫기
 */
function DiaryEditor({ entry, mutation, onClose }) {
  const [content, setContent] = useState(entry?.content ?? '')
  const [mood, setMood] = useState(entry?.mood ?? '')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!content.trim()) {
      setError('오늘을 한 문장으로라도 남겨보세요.')
      return
    }

    setError('')
    try {
      await mutation.mutateAsync({ content: content.trim(), mood: mood.trim() })
      onClose()
    } catch (caught) {
      setError(getApiErrorMessage(caught))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="diary-editor">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="diary-editor__content"
        placeholder="오늘 하루는 어땠나요?"
        rows={5}
        autoFocus
      />
      <input
        type="text"
        value={mood}
        onChange={(event) => setMood(event.target.value)}
        className="diary-editor__mood"
        placeholder="오늘의 기분 (선택)"
        maxLength={20}
      />
      {error && <p className="diary-editor__error" role="alert">{error}</p>}
      <div className="diary-editor__actions">
        <button type="button" onClick={onClose} className="diary-editor__cancel">취소</button>
        <button type="submit" className="diary-editor__submit" disabled={mutation.isPending}>
          {mutation.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}

/**
 * 일정 상세의 일기 영역. 하루의 사진과 작성자별 본문을 함께 다룬다.
 *
 * @param {object} props
 * @param {number|string} props.scheduleId 일정 id
 *
 * 사진을 본문보다 위에 두는 이유: 완료한 하루는 사진과 기록이 먼저 보여야 한다는
 * 요구사항(docs/UX_IDENTITY_REDIRECTION_SPEC.md 7절)을 따른 것이다.
 */
export default function DiarySection({ scheduleId }) {
  const { user } = useAuth()
  const { entries, photos, saveEntry, removeEntry, addPhotos, removePhoto } = useDiary(scheduleId)
  const [editing, setEditing] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInput = useRef(null)

  const allEntries = entries.data ?? []
  // 단수 경로가 없어도 내 글은 작성자 id로 가려낼 수 있다. 남의 글은 읽기만 한다.
  const myEntry = allEntries.find((entry) => entry.author.id === user?.id) ?? null
  const otherEntries = allEntries.filter((entry) => entry.author.id !== user?.id)

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    // 같은 파일을 다시 골라도 change가 일어나도록 입력값을 비워둔다.
    event.target.value = ''
    if (files.length === 0) return

    setUploadError('')
    try {
      await addPhotos.mutateAsync(files)
    } catch (caught) {
      setUploadError(getApiErrorMessage(caught))
    }
  }

  return (
    <div className="diary-section">
      {/* 사진 */}
      <section className="sdetail-section">
        <div className="sdetail-section__header">
          <h2 className="sdetail-section__title">사진</h2>
          <button
            type="button"
            className="sdetail-section__edit"
            onClick={() => fileInput.current?.click()}
            disabled={addPhotos.isPending}
          >
            <Icon raw={plusRaw} size={14} />
            {addPhotos.isPending ? '올리는 중…' : '추가'}
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          onChange={handleFiles}
          className="diary-photos__input"
        />

        {uploadError && <p className="diary-editor__error" role="alert">{uploadError}</p>}

        {photos.data?.length > 0 ? (
          <div className="diary-photos">
            {photos.data.map((photo) => (
              <div key={photo.id} className="diary-photo">
                {/* 썸네일이 없으면 서버가 원본 URL을 담아 준다. 화면은 한 값만 본다. */}
                <img src={photo.thumbnail_url ?? photo.file_url} alt="" loading="lazy" />
                {photo.is_cover && <span className="diary-photo__cover">대표</span>}
                <button
                  type="button"
                  className="diary-photo__remove"
                  onClick={() => removePhoto.mutate(photo.id)}
                  aria-label="사진 빼기"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="diary-section__empty">
            사진 한 장만 올려도 이 하루는 기록이 됩니다.
          </p>
        )}
      </section>

      {/* 본문 */}
      <section className="sdetail-section">
        <div className="sdetail-section__header">
          <h2 className="sdetail-section__title">일기</h2>
          {myEntry && !editing && (
            <button type="button" className="sdetail-section__edit" onClick={() => setEditing(true)}>
              <Icon raw={pencilRaw} size={14} />
              수정
            </button>
          )}
        </div>

        {editing ? (
          <DiaryEditor
            entry={myEntry}
            mutation={saveEntry}
            onClose={() => setEditing(false)}
          />
        ) : myEntry ? (
          <article className="diary-entry diary-entry--mine">
            {myEntry.mood && <p className="diary-entry__mood">{myEntry.mood}</p>}
            <p className="diary-entry__content">{myEntry.content}</p>
            <button
              type="button"
              className="diary-entry__remove"
              onClick={() => removeEntry.mutate()}
              disabled={removeEntry.isPending}
            >
              지우기
            </button>
          </article>
        ) : (
          <div className="diary-section__prompt">
            <p>아직 남긴 글이 없어요.</p>
            <button type="button" onClick={() => setEditing(true)} className="diary-section__write">
              오늘을 남기기
            </button>
          </div>
        )}

        {/* 같은 하루를 함께 보낸 사람의 글. 읽기만 한다. */}
        {otherEntries.map((entry) => (
          <article key={entry.id} className="diary-entry">
            <p className="diary-entry__author">{entry.author.nickname}</p>
            {entry.mood && <p className="diary-entry__mood">{entry.mood}</p>}
            <p className="diary-entry__content">{entry.content}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
