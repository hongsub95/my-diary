// 크리스마스 배경 A "눈 오는 골목"의 SVG를 문자열로 만든다.
//
// 시안(docs/design-drafts/christmas/a-night-alley.html)의 그리기 코드를 옮겼다. 다른 점은
// 폭이다. 시안은 휴대폰 폭(370)에 맞춘 viewBox를 늘였지만, 웹은 데스크톱 홈처럼 1000px이
// 넘는 폭도 있어서 늘이면 달과 전구가 세 배로 커진다. 그래서 1단위 = 1px로 두고 실제 폭만큼
// 골목과 전구 줄을 이어 그린다.
//
// 색은 넣지 않고 클래스만 단다. 낮·밤과 테마 색은 seasonal.css가 칠한다. 그래야 낮·밤이
// 바뀌어도 그림을 다시 만들지 않는다.
//
// 모두 이 파일 안에서 만든 값이라 dangerouslySetInnerHTML로 넣어도 외부 입력이 섞이지 않는다.

/** 시드가 있는 난수. 같은 시드면 늘 같은 골목이 나온다. */
function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f1 = (n) => n.toFixed(1)

/**
 * 맨 위 전구 줄, 달·해, 별·빛망울·구름. 높이 270.
 *
 * @param {number} width 실제 폭(px)
 */
export function topSceneSvg(width) {
  const random = seededRandom(11)
  const r = (a, b) => a + random() * (b - a)
  const stars = Array.from({ length: Math.round(28 * width / 370) }, () =>
    `<circle class="ss-star ss-tw" cx="${f1(r(4, width - 4))}" cy="${f1(r(58, 150))}" r="${f1(r(0.5, 1.3))}" style="--t:${f1(r(1.8, 3.6))}s;--o:${f1(r(0, 3))}s"/>`).join('')
  const bokeh = [[0.57, 66, 13], [0.71, 104, 8], [0.5, 132, 17], [0.81, 150, 11], [0.32, 156, 9], [0.65, 160, 6], [0.95, 72, 7]]
    .map(([fx, cy, rr]) => `<circle class="ss-bokeh" cx="${f1(fx * width)}" cy="${cy}" r="${rr}" fill="url(#ss-bokeh)"/>`).join('')

  // 전구 줄: 약 190px마다 한 번씩 늘어진다. 가장 낮은 전구 끝이 y≈36이라 인사 글씨에 닿지 않는다.
  const swags = Math.max(2, Math.round(width / 190))
  const step = (width + 20) / swags
  let wire = 'M-10 4'
  const bulbs = []
  for (let i = 0; i < swags; i++) {
    const x0 = -10 + i * step
    const y0 = i === 0 ? 4 : 6
    const cx = x0 + step / 2
    const cy = i % 2 === 0 ? 42 : 38
    const x2 = x0 + step
    const y2 = 6
    wire += ` Q ${f1(cx)} ${cy} ${f1(x2)} ${y2}`
    for (let k = 1; k <= 8; k++) {
      const t = k / 9
      const u = 1 - t
      bulbs.push([u * u * x0 + 2 * u * t * cx + t * t * x2, u * u * y0 + 2 * u * t * cy + t * t * y2])
    }
  }
  const tones = ['ss-bulb--gold', 'ss-bulb--theme', 'ss-bulb--mint', 'ss-bulb--ice']
  const bulbSvg = bulbs.map(([bx, by], i) => {
    const tone = tones[i % 4]
    return `<g transform="translate(${f1(bx)} ${f1(by)}) rotate(${f1(r(-14, 14))})">
      <circle class="ss-halo ${tone}" cy="6" r="7" filter="url(#ss-soft)" style="--t:${f1(r(1.4, 2.6))}s;--o:${f1(r(0, 2))}s"/>
      <rect x="-1.6" y="-1" width="3.2" height="3" rx=".6" fill="#2A2F45"/>
      <ellipse class="${tone}" cy="5.6" rx="2.6" ry="3.8"/>
      <ellipse cx="-.8" cy="4.4" rx=".8" ry="1.3" fill="#fff" opacity=".7"/></g>`
  }).join('')

  const mx = width - 32
  const sx = width - 68
  return `<svg width="${width}" height="270" viewBox="0 0 ${width} 270" aria-hidden="true" focusable="false">
    <defs>
      <filter id="ss-soft" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.6"/></filter>
      <filter id="ss-cloud" x="-.3" y="-1" width="1.6" height="3"><feGaussianBlur stdDeviation="3"/></filter>
      <radialGradient id="ss-moon"><stop offset="0" stop-color="#FFF1CF" stop-opacity=".55"/><stop offset="1" stop-color="#FFF1CF" stop-opacity="0"/></radialGradient>
      <radialGradient id="ss-sun"><stop offset="0" stop-color="#FFF3C8" stop-opacity=".85"/><stop offset="1" stop-color="#FFF3C8" stop-opacity="0"/></radialGradient>
      <radialGradient id="ss-bokeh"><stop offset="0" stop-color="#FFD682" stop-opacity=".7"/><stop offset=".45" stop-color="#FFD682" stop-opacity=".22"/><stop offset="1" stop-color="#FFD682" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="ss-night-only">${stars}${bokeh}
      <circle cx="${mx}" cy="132" r="28" fill="url(#ss-moon)"/><circle cx="${mx}" cy="132" r="10" fill="#FFF4DA"/>
      <circle cx="${mx - 3}" cy="129" r="2" fill="#F0E2BF"/><circle cx="${mx + 3}" cy="135" r="1.4" fill="#F0E2BF"/></g>
    <g class="ss-day-only">
      <circle cx="${sx}" cy="152" r="44" fill="url(#ss-sun)"/><circle cx="${sx}" cy="152" r="13" fill="#FFF8E6"/>
      <g filter="url(#ss-cloud)" fill="#fff"><ellipse cx="${sx - 40}" cy="140" rx="34" ry="8" opacity=".8"/><ellipse cx="${sx - 64}" cy="134" rx="20" ry="9" opacity=".75"/>
      <ellipse cx="${f1(width * 0.58)}" cy="78" rx="30" ry="6" opacity=".6"/><ellipse cx="${width - 18}" cy="164" rx="26" ry="6" opacity=".7"/></g></g>
    <path class="ss-wire" d="${wire}" fill="none" stroke-width="1.3"/>
    <g class="ss-bulbs">${bulbSvg}</g>
  </svg>`
}

/**
 * 화면 가운데 하늘의 별. 밤에만 보인다.
 *
 * @param {number} width 실제 폭(px)
 * @param {number} height 별을 흩뿌릴 높이(px)
 */
export function midStarsSvg(width, height) {
  const random = seededRandom(23)
  const count = Math.round(30 * (width * height) / (370 * 350))
  const stars = Array.from({ length: Math.min(count, 160) }, () =>
    `<circle class="ss-star" cx="${f1(random() * width)}" cy="${f1(random() * height)}" r="${f1(0.5 + random() * 0.8)}" opacity="${f1(0.6 + random() * 0.4)}"/>`).join('')
  return `<svg width="${width}" height="${height}" aria-hidden="true" focusable="false">${stars}</svg>`
}

/**
 * 화면 아래, 탭 바 바로 위의 골목. 높이 200, 땅의 맨 아래 색이 탭 바 뒤 눈밭과 이어진다.
 *
 * @param {number} width 실제 폭(px)
 */
export function villageSvg(width) {
  const random = seededRandom(31)
  const r = (a, b) => a + random() * (b - a)
  const base = 128
  let far = ''
  let x = -6
  while (x < width + 6) {
    const w = r(30, 54)
    const h = r(30, 48)
    const top = base - 6 - h
    far += `<rect class="ss-far" x="${f1(x)}" y="${f1(top)}" width="${f1(w)}" height="${f1(h)}"/>`
    for (let i = 0; i < 3; i++) {
      if (random() < 0.5) far += `<rect class="ss-far-window" x="${f1(x + r(4, w - 8))}" y="${f1(top + r(6, h - 10))}" width="3.5" height="4.5"/>`
    }
    x += w + r(-4, 2)
  }

  let near = ''
  let pools = ''
  let church = false
  x = -4
  while (x < width + 6) {
    if (!church && x > width * 0.7) {
      const cx = x + 2
      near += `<rect class="ss-near" x="${f1(cx)}" y="${base - 46}" width="26" height="46"/>
        <rect class="ss-near" x="${f1(cx + 7)}" y="${base - 72}" width="12" height="28"/>
        <path class="ss-near" d="M${f1(cx + 4)} ${base - 72} L${f1(cx + 13)} ${base - 94} L${f1(cx + 22)} ${base - 72} Z"/>
        <path d="M${f1(cx + 13)} ${base - 101} v7 M${f1(cx + 10.5)} ${base - 98.5} h5" stroke="#E9D9A8" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M${f1(cx + 4.5)} ${base - 72.5} L${f1(cx + 13)} ${base - 92} L${f1(cx + 21.5)} ${base - 72.5}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" opacity=".9"/>
        <rect x="${f1(cx)}" y="${base - 47.5}" width="26" height="2.5" rx="1.2" fill="#fff"/>
        <circle class="ss-window" cx="${f1(cx + 13)}" cy="${base - 58}" r="3.4"/>
        <path class="ss-window" d="M${f1(cx + 9)} ${base} v-12 a4 4 0 0 1 8 0 v12 Z"/>`
      pools += `<ellipse cx="${f1(cx + 13)}" cy="${base + 3}" rx="30" ry="7" fill="url(#ss-pool)"/>`
      x += 30
      church = true
      continue
    }
    const w = r(28, 46)
    const h = r(18, 36)
    const top = base - h
    const gable = random() < 0.6
    near += `<rect class="ss-near" x="${f1(x)}" y="${f1(top)}" width="${f1(w)}" height="${f1(h)}"/>`
    if (gable) {
      const peak = top - w * 0.36
      near += `<path class="ss-near" d="M${f1(x - 2)} ${f1(top)} L${f1(x + w / 2)} ${f1(peak)} L${f1(x + w + 2)} ${f1(top)} Z"/>
        <path d="M${f1(x - 1)} ${f1(top - 0.5)} L${f1(x + w / 2)} ${f1(peak + 0.5)} L${f1(x + w + 1)} ${f1(top - 0.5)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/>`
    } else {
      near += `<rect x="${f1(x - 1)}" y="${f1(top - 1.5)}" width="${f1(w + 2)}" height="3" rx="1.5" fill="#fff"/>`
    }
    const cols = Math.floor((w - 6) / 9)
    const rows = Math.floor((h - 6) / 11)
    let lit = 0
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        const on = random() < 0.5
        if (on) lit++
        const flick = on && random() < 0.18 ? ' ss-flick' : ''
        near += on
          ? `<rect class="ss-window${flick}" x="${f1(x + 5 + c * 9)}" y="${f1(top + 6 + row * 11)}" width="4.5" height="6" rx=".6" style="--t:${f1(r(4, 9))}s;--o:${f1(r(0, 6))}s"/>`
          : `<rect x="${f1(x + 5 + c * 9)}" y="${f1(top + 6 + row * 11)}" width="4.5" height="6" rx=".6" fill="#fff" opacity=".07"/>`
      }
    }
    if (lit >= 2) pools += `<ellipse cx="${f1(x + w / 2)}" cy="${base + 2}" rx="${f1(w * 0.7)}" ry="6" fill="url(#ss-pool)"/>`
    x += w + r(1, 5)
  }

  const pine = (px, by, h) => `<path d="M${px} ${by - h} L${f1(px - h * 0.3)} ${f1(by - h * 0.45)} H${f1(px - h * 0.16)} L${f1(px - h * 0.4)} ${by} H${f1(px + h * 0.4)} L${f1(px + h * 0.16)} ${f1(by - h * 0.45)} H${f1(px + h * 0.3)} Z" fill="#2E4A3C"/>
    <path d="M${f1(px - h * 0.3)} ${f1(by - h * 0.45)} L${px} ${by - h} L${f1(px + h * 0.3)} ${f1(by - h * 0.45)} M${f1(px - h * 0.4)} ${by} L${f1(px - h * 0.16)} ${f1(by - h * 0.45)} M${f1(px + h * 0.4)} ${by} L${f1(px + h * 0.16)} ${f1(by - h * 0.45)}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>`
  const ground = `M0 122 Q ${f1(width * 0.257)} 110 ${f1(width * 0.514)} 120 T ${width} 116 V 200 H 0 Z`

  return `<svg width="${width}" height="200" viewBox="0 0 ${width} 200" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="ss-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#EEF2F7"/><stop offset="1" stop-color="#DFE6EF"/></linearGradient>
      <radialGradient id="ss-pool"><stop offset="0" stop-color="#FFD27A" stop-opacity=".45"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>
    </defs>
    ${far}${near}
    <path d="${ground}" fill="url(#ss-ground)"/>
    <g class="ss-night-only">${pools}</g>
    ${pine(20, base + 2, 30)}${pine(44, base + 4, 20)}${pine(Math.round(width - 18), base, 28)}
  </svg>`
}
