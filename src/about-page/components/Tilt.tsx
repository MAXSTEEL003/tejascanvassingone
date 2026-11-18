import { useRef, type ReactNode } from "react"
import { isFinePointer, prefersReducedMotion } from "../lib/perf"

export default function Tilt({
  children,
  max = 6,
  className = "",
}: {
  children: ReactNode
  max?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const ok = () => isFinePointer() && !prefersReducedMotion()
  return (
    <div
      ref={ref}
      className={`transition-transform duration-300 ease-out [transform-style:preserve-3d] ${className}`}
      onPointerMove={(e) => {
        if (!ok()) return
        const r = ref.current!.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        ref.current!.style.transform = `perspective(1000px) rotateY(${x * max}deg) rotateX(${-y * max}deg)`
      }}
      onPointerLeave={() => {
        if (ref.current) ref.current.style.transform = ""
      }}
    >
      {children}
    </div>
  )
}
