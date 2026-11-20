import { useEffect, useState, useRef } from "react"
import { prefersReducedMotion } from "../lib/perf"


export default function Intro() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">(() =>
    prefersReducedMotion() ? "gone" : "in"
  )
  const [progress, setProgress] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase === "gone") return

    // Smooth progress interpolation from 0 to 100 over ~900ms
    const startTime = performance.now()
    const duration = 900

    const update = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      setProgress(Math.round(eased * 100))

      if (p < 1) {
        animRef.current = requestAnimationFrame(update)
      } else {
        // Hold briefly at 100%, then initiate smooth dissolve
        setTimeout(() => {
          setPhase("out")
        }, 150)
      }
    }

    animRef.current = requestAnimationFrame(update)

    // Complete removal after transition completes
    const goneTimer = setTimeout(() => {
      setPhase("gone")
    }, 1800)

    // Allow instant dismiss on click or keyboard
    const dismiss = () => {
      setPhase("out")
      setTimeout(() => setPhase("gone"), 700)
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        dismiss()
      }
    }

    window.addEventListener("keydown", handleKey)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      clearTimeout(goneTimer)
      window.removeEventListener("keydown", handleKey)
    }
  }, [phase])

  if (phase === "gone") return null

  return (
    <div
      aria-hidden="true"
      onClick={() => {
        setPhase("out")
        setTimeout(() => setPhase("gone"), 700)
      }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0806] select-none cursor-pointer overflow-hidden"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transform: phase === "out" ? "scale(1.03)" : "scale(1)",
        pointerEvents: phase === "out" ? "none" : "auto",
        transition: "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "opacity, transform",
        backfaceVisibility: "hidden"
      }}
    >
      {/* Warm Ambient Radial Glow */}
      <div 
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,164,65,0.18)_0%,rgba(10,8,6,0)_70%)] transition-opacity duration-1000"
        style={{ opacity: phase === "out" ? 0 : 1 }}
      />

      {/* Subtle Grain Sheen */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="relative flex flex-col items-center gap-6 px-6 text-center max-w-sm">
        {/* Emblem Badge with Radiant Glow */}
        <div className="relative flex items-center justify-center">
          {/* Subtle Outer Halo */}
          <div className="absolute -inset-2 rounded-full bg-gold/15 blur-xl animate-pulse" />
          
          {/* Rotating Specular Ring */}
          <div className="absolute -inset-1 rounded-full border border-gold/30 animate-[spin_12s_linear_infinite]" />

          {/* Central Frosted Capsule with Official Logo */}
          <div className="relative w-20 h-20 rounded-2xl border border-gold/50 bg-white/10 p-2 shadow-[0_0_36px_rgba(217,164,65,0.25)] backdrop-blur-md flex items-center justify-center">
            <img src="/logo.png" alt="Tejas Canvassing" className="w-full h-full object-contain drop-shadow" />
          </div>
        </div>

        {/* Brand Name & Eyebrow */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.32em] text-ivory font-medium">
            TEJAS CANVASSING
          </span>
          <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.22em] uppercase text-sand/80">
            Aged · Graded · Guarded · Est. 2008
          </span>
        </div>

        {/* Slender Golden Progress Hairline */}
        <div className="flex flex-col items-center gap-2 mt-2 w-full max-w-[210px]">
          <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/40 via-gold to-gold-light shadow-[0_0_12px_rgba(217,164,65,0.8)] transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between w-full font-mono text-[9px] tracking-widest text-sand/60">
            <span>APMC YESHWANTHPUR</span>
            <span className="text-gold font-medium">{progress}%</span>
          </div>
        </div>

        {/* Discreet skip hint */}
        <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-sand/30 pt-1">
          Click or press any key to enter
        </span>
      </div>
    </div>
  )
}
