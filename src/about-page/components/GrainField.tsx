import { useEffect, useRef } from "react"

export default function GrainField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext("2d")!
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    let W = 0,
      H = 0,
      raf = 0
    const mouse = { x: -999, y: -999 }
    const dpr = Math.min(devicePixelRatio || 1, 2)
    type P = {
      x: number
      y: number
      vx: number
      vy: number
      s: number
      a: number
      va: number
      o: number
      g: boolean
    }
    let ps: P[] = []
    const resize = () => {
      W = c.clientWidth
      H = c.clientHeight
      c.width = W * dpr
      c.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.min(Math.floor((W * H) / 9000), 160)
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.1 - Math.random() * 0.3,
        s: 4 + Math.random() * 12,
        a: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 0.01,
        o: 0.15 + Math.random() * 0.6,
        g: Math.random() < 0.3,
      }))
    }
    let isVisible = true
    const io = new IntersectionObserver(([entry]) => {
      const prev = isVisible
      isVisible = entry.isIntersecting
      if (!prev && isVisible && !reduce) {
        raf = requestAnimationFrame(draw)
      }
    })
    io.observe(c)

    const draw = () => {
      if (!isVisible) return
      ctx.clearRect(0, 0, W, H)
      for (const p of ps) {
        const dx = p.x - mouse.x,
          dy = p.y - mouse.y,
          d = Math.hypot(dx, dy)
        if (d < 160) {
          const f = (160 - d) / 160
          p.vx += (dx / d) * f * 0.5
          p.vy += (dy / d) * f * 0.5
        }
        p.vx *= 0.97
        p.vy = p.vy * 0.97 + -0.004
        p.x += p.vx
        p.y += p.vy
        p.a += p.va + p.vx * 0.02
        if (p.y < -20) {
          p.y = H + 20
          p.x = Math.random() * W
        }
        if (p.x < -20) p.x = W + 20
        if (p.x > W + 20) p.x = -20
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.a)
        ctx.globalAlpha = p.o
        ctx.fillStyle = p.g ? "#d9a441" : "#f4ead3"
        ctx.beginPath()
        ctx.ellipse(0, 0, p.s, p.s * 0.2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      if (!reduce && isVisible) raf = requestAnimationFrame(draw)
    }
    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    resize()
    draw()
    addEventListener("resize", resize)
    addEventListener("pointermove", move)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      removeEventListener("resize", resize)
      removeEventListener("pointermove", move)
    }
  }, [])
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
