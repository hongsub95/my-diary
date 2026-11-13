import { useEffect, useMemo, useRef, useState } from 'react'
import { midStarsSvg, topSceneSvg, villageSvg } from './sceneSvg'

/** 크기가 이만큼 바뀌어야 그림을 다시 만든다. 창 크기를 끌 때마다 다시 그리지 않게 한다. */
const SIZE_STEP = 24

/**
 * 크리스마스 배경 A "눈 오는 골목". 탭 화면 뒤에 고정으로 깔린다.
 *
 * @param {{night: boolean}} props 밤 장면인지. 낮에는 해·구름이 뜨고 별·달·창 불빛이 꺼진다
 *
 * 위에서부터 하늘 → 전구 줄·달(해)·별(구름) → 가운데 별 → 화면 아래 골목 → 내리는 눈.
 * 목록을 내려도 움직이지 않고 카드만 올라간다 (docs/API_SPEC.md 3-U절 화면 규칙).
 * 그림은 폭이 바뀔 때만 다시 만들고, 낮·밤 전환은 CSS 클래스로만 바꾼다.
 */
export default function ChristmasBackdrop({ night }) {
  const rootRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = rootRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.ceil(entry.contentRect.width / SIZE_STEP) * SIZE_STEP
      const height = Math.ceil(entry.contentRect.height / SIZE_STEP) * SIZE_STEP
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const top = useMemo(() => (size.width ? topSceneSvg(size.width) : ''), [size.width])
  const village = useMemo(() => (size.width ? villageSvg(size.width) : ''), [size.width])
  const midHeight = Math.max(0, size.height - 470)
  const mid = useMemo(() => (size.width && midHeight ? midStarsSvg(size.width, midHeight) : ''), [size.width, midHeight])

  return (
    <div ref={rootRef} className={`season-scene ${night ? 'season-scene--night' : 'season-scene--day'}`} aria-hidden="true">
      <div className="season-scene__sky" />
      <div className="season-scene__mid" dangerouslySetInnerHTML={{ __html: mid }} />
      <div className="season-scene__top" dangerouslySetInnerHTML={{ __html: top }} />
      <div className="season-scene__bottom" dangerouslySetInnerHTML={{ __html: village }} />
      <Snowfall night={night} />
    </div>
  )
}

// 멀리(작고 느림)·중간·가까이(크고 흐림) 세 겹. 속도는 초당 px. 개수는 390×844 화면 기준이다.
const LAYERS = [
  { count: 32, radius: [0.8, 1.5], speed: [14, 24], alpha: 0.8, blur: 0 },
  { count: 22, radius: [1.6, 2.5], speed: [24, 38], alpha: 0.9, blur: 1 },
  { count: 9, radius: [2.8, 4], speed: [38, 54], alpha: 0.95, blur: 3 },
]

/**
 * 캔버스로 그리는 눈.
 *
 * 화면 넓이에 맞춰 송이 수를 늘리되 너무 많아지지 않게 막는다. 브라우저 탭이 안 보이면
 * requestAnimationFrame이 저절로 멈춘다. "동작 줄이기"가 켜져 있으면 한 장면만 그린다.
 * 낮 하늘은 밝아서 흰 눈이 묻히므로 그림자를 조금 더 진하게 준다.
 */
function Snowfall({ night }) {
  const canvasRef = useRef(null)
  const nightRef = useRef(night)
  nightRef.current = night

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rand = (a, b) => a + Math.random() * (b - a)
    let width = 0
    let height = 0
    let flakes = []
    let frame = 0
    let last = performance.now()

    function resize() {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const density = Math.min(3, (width * height) / (390 * 844))
      flakes = LAYERS.flatMap((layer) => Array.from({ length: Math.round(layer.count * density) }, () => ({
        layer, x: rand(0, width), y: rand(0, height), r: rand(...layer.radius), v: rand(...layer.speed), p: rand(0, 6.28), s: rand(0.4, 1.1),
      })))
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = nightRef.current ? 'rgba(110,135,165,.55)' : 'rgba(90,115,150,.75)'
      for (const flake of flakes) {
        ctx.globalAlpha = flake.layer.alpha
        ctx.shadowBlur = flake.layer.blur + 2
        ctx.beginPath()
        ctx.arc(flake.x + Math.sin(time / 1400 * flake.s + flake.p) * 6 * flake.s, flake.y, flake.r, 0, 6.283)
        ctx.fill()
      }
    }

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      for (const flake of flakes) {
        flake.y += flake.v * dt
        flake.x += 6 * dt
        if (flake.y > height + 6) { flake.y = -6; flake.x = rand(0, width) }
        if (flake.x > width + 6) flake.x = -6
      }
      draw(now)
      frame = requestAnimationFrame(tick)
    }

    resize()
    draw(0)
    const observer = new ResizeObserver(() => { resize(); draw(performance.now()) })
    observer.observe(canvas)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!still) frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="season-scene__snow" />
}
