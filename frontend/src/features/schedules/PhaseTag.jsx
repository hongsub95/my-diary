import './phase-tag.css'

/**
 * 상태 모양을 입힌 글자 태그.
 *
 * 색을 구분하기 어려운 사람도 알아보게 모양을 달리한다: 예정은 테두리만, 남기기 전은 주황 점,
 * 남긴 하루는 채운 바탕에 체크. 점과 체크는 장식이라 화면 읽기에서 빼고, 상태는 srLabel로 읽힌다.
 *
 * @param {object} props
 * @param {'plan' | 'pending' | 'done'} props.kind 상태 모양 (phase.js의 phaseKind)
 * @param {string} props.label 보이는 글자. 캘린더 칩은 하루 제목, 카드 배지는 phaseLabel 문구
 * @param {'chip' | 'badge'} [props.size] chip = 캘린더 날짜 칸, badge = 카드
 * @param {string} [props.srLabel] 화면 읽기 도구에만 덧붙일 문구 (칩이 제목만 보여줄 때 상태 이름)
 * @param {string} [props.title] 마우스를 올렸을 때 보일 전체 문구. 칩은 제목이 잘리므로 넘긴다
 */
export function PhaseTag({ kind, label, size = 'badge', srLabel, title }) {
  return (
    <span className={`phase-tag phase-tag--${size} phase-tag--${kind}`} title={title}>
      {kind === 'pending' && <span className="phase-tag__mark phase-tag__mark--dot" aria-hidden="true">●</span>}
      {kind === 'done' && <span className="phase-tag__mark" aria-hidden="true">✓</span>}
      <span className="phase-tag__label">{label}</span>
      {srLabel && <span className="phase-tag__sr">{srLabel}</span>}
    </span>
  )
}
