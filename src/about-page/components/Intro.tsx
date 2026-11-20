import { useEffect, useState } from "react"
import { prefersReducedMotion } from "../lib/perf"

export default function Intro() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">(() =>
    prefersReducedMotion() ? "gone" : "in",
  )
  useEffect(() => {
    if (phase === "gone") return
    const a = setTimeout(() => setPhase("out"), 850)
    const b = setTimeout(() => setPhase("gone"), 1450)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  if (phase === "gone") return null
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-ink transition-transform duration-[600ms] ease-[cubic-bezier(.76,0,.24,1)]"
      style={{ transform: phase === "out" ? "translateY(-100%)" : "none" }}
    >
      <div className="flex flex-col items-center gap-5">
        <span className="rise grid h-16 w-16 place-items-center rounded-full border border-gold/60 font-display text-3xl italic text-gold">
          T
        </span>
        <span
          className="rise eyebrow text-sand"
          style={{ animationDelay: ".15s" }}
        >
          Tejas Canvassing
        </span>
        <span
          className="block h-px w-40 origin-left bg-gold"
          style={{ animation: "rise .85s var(--ease-out) both" }}
        />
      </div>
    </div>
  )
}
