import { useEffect, useState, useRef } from "react"
import { prefersReducedMotion } from "../lib/perf"

function WheatIcon({ className = "h-7 w-7 text-gold" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2v20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 2.5C10.6 4.2 10.6 6 12 7.5C13.4 6 13.4 4.2 12 2.5Z" />
      <path d="M11.2 6.8C8.8 6.5 7.6 8.5 8.7 10.5C10 9.8 10.8 8.6 11.2 6.8Z" />
      <path d="M12.8 6.8C15.2 6.5 16.4 8.5 15.3 10.5C14 9.8 13.2 8.6 12.8 6.8Z" />
      <path d="M11.2 11.2C8.8 10.9 7.6 12.9 8.7 14.9C10 14.2 10.8 13 11.2 11.2Z" />
      <path d="M12.8 11.2C15.2 10.9 16.4 12.9 15.3 14.9C14 14.2 13.2 13 12.8 11.2Z" />
      <path d="M11.2 15.6C8.8 15.3 7.6 17.3 8.7 19.3C10 18.4 10.8 17.2 11.2 15.6Z" />
      <path d="M12.8 15.6C15.2 15.3 16.4 17.3 15.3 19.3C14 18.4 13.2 17.2 12.8 15.6Z" />
    </svg>
  )
}

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

          {/* Central Frosted Capsule */}
          <div className="relative grid h-20 w-20 place-items-center rounded-full border border-gold/50 bg-[#16120d]/90 shadow-[0_0_36px_rgba(217,164,65,0.22)] backdrop-blur-md">
            <WheatIcon className="h-9 w-9 text-gold transition-transform duration-500 hover:scale-105" />
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
