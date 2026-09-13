import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '../../shared/components/Icon'
import arrowLeftRaw from '../../assets/icons/arrow-left.svg?raw'
import { fetchLegalDocument, LEGAL_DOCUMENTS } from '../../shared/api/legal'
import { getApiErrorMessage } from '../../shared/api/apiError'
import './more.css'

/**
 * 약관·개인정보 처리방침 화면.
 *
 * 문서 하나마다 화면을 만들지 않고 주소의 코드로 갈라 쓴다. 두 문서의 구조가 같고,
 * 나중에 문서가 늘어도(예: 위치기반서비스 약관) 경로만 추가하면 된다.
 *
 * 본문은 서버가 블록 목록으로 내려준다(app/legal/service.py). 그래서 여기서는
 * 마크다운을 해석하지 않고 종류별로 그리기만 한다.
 */
export default function LegalPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const known = Object.values(LEGAL_DOCUMENTS).includes(code)

  const document = useQuery({
    queryKey: ['legal', code],
    queryFn: () => fetchLegalDocument(code),
    enabled: known,
    // 약관은 자주 바뀌지 않는다. 화면을 드나들 때마다 다시 받을 이유가 없다.
    staleTime: 1000 * 60 * 60,
  })

  return (
    <div className="more-page">
      <div className="more-sub__header">
        <button type="button" onClick={() => navigate(-1)} className="more-sub__back" aria-label="뒤로">
          <Icon raw={arrowLeftRaw} size={20} />
        </button>
        <h1 className="more-page__heading">{document.data?.title ?? '약관'}</h1>
      </div>

      <div className="more-sub__body">
        {!known && <p className="more-form__error">요청한 문서를 찾을 수 없어요.</p>}
        {document.isPending && known && <p className="more-form__hint">문서를 불러오는 중…</p>}

        {document.isError && (
          <div className="legal__error">
            <p className="more-form__error" role="alert">{getApiErrorMessage(document.error)}</p>
            <button type="button" className="theme-retry" onClick={() => document.refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {document.data && (
          <article className="legal">
            {/* 언제 고친 문서인지 먼저 보여준다. 약관은 "지금 보는 게 최신인가"가
                가장 먼저 궁금한 정보다. */}
            <p className="legal__updated">최종 개정일 {document.data.updated_at}</p>
            {document.data.blocks.map((block, index) => (
              <LegalBlock key={index} block={block} />
            ))}
          </article>
        )}
      </div>
    </div>
  )
}

/**
 * 블록 하나를 그린다.
 *
 * @param {{block: {type: string, text?: string, level?: number, rows?: string[][]}}} props
 *
 * 모르는 종류는 아무것도 그리지 않는다. 서버가 블록 종류를 늘렸는데 화면이 아직
 * 모를 때, 깨진 화면 대신 그 부분만 빠지게 하려는 것이다.
 */
function LegalBlock({ block }) {
  if (block.type === 'heading') {
    // level 2가 절, 3이 소절이다. h1은 화면 상단 제목이 이미 쓰고 있다.
    const Tag = block.level >= 3 ? 'h3' : 'h2'
    return <Tag className={`legal__heading legal__heading--${block.level >= 3 ? 'sub' : 'main'}`}>{block.text}</Tag>
  }

  if (block.type === 'paragraph') return <p className="legal__paragraph">{block.text}</p>

  if (block.type === 'bullet') {
    return (
      <p className="legal__bullet">
        <span aria-hidden="true">·</span>
        {block.text}
      </p>
    )
  }

  // 사용자가 꼭 읽어야 하는 주의사항이다. 본문과 같은 모양이면 그냥 지나친다.
  if (block.type === 'callout') return <p className="legal__callout">{block.text}</p>

  if (block.type === 'table') {
    const [header, ...rows] = block.rows
    return (
      // 표는 좁은 화면에서 넘칠 수 있다. 페이지 전체가 가로로 밀리지 않도록
      // 표만 따로 스크롤시킨다.
      <div className="legal__table-scroll">
        <table className="legal__table">
          <thead>
            <tr>{header.map((cell, index) => <th key={index}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}
