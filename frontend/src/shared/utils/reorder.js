/**
 * 배열에서 한 항목을 한 칸 옮긴 새 배열을 돌려준다.
 *
 * @param {Array} items 원본 배열 (건드리지 않는다)
 * @param {number} index 옮길 항목의 자리
 * @param {number} step -1이면 위로, 1이면 아래로
 * @returns {Array} 옮긴 새 배열. 끝에서 더 못 가면 원본을 그대로 돌려준다
 *
 * 끝에서 원본을 그대로 돌려주는 이유: 호출하는 쪽이 `next === items`로 "바뀐 게 없다"를
 * 알 수 있어, 서버에 의미 없는 요청을 보내지 않는다.
 *
 * 드래그가 아니라 한 칸씩 옮기는 방식을 쓴다. 웹과 앱에서 같은 규칙을 쓸 수 있고,
 * 키보드와 스크린리더로도 순서를 바꿀 수 있기 때문이다. 목록이 길어져 불편해지면
 * 그때 드래그를 얹으면 된다.
 */
export function moveItem(items, index, step) {
  const target = index + step
  if (target < 0 || target >= items.length) return items

  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
