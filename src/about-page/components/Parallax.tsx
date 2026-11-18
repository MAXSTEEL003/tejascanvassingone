import { useEffect, useRef, type ReactNode } from "react"
import { prefersReducedMotion } from "../lib/perf"
import { onSmoothScroll } from "../lib/smooth"

export default function Parallax({
  children,
  speed = 0.15,
  className = "",
}: {
  children: ReactNode
  speed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return
      el.style.transform = `translate3d(0, ${(r.top + r.height / 2 - window.innerHeight / 2) * -speed}px, 0)`
    }

    update()

    // Sync directly with Lenis smooth scroll tick
    const unsubLenis = onSmoothScroll(() => {
      update()
    })

    // Fallback native listeners for resize
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, { passive: true })

    return () => {
      unsubLenis()
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update)
    }
  }, [speed])

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  )
}
