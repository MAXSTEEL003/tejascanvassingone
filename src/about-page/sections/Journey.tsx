import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import {
  GrainViewer3D as GrainViewer,
  FinalScene3D as FinalScene,
} from "../components/Lazy3D"
import { VARIETIES, MAX_MM } from "../data"
import { scrollToY, onSmoothScroll, getLenis } from "../lib/smooth"

import harvestSunsetImg from "../assets/rice-harvest-sunset.webp"

/* ---------- assets ---------- */
const U = (id: string, w = 1800) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&fit=crop&auto=format&q=72`
const IMG = {
  grainBefore: U("1728895604559-a4e16081504e", 1800),
  sunsetHarvest: harvestSunsetImg,
  sack: U("1645331465778-eb409d112198", 1400),
  scoop: U("1711060266983-92bd378c850c", 1400),
  pile: U("1686820740687-426a7b9b2043", 1400),
  pile2: U("1723475158232-819e29803f4d", 1400),
}

/* ---------- math ---------- */
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const ez = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const s = (p: number, a: number, b: number) => ez(seg(p, a, b))
const win = (p: number, a: number, b: number, c: number, d: number) =>
  s(p, a, b) * (1 - s(p, c, d))

const RM =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
const M = RM ? 0 : 1 // motion multiplier for zoom / parallax

const TOTAL_VH = 1600
const CHAPTERS = [
  { name: "Farm & Harvest", at: 0.0 },
  { name: "Grain", at: 0.52 },
  { name: "Process", at: 0.74 },
  { name: "Product", at: 0.92 },
]

/* ---------- smoothed scroll progress ---------- */
function useStageProgress(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ p: 0, past: false })
  useEffect(() => {
    let target = 0
    let pastTarget = false
    let cur = 0
    let raf = 0
    const loop = () => {
      raf = 0
      cur += (target - cur) * (RM ? 1 : 0.14)
      if (Math.abs(target - cur) < 0.00008) cur = target
      setState((prev) =>
        Math.abs(prev.p - cur) < 0.0001 && prev.past === pastTarget
          ? prev
          : { p: cur, past: pastTarget },
      )
      if (cur !== target) raf = requestAnimationFrame(loop)
    }
    const read = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      target = clamp(-r.top / Math.max(1, r.height - window.innerHeight))
      pastTarget = r.bottom < window.innerHeight * 0.5
      // If jumping (e.g. from nav directly to Collection), snap progress immediately without animating intermediate frames
      if (Math.abs(target - cur) > 0.25 || pastTarget) {
        cur = target
        setState({ p: cur, past: pastTarget })
        if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
        return
      }
      if (!raf) raf = requestAnimationFrame(loop)
    }
    read()
    cur = target
    const unsubLenis = onSmoothScroll(() => read())
    window.addEventListener("scroll", read, { passive: true })
    window.addEventListener("resize", read)
    return () => {
      unsubLenis()
      window.removeEventListener("scroll", read)
      window.removeEventListener("resize", read)
      cancelAnimationFrame(raf)
    }
  }, [ref])
  return state
}

/* ---------- grain illustration ---------- */
function Grain({
  v,
  className = "",
  svgRef,
  sheenRef,
}: {
  v: typeof VARIETIES[number]
  className?: string
  svgRef?: RefObject<SVGSVGElement | null>
  sheenRef?: RefObject<SVGGElement | null>
}) {
  const W = 300 * v.length + 120
  const H = 100
  const id = "g" + useId().replace(/:/g, "")
  const body = `M2 50 C ${W * 0.1} 6, ${W * 0.62} -2, ${W - 2} 50 C ${W * 0.62} 102, ${W * 0.1} 94, 2 50 Z`
  return (
    <svg
      ref={svgRef}
      viewBox={`-4 -8 ${W + 8} ${H + 16}`}
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id + "b"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v.tone[0]} />
          <stop offset="0.55" stopColor={v.tone[1]} />
          <stop offset="1" stopColor={v.tone[2]} />
        </linearGradient>
        <linearGradient id={id + "e"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={v.tone[2]} stopOpacity=".5" />
          <stop offset="0.15" stopColor={v.tone[2]} stopOpacity="0" />
          <stop offset="0.85" stopColor={v.tone[2]} stopOpacity="0" />
          <stop offset="1" stopColor={v.tone[2]} stopOpacity=".55" />
        </linearGradient>
        <radialGradient id={id + "s"}>
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id + "c"}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill={`url(#${id}b)`} />
      <g clipPath={`url(#${id}c)`}>
        <path d={body} fill={`url(#${id}e)`} />
        {[0.3, 0.5, 0.7].map((f, i) => (
          <path
            key={i}
            d={`M6 ${H * f} C ${W * 0.3} ${H * f - 8 * (1 - f)}, ${W * 0.65} ${H * f - 8 * (1 - f)}, ${W - 6} ${H * 0.5 + (f - 0.5) * 12}`}
            stroke={v.tone[2]}
            strokeOpacity={i === 1 ? 0.5 : 0.25}
            strokeWidth={i === 1 ? 1.6 : 1}
            fill="none"
          />
        ))}
        <g ref={sheenRef}>
          <ellipse
            cx={W * 0.42}
            cy="24"
            rx={W * 0.28}
            ry="12"
            fill={`url(#${id}s)`}
          />
        </g>
        <path
          d={`M2 50 C ${W * 0.1} 94, ${W * 0.62} 102, ${W - 2} 50`}
          stroke="#6b5636"
          strokeOpacity=".22"
          strokeWidth="10"
          fill="none"
          style={{ filter: "blur(5px)" }}
        />
      </g>
    </svg>
  )
}

/* ---------- small pieces ---------- */
function Label({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${
        light ? "text-white/80" : "text-gold"
      }`}
    >
      {children}
    </span>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M12 22V8M12 8c-3-1-4-4-4-6 3 0 4 3 4 6zm0 0c3-1 4-4 4-6-3 0-4 3-4 6zm0 6c-3-1-4-3-4-5m4 5c3-1 4-3 4-5m-4 9c-2-1-3-2-3-4m3 4c2-1 3-2 3-4" />
      </svg>
      <span className="text-[12px] font-semibold uppercase tracking-[0.3em]">
        Tejas Canvassing
      </span>
    </div>
  )
}

const layer = (o: number): React.CSSProperties => ({
  opacity: o,
  visibility: o < 0.005 ? "hidden" : "visible",
  pointerEvents: o > 0.6 ? "auto" : "none",
})

/* ---------- Scene 1 : Farm & Harvest (Merged) ---------- */
function FarmHarvest({ p }: { p: number }) {
  // Overall scene visibility
  const out = 1 - s(p, 0.38, 0.45)

  // Phase 1: Farm landscape (p: 0.0 -> 0.22)
  const zFarm = 1 + 1.8 * s(p, 0, 0.22) * M
  const farmOp = 1 - s(p, 0.16, 0.26)
  const introHead = 1 - s(p, 0.02, 0.1)
  const scrollCue = 1 - s(p, 0.01, 0.07)

  // Phase 2: Harvest hands & field inspection (p: 0.16 -> 0.44)
  const harvestArrive = s(p, 0.16, 0.26)
  const zHarvest =
    (1.35 - 0.35 * harvestArrive) * (1 + 1.2 * s(p, 0.26, 0.42)) * (M ? 1 : 1.0)
  const harvestBlur = (1 - harvestArrive) * 8 * M

  // Mid-phase feature cards/quote (p: 0.09 -> 0.22)
  const midQuote = win(p, 0.09, 0.13, 0.18, 0.22)

  // Phase 3: Harvest inspection text (p: 0.22 -> 0.36)
  const harvestText = win(p, 0.22, 0.27, 0.33, 0.37)

  // Transition callout: "Now, look closer." (p: 0.34 -> 0.44)
  const lookCloser = win(p, 0.34, 0.38, 0.41, 0.45)

  return (
    <div
      className="absolute inset-0 bg-earth overflow-hidden"
      style={layer(out)}
    >
      {/* Background 1: Golden grain field photo retained first */}
      <img
        src={IMG.grainBefore}
        alt="Lush golden rice grain field at sunrise"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover will-change-transform"
        style={{
          opacity: farmOp,
          transform: `scale(${zFarm}) translate3d(0, ${-s(p, 0, 0.22) * 4 * M}%, 0)`,
          transformOrigin: "50% 64%",
        }}
      />

      {/* Background 2: Sunset harvest image requested by user placed right after */}
      <img
        src={IMG.sunsetHarvest}
        alt="Farmers harvesting golden paddy in water at sunset"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover will-change-transform"
        style={{
          opacity: harvestArrive,
          transform: `scale(${M ? zHarvest : 1})`,
          transformOrigin: "50% 56%",
          filter: `blur(${harvestBlur}px)`,
        }}
      />

      {/* Ambient gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/15 to-black/75" />

      {/* 1. Intro Hero Section (Phase 1) */}
      <div
        className="absolute inset-x-4 sm:inset-x-6 bottom-[12vh] sm:bottom-[17vh] max-w-2xl text-white md:left-12"
        style={{
          opacity: introHead,
          transform: `translate3d(0, ${(1 - introHead) * -40}px, 0)`,
          pointerEvents: introHead > 0.5 ? "auto" : "none",
        }}
      >
        <div
          className="rise flex flex-wrap items-center gap-2 sm:gap-3"
          style={{ animationDelay: ".1s" }}
        >
          <Label light>Scene 01 · Farm & Harvest</Label>
          <span className="hidden h-px w-6 bg-white/30 sm:inline-block" />
          <span className="hidden rounded-full border border-gold/40 bg-black/40 px-3 py-0.5 text-[11px] font-mono uppercase tracking-[0.2em] text-gold backdrop-blur-md sm:inline-block">
            Karnal & Wada Terroir
          </span>
        </div>
        <h1 className="mt-3 sm:mt-4 text-[clamp(2.2rem,7.5vw,6.5rem)] font-light leading-[0.98] tracking-tight">
          <span className="rise block" style={{ animationDelay: ".25s" }}>
            From the Earth,
          </span>
          <span
            className="rise block font-serif italic text-gold/90"
            style={{ animationDelay: ".45s" }}
          >
            to Your Table.
          </span>
        </h1>
        <p
          className="rise mt-3 sm:mt-5 max-w-md text-sm sm:text-base leading-relaxed text-white/90"
          style={{ animationDelay: ".7s" }}
        >
          Discover the journey behind every grain — nurtured in sun-drenched
          alluvial soils and hand-reaped at golden hour by master growers.
        </p>
      </div>

      {/* Scroll indicator */}
      <div
        className="rise absolute bottom-6 sm:bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 sm:gap-2 text-white/80"
        style={{
          opacity: scrollCue,
          animationDelay: "1.1s",
          pointerEvents: "none",
        }}
      >
        <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em]">
          Scroll to Explore
        </span>
        <span className="scroll-cue block h-6 sm:h-8 w-px bg-white/80" />
      </div>

      {/* 2. Mid Quote & Provenance Badges (Phase 1 -> 2 transition) */}
      <div
        className="absolute inset-x-4 sm:inset-x-6 top-1/2 max-w-2xl text-white md:left-12"
        style={{
          opacity: midQuote,
          transform: `translate3d(0, ${-50 + (1 - midQuote) * 12}px, 0)`,
          pointerEvents: midQuote > 0.5 ? "auto" : "none",
        }}
      >
        <p className="font-serif text-2xl sm:text-3xl md:text-5xl italic leading-tight text-white">
          "Every stalk carries a season of patience."
        </p>
        <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-black/40 px-3 py-0.5 sm:px-3.5 sm:py-1 text-gold backdrop-blur-md font-mono text-[10px] sm:text-[11px] uppercase tracking-wider">
            Direct Farm Gate Sourcing
          </span>
          <span className="inline-flex items-center rounded-full border border-white/20 bg-black/40 px-3 py-0.5 sm:px-3.5 sm:py-1 text-white/80 backdrop-blur-md font-mono text-[10px] sm:text-[11px] uppercase tracking-wider">
            Peak Moisture Reaping
          </span>
        </div>
      </div>

      {/* 3. Harvest Inspection Section (Phase 2) */}
      <div
        className="absolute inset-x-4 sm:inset-x-6 bottom-[12vh] sm:bottom-[14vh] max-w-xl text-white md:left-12"
        style={{
          opacity: harvestText,
          transform: `translate3d(0, ${(1 - harvestText) * 28}px, 0)`,
          pointerEvents: harvestText > 0.5 ? "auto" : "none",
        }}
      >
        <div className="flex items-center gap-2">
          <Label light>Hand Harvested & Inspected</Label>
        </div>
        <h2 className="mt-2.5 sm:mt-3 text-[clamp(2rem,5.5vw,4.4rem)] font-light leading-tight tracking-tight">
          Gathered by hand,
          <br />
          <span className="font-serif italic text-gold/90">judged by eye.</span>
        </h2>
        <p className="mt-3 sm:mt-4 max-w-sm text-xs sm:text-sm leading-relaxed text-white/85 md:text-base">
          Each lot is cut at peak moisture, sourced from trusted growers we have
          known for decades, and graded directly at the field edge.
        </p>
      </div>

      {/* 4. Look closer prompt segueing to Scene 2 */}
      <div
        className="absolute inset-x-0 top-[38%] text-center text-white px-4"
        style={{
          opacity: lookCloser,
          transform: `scale(${0.96 + lookCloser * 0.04})`,
          pointerEvents: "none",
        }}
      >
        <p className="font-serif text-3xl sm:text-4xl italic md:text-6xl text-gold">
          Now, look closer.
        </p>
        <p className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/70">
          Anatomy of the Grain ahead
        </p>
      </div>
    </div>
  )
}

/* ---------- Scene 3 : explore the grain ---------- */
function Explore({
  p,
  sel,
  setSel,
}: {
  p: number
  sel: number
  setSel: (n: number) => void
}) {
  const v = VARIETIES[sel]
  const o = s(p, 0.4, 0.47) * (1 - s(p, 0.69, 0.72))
  const entry = s(p, 0.41, 0.5)
  const ui = s(p, 0.47, 0.53) * (1 - s(p, 0.6, 0.64))
  const exit = s(p, 0.62, 0.71)
  const active = o > 0.02 && exit < 0.98
  const [touched, setTouched] = useState(false)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setSel((sel + 1) % VARIETIES.length)
    if (e.key === "ArrowLeft")
      setSel((sel + VARIETIES.length - 1) % VARIETIES.length)
  }

  const scale = (0.3 + 0.7 * entry) * (1 + exit * exit * 7)
  const blur = (1 - entry) * 14 * M

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink" style={layer(o)}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 64% 48%, #2b2013 0%, #15110b 52%, #0a0806 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 42% 38% at 66% 46%, ${v.tone[2]}40, transparent 72%)`,
          opacity: ui,
        }}
      />

      <div
        key={v.name}
        className="ghost-in pointer-events-none absolute inset-x-0 top-[26%] select-none whitespace-nowrap text-center font-serif italic leading-none text-gold/[0.07]"
        style={{ fontSize: "clamp(4.5rem,20vw,22rem)", opacity: ui }}
      >
        {v.name.split(" ")[0]}
      </div>

      <div className="relative mx-auto grid h-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-1 sm:gap-2 px-4 sm:px-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-8 pt-16 sm:pt-20 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] md:grid-rows-[minmax(0,1fr)_auto] md:gap-x-10 md:px-12 md:pt-24">
        <div
          className="min-w-0 md:self-center"
          style={{
            opacity: ui,
            transform: `translate3d(0, ${(1 - ui) * 30}px, 0)`,
          }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Label>Scene 02 · Anatomy of the Grain</Label>
            <span className="h-px w-6 sm:w-8 bg-ivory/25" />
            <span className="whitespace-nowrap text-[10px] sm:text-[11px] tabular-nums tracking-[0.2em] text-ivory/55">
              0{sel + 1} / 0{VARIETIES.length}
            </span>
          </div>
          <h2
            key={v.name}
            className="rise mt-2 sm:mt-3 text-[clamp(1.8rem,4.5vw,3.8rem)] font-light leading-[1.02] tracking-tight"
          >
            {v.name}
          </h2>
          <p
            key={v.note}
            className="rise mt-1.5 sm:mt-2 max-w-sm text-xs sm:text-sm leading-relaxed text-ivory/75 md:text-base line-clamp-2 sm:line-clamp-none"
            style={{ animationDelay: ".08s" }}
          >
            {v.note}
          </p>

          {/* Desktop variety list */}
          <div className="mt-4 hidden md:block">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ivory/60">
              Select Variety to Inspect ({VARIETIES.length} Available)
            </div>
            <div className="space-y-1.5 max-w-sm">
              {VARIETIES.map((x, i) => (
                <button
                  key={x.name}
                  onClick={() => setSel(i)}
                  className={`group flex min-h-[32px] w-full items-center gap-3 rounded-lg border px-3 py-1.5 text-left transition-all ${
                    i === sel
                      ? "border-gold bg-gold text-ink shadow-sm"
                      : "border-gold/20 bg-ivory/[0.02] text-ivory hover:border-gold/60 hover:bg-ivory/5"
                  }`}
                  aria-label={`Select ${x.name}`}
                >
                  <span className="w-24 shrink-0 text-xs font-medium">
                    {x.name}
                  </span>
                  <span className="relative h-[4px] flex-1 rounded-full bg-ivory/15">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                        i === sel
                          ? "bg-gold"
                          : "bg-ivory/40 group-hover:bg-ivory/70"
                      }`}
                      style={{ width: `${(x.mm / MAX_MM) * 100}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums opacity-75">
                    {x.len}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-ivory/60">
                {v.name} Base Geometry (Reference Dimensions)
              </div>
              <div className="grid max-w-sm grid-cols-3 gap-2">
                <div className="rounded-lg border border-gold/25 bg-ivory/[0.04] p-2 text-center">
                  <span className="block text-[9px] uppercase tracking-wider text-ivory/50">
                    Length
                  </span>
                  <span className="font-serif text-base font-medium text-ivory">
                    {v.len}
                  </span>
                </div>
                <div className="rounded-lg border border-gold/25 bg-ivory/[0.04] p-2 text-center">
                  <span className="block text-[9px] uppercase tracking-wider text-ivory/50">
                    Width
                  </span>
                  <span className="font-serif text-base font-medium text-ivory">
                    {v.width} mm
                  </span>
                </div>
                <div className="rounded-lg border border-gold/25 bg-ivory/[0.04] p-2 text-center">
                  <span className="block text-[9px] uppercase tracking-wider text-ivory/50">
                    Thickness
                  </span>
                  <span className="font-serif text-base font-medium text-ivory">
                    {v.thickness} mm
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Grain Canvas Container */}
        <div
          className="relative min-h-[190px] xs:min-h-[220px] sm:min-h-[260px] md:min-h-0 min-w-0"
          role="img"
          aria-label={`${v.name} rice grain in 3D. Drag horizontally to rotate.`}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${scale})`,
              filter: `blur(${blur}px)`,
              opacity: 1 - s(p, 0.66, 0.705),
            }}
          >
            <GrainViewer
              mm={v.mm}
              width={v.width}
              thickness={v.thickness}
              color={v.tone[0]}
              active={active}
              onTouch={() => setTouched(true)}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-[1%] flex flex-col items-center"
            style={{ opacity: ui * (1 - seg(p, 0.6, 0.62)) }}
          >
            <div
              className="relative h-2.5 sm:h-3 transition-all duration-500"
              style={{ width: `${Math.round((v.mm / MAX_MM) * 160 + 40)}px` }}
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-ivory/35" />
              <span className="absolute left-0 top-0 h-full w-px bg-ivory/50" />
              <span className="absolute right-0 top-0 h-full w-px bg-ivory/50" />
            </div>
            <span className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] tabular-nums tracking-[0.16em] sm:tracking-[0.2em] text-ivory/70">
              {v.len} × {v.width}mm × {v.thickness}mm
            </span>
          </div>

          <div
            className="pointer-events-none absolute right-0 top-1 sm:top-3 flex items-center gap-1.5 whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-ivory/50 transition-opacity duration-500"
            style={{ opacity: touched ? 0 : ui }}
          >
            <span className="nudge inline-block">⟷</span> Drag in 3D
          </div>
        </div>

        {/* Variety Selector and Specs Bar (Visible across mobile and desktop) */}
        <div
          className="min-w-0 md:col-span-2"
          style={{
            opacity: ui,
            transform: `translate3d(0, ${(1 - ui) * 40}px, 0)`,
          }}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-gold/20 pt-2 text-xs md:grid-cols-4 md:text-sm sm:gap-x-6 sm:pt-3">
            {[
              ["Variety Type", v.specs.varietyType],
              ["Grain Texture", v.texture.split("(")[0].trim()],
              ["Aroma Profile", v.aroma],
              ["Ageing Process", v.aged],
            ].map(([k, val]) => (
              <div key={k}>
                <dt className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-ivory/50">
                  {k}
                </dt>
                <dd key={val} className="rise mt-0.5 font-medium text-ivory truncate">
                  {val}
                </dd>
              </div>
            ))}
          </dl>
          <div
            className="no-scrollbar -mx-4 sm:-mx-6 mt-2.5 sm:mt-3.5 flex w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] min-w-0 gap-1.5 sm:gap-2 overflow-x-auto px-4 sm:px-6 md:mx-0 md:grid md:w-full md:grid-cols-5 md:px-0"
            role="tablist"
            aria-label="Rice variety"
            onKeyDown={onKey}
          >
            {VARIETIES.map((x, i) => (
              <button
                key={x.name}
                role="tab"
                aria-selected={i === sel}
                tabIndex={i === sel ? 0 : -1}
                onClick={() => setSel(i)}
                className={`group relative flex min-h-[44px] shrink-0 items-center gap-2 sm:gap-2.5 overflow-hidden rounded-full border px-3.5 py-2.5 text-left text-xs transition-all duration-500 md:justify-center ${
                  i === sel
                    ? "border-gold bg-gold text-ink shadow-md shadow-gold/20 font-medium"
                    : "border-gold/25 text-ivory/80 hover:border-gold/70 hover:bg-ivory/10"
                }`}
              >
                <span
                  className="h-2 shrink-0 rounded-[50%] transition-transform duration-500 group-hover:scale-110"
                  style={{
                    width: 6 + (x.mm / MAX_MM) * 14,
                    background: `linear-gradient(${x.tone[0]}, ${x.tone[2]})`,
                    border: "1px solid rgba(0,0,0,.4)",
                  }}
                />
                <span className="whitespace-nowrap font-medium text-[11px] sm:text-xs">{x.name}</span>
                <span className="text-[9px] sm:text-[10px] opacity-60">({x.len})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Scene 4 ---------- */
const STAGES = [
  {
    t: "Cleaning",
    d: "Stones, husk fragments and dust are lifted away by air and sieve.",
    chip: "99.9% impurities removed",
    img: IMG.sack,
    pos: "50% 40%",
  },
  {
    t: "Dehusking & Polishing",
    d: "Gentle rollers lift the husk; polishing leaves a soft, even sheen.",
    chip: "Low-heat, low-breakage",
    img: IMG.scoop,
    pos: "50% 62%",
  },
  {
    t: "Sorting & Grading",
    d: "Optical sorters separate whole grains by length, colour and purity.",
    chip: "Colour + length optical sort",
    img: IMG.pile2,
    pos: "50% 50%",
  },
  {
    t: "Quality Inspection",
    d: "Every batch is sampled, measured and signed off by our quality team.",
    chip: "Lab-tested, every lot",
    img: IMG.pile,
    pos: "50% 50%",
  },
]

function Processing({
  p,
  sel,
  containerRef,
}: {
  p: number
  sel: number
  containerRef?: RefObject<HTMLElement | null>
}) {
  const v = VARIETIES[sel]
  const o = s(p, 0.66, 0.69) * (1 - s(p, 0.875, 0.915))
  const cream = 1 - s(p, 0.69, 0.75)
  const ui = s(p, 0.72, 0.76)
  const q = seg(p, 0.73, 0.86)
  const idx = Math.min(3, Math.floor(q * 4))
  const polished = idx >= 1

  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const isSeekingRef = useRef(false)
  const pendingTimeRef = useRef<number | null>(null)

  // Playback state & autostart tracker
  const [isPlaying, setIsPlaying] = useState(false)
  const hasAutoStartedRef = useRef(false)

  // User explicitly paused with the button vs temporarily paused by manual scrolling
  const [explicitlyPaused, setExplicitlyPaused] = useState(false)
  const idleTimerRef = useRef<number | null>(null)

  // Mark video ready on metadata load
  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      if (!isPlaying) video.pause()
      setVideoLoaded(true)
      setVideoError(false)
    }
  }

  // Handle cached or already-ready video element
  useEffect(() => {
    const video = videoRef.current
    if (video && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
      if (!isPlaying) video.pause()
      setVideoLoaded(true)
      setVideoError(false)
    }
  }, [isPlaying])

  // Toggle Auto Play / Pause with replay support
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      setExplicitlyPaused(true)
      video.pause()
      setIsPlaying(false)
    } else {
      setExplicitlyPaused(false)
      const topEl = containerRef?.current || document.getElementById("top")

      // If at or near the end of the process scene, rewind to Stage 01
      if (q >= 0.98) {
        video.currentTime = 0
        if (topEl) {
          const startScrollY = topEl.offsetTop + 0.73 * (topEl.offsetHeight - window.innerHeight)
          const lenis = getLenis()
          if (lenis) {
            lenis.scrollTo(startScrollY, { immediate: true })
          } else {
            window.scrollTo(0, startScrollY)
          }
        }
      }

      video
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch((err) => {
          console.debug("Autoplay prevented:", err)
        })
    }
  }

  // Auto-start playback on entering Scene 3
  useEffect(() => {
    if (
      p >= 0.73 &&
      p <= 0.76 &&
      videoLoaded &&
      !videoError &&
      !hasAutoStartedRef.current &&
      !explicitlyPaused &&
      !isPlaying
    ) {
      hasAutoStartedRef.current = true
      const video = videoRef.current
      if (video) {
        video
          .play()
          .then(() => {
            setIsPlaying(true)
          })
          .catch(() => {})
      }
    }

    // Reset auto-start flag when scrolled back above Scene 3
    if (p < 0.65) {
      hasAutoStartedRef.current = false
      setExplicitlyPaused(false)
    }
  }, [p, videoLoaded, videoError, isPlaying, explicitlyPaused])

  // Let the user scroll freely when interacting; automatically resume autoplay when idle
  useEffect(() => {
    const handleScrollGesture = () => {
      // User is actively trying to scroll -> let them scroll freely
      if (isPlaying) {
        const video = videoRef.current
        if (video) video.pause()
        setIsPlaying(false)
      }

      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }

      // If user did not explicitly tap the Pause button, resume autoplay when scroll stops
      if (!explicitlyPaused && p >= 0.725 && p < 0.855) {
        idleTimerRef.current = window.setTimeout(() => {
          if (!explicitlyPaused && p >= 0.725 && p < 0.855) {
            const video = videoRef.current
            if (video && videoLoaded && !videoError) {
              video
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {})
            }
          }
        }, 1300)
      }
    }

    window.addEventListener("wheel", handleScrollGesture, { passive: true })
    window.addEventListener("touchstart", handleScrollGesture, { passive: true })
    window.addEventListener("touchmove", handleScrollGesture, { passive: true })

    return () => {
      window.removeEventListener("wheel", handleScrollGesture)
      window.removeEventListener("touchstart", handleScrollGesture)
      window.removeEventListener("touchmove", handleScrollGesture)
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
    }
  }, [isPlaying, explicitlyPaused, p, videoLoaded, videoError])

  // Synchronize page scroll to video playback when Auto Play is active
  useEffect(() => {
    if (!isPlaying) return

    let rafId = 0
    const video = videoRef.current
    const topEl = containerRef?.current || document.getElementById("top")

    const syncLoop = () => {
      if (!video || !topEl || video.paused || video.ended) {
        if (video?.ended) {
          setIsPlaying(false)
        }
        return
      }

      if (Number.isFinite(video.duration) && video.duration > 0) {
        const prog = clamp(video.currentTime / video.duration, 0, 1)

        // Stop auto-scroll when reaching the end of the 4th stage of Process
        if (prog >= 0.995 || q >= 0.998) {
          video.pause()
          setIsPlaying(false)
          return
        }

        // Map progress to Scene 3's range: p in [0.73, 0.86]
        const targetP = 0.73 + prog * (0.86 - 0.73)
        const targetScrollY = topEl.offsetTop + targetP * (topEl.offsetHeight - window.innerHeight)

        const lenis = getLenis()
        if (lenis) {
          lenis.scrollTo(targetScrollY, { immediate: true })
        } else {
          window.scrollTo(0, targetScrollY)
        }
      }

      rafId = requestAnimationFrame(syncLoop)
    }

    rafId = requestAnimationFrame(syncLoop)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isPlaying, containerRef, q])

  // Listen to seeked event to drain queued target timestamps without choking video decoder
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onSeeked = () => {
      isSeekingRef.current = false
      if (pendingTimeRef.current !== null) {
        const next = pendingTimeRef.current
        pendingTimeRef.current = null
        if (Math.abs(video.currentTime - next) >= 0.035) {
          isSeekingRef.current = true
          if ("fastSeek" in video && typeof (video as unknown as { fastSeek: (t: number) => void }).fastSeek === "function") {
            try {
              (video as unknown as { fastSeek: (t: number) => void }).fastSeek(next)
            } catch {
              video.currentTime = next
            }
          } else {
            video.currentTime = next
          }
        }
      }
    }

    video.addEventListener("seeked", onSeeked)
    return () => video.removeEventListener("seeked", onSeeked)
  }, [videoLoaded])

  // Scrub video frames linked directly to normalized scroll progress q (0.0 -> 1.0) when manual
  useEffect(() => {
    if (isPlaying) return
    const video = videoRef.current
    if (!video || !videoLoaded || videoError || o <= 0) return
    if (!Number.isFinite(video.duration) || video.duration <= 0) return

    const targetTime = clamp(q * video.duration, 0, Math.max(0, video.duration - 0.05))

    if (Math.abs(video.currentTime - targetTime) < 0.035) return

    if (isSeekingRef.current || video.seeking) {
      pendingTimeRef.current = targetTime
    } else {
      isSeekingRef.current = true
      if ("fastSeek" in video && typeof (video as unknown as { fastSeek: (t: number) => void }).fastSeek === "function") {
        try {
          (video as unknown as { fastSeek: (t: number) => void }).fastSeek(targetTime)
        } catch {
          video.currentTime = targetTime
        }
      } else {
        video.currentTime = targetTime
      }
    }
  }, [q, videoLoaded, videoError, o, isPlaying])

  return (
    <div className="absolute inset-0 bg-earth text-rice" style={layer(o)}>
      {/* Fallback image sequence (displays when processing.mp4 is not present or loading) */}
      {STAGES.map((st, i) => {
        const x =
          i === 0
            ? Math.max(q * 4, 0.5)
            : i === 3
              ? Math.min(q * 4, 3.5)
              : q * 4
        const op = clamp(1.6 - Math.abs(x - (i + 0.5)) * 2.2)
        const local = clamp(q * 4 - i, -0.5, 1.5)
        return (
          <img
            key={st.t}
            src={st.img}
            alt={st.t}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover will-change-transform transition-opacity duration-700"
            style={{
              opacity: (videoLoaded && !videoError ? 0 : op) * 0.62,
              objectPosition: st.pos,
              transform: `scale(${1.08 + local * 0.08 * M}) translate3d(${(0.5 - local) * 3 * M}%, 0, 0)`,
              filter:
                i === 0
                  ? "sepia(.35) brightness(.85)"
                  : i === 1
                    ? "saturate(.8) brightness(.85)"
                    : "brightness(.95)",
            }}
          />
        )
      })}

      {/* Scrub-synced Video layer */}
      {!videoError && (
        <video
          ref={videoRef}
          src="/processing.mp4"
          poster={IMG.sack}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => setVideoError(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 will-change-transform"
          style={{
            opacity: videoLoaded ? 0.65 : 0,
            filter: "brightness(.9) contrast(1.05)",
          }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-earth/85 via-earth/25 to-earth/95" />

      {/* dust */}
      {idx === 0 && !RM && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity: ui }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="dust absolute top-0 rounded-full bg-[#d7c08a]"
              style={{
                left: `${(i * 37) % 100}%`,
                width: 3 + (i % 3) * 2,
                height: 3 + (i % 3) * 2,
                animationDuration: `${5 + (i % 5)}s`,
                animationDelay: `${-(i * 0.7)}s`,
                ["--dx" as string]: `${(i % 2 ? 1 : -1) * (20 + i * 4)}px`,
              }}
            />
          ))}
        </div>
      )}
      {idx === 3 && !RM && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full">
          <div className="scan absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
        </div>
      )}

      <div
        className="relative mx-auto flex h-full max-w-6xl flex-col justify-between px-4 sm:px-6 md:px-12 pt-[calc(max(5.5rem,4.5rem+env(safe-area-inset-top,0px)))] pb-[calc(max(1.5rem,1rem+env(safe-area-inset-bottom,0px)))]"
        style={{ opacity: ui }}
      >
        <div style={{ transform: `translate3d(0, ${(1 - ui) * -24}px, 0)` }}>
          <div className="flex items-center justify-between gap-3">
            <Label light>Scene 03 · The Processing</Label>

            {/* Small Auto Play / Pause Button - permanently visible and anchored */}
            <button
              type="button"
              onClick={togglePlay}
              className="z-30 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-ink/90 text-gold shadow-lg backdrop-blur-md transition-all duration-300 hover:border-gold hover:bg-gold/20 hover:scale-105 active:scale-90"
              aria-label={isPlaying ? "Pause auto play" : q >= 0.98 ? "Replay process" : "Auto play"}
              title={isPlaying ? "Pause auto play" : q >= 0.98 ? "Replay process" : "Auto play"}
            >
              {isPlaying ? (
                <svg className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : q >= 0.98 ? (
                <svg className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24">
                  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
              ) : (
                <svg className="h-3 w-3 translate-x-0.5 fill-current sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
          <h2 className="mt-1.5 sm:mt-2 max-w-xl text-[clamp(1.5rem,4.5vw,3.6rem)] font-light leading-tight tracking-tight">
            Clean, calm, <span className="font-serif italic">exacting.</span>
          </h2>
        </div>

        <div style={{ transform: `translate3d(0, ${(1 - ui) * 40}px, 0)` }}>
          <div key={idx} className="rise mb-4 sm:mb-8 max-w-md">
            <div className="flex items-baseline gap-2.5 sm:gap-3">
              <span className="font-serif text-3xl italic text-gold sm:text-5xl md:text-7xl">
                0{idx + 1}
              </span>
              <span className="text-base font-medium sm:text-lg md:text-2xl">
                {STAGES[idx].t}
              </span>
            </div>
            <p className="mt-1.5 sm:mt-3 text-xs text-rice/85 sm:text-sm md:text-base line-clamp-2 md:line-clamp-none">
              {STAGES[idx].d}
            </p>
            <span className="mt-2.5 sm:mt-4 inline-block rounded-full border border-white/25 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-rice/80 backdrop-blur">
              {STAGES[idx].chip}
            </span>
          </div>

          <div className="relative h-8 sm:h-10">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
            <div
              className="absolute left-0 top-1/2 h-px bg-gold"
              style={{ width: `${q * 100}%` }}
            />
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-white/50 transition-colors duration-500"
                style={{
                  left: `calc(${i * 33.33}% )`,
                  background: q * 3 >= i - 0.01 ? "#b8914a" : "transparent",
                }}
              />
            ))}
            <div
              className="absolute top-1/2 w-12 sm:w-14 -translate-y-1/2 md:w-20"
              style={{
                left: `calc(${q * 100}% - ${q * 48}px)`,
                filter: polished
                  ? "brightness(1.08)"
                  : "brightness(.85) sepia(.3)",
                transition: "filter 1s",
              }}
            >
              <Grain v={v} className="block w-full" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 grid grid-cols-4 gap-1 sm:gap-2 text-[9px] uppercase tracking-[0.14em] sm:text-xs">
            {STAGES.map((st, i) => (
              <div
                key={st.t}
                className="transition-opacity duration-500"
                style={{
                  opacity: i === idx ? 1 : 0.4,
                  textAlign: i === 0 ? "left" : i === 3 ? "right" : "center",
                }}
              >
                {st.t.split(" &")[0]}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "#0a0806", opacity: cream }}
      />
    </div>
  )
}

/* ---------- Scene 4 : cinematic reveal (flagship bag & rice bowl) ---------- */
function Final({ p, sel }: { p: number; sel: number }) {
  const v = VARIETIES[sel] || VARIETIES[0]
  const t = seg(p, 0.885, 0.99)
  const o = s(p, 0.885, 0.91)
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 900,
  )
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900)
    window.addEventListener("resize", on)
    return () => window.removeEventListener("resize", on)
  }, [])

  // On desktop: info reveals concurrently. On mobile: bag gets full focus first (t < 0.60), then info reveals underneath
  const info = wide ? s(t, 0.55, 0.85) : s(t, 0.65, 0.92)
  const close = s(t, 0.86, 1)

  const rise = (k: number, d = 0) => ({
    opacity: seg(info, d, d + 0.6) * k,
    transform: `translate3d(0, ${(1 - seg(info, d, d + 0.6)) * 26}px, 0)`,
  })

  return (
    <div
      className="absolute inset-0"
      style={{
        ...layer(o),
        background:
          "radial-gradient(ellipse at 38% 55%, #2a1f12 0%, #14100b 55%, #0a0806 100%)",
      }}
    >
      {/* 3D Bag & Cascading Rice Bowl Canvas: given large, majestic viewport focus on mobile */}
      <div className="absolute inset-x-0 top-0 h-[68%] sm:h-[75%] md:inset-y-0 md:h-full">
        <FinalScene
          t={t}
          visible={o > 0.005}
          mm={v.mm}
          width={v.width}
          name={v.name}
          shift={wide ? 0.21 : 0}
        />
      </div>

      {/* Product Information: shown underneath after the bag is admired */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col justify-end px-4 sm:px-6 pb-[calc(max(2.5rem,1.5rem+env(safe-area-inset-bottom,0px)))] pt-12 md:pt-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent md:bg-none md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[38%] md:justify-center md:px-0 md:pr-14 md:pb-0 transition-opacity duration-500 ${
          info > 0.02 ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div>
          {/* Headings removed per user request: focus directly on the product name and details */}
          <h2
            className="text-[clamp(1.8rem,4.5vw,4.2rem)] font-light leading-[1.02] tracking-tight"
            style={rise(1, 0.05)}
          >
            {v.name}
          </h2>
          <p
            className="mt-0.5 sm:mt-1 font-serif text-sm sm:text-base italic text-gold md:text-lg"
            style={rise(1, 0.1)}
          >
            {v.subname}
          </p>
          <p
            className="mt-1.5 sm:mt-2 max-w-sm text-xs sm:text-sm text-ivory/75 md:mt-3 md:text-base line-clamp-2 sm:line-clamp-none"
            style={rise(1, 0.15)}
          >
            {v.note}
          </p>
          <dl
            className="mt-2.5 sm:mt-4 grid max-w-sm grid-cols-3 gap-x-2 sm:gap-x-4 border-t border-gold/20 pt-2 sm:pt-3 text-xs sm:text-sm md:mt-6 md:pt-4"
            style={rise(1, 0.25)}
          >
            {[
              ["Length", v.len],
              ["Texture", v.texture.split("(")[0].trim()],
              ["Packing", v.bagWeight],
            ].map(([k, val]) => (
              <div key={k}>
                <dt className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-sand truncate">
                  {k}
                </dt>
                <dd className="mt-0.5 font-medium truncate">{val}</dd>
              </div>
            ))}
          </dl>
          <div
            className="mt-3 sm:mt-4 grid max-w-sm grid-cols-2 gap-2 md:mt-6 md:gap-3"
            style={rise(1, 0.35)}
          >
            <a
              href="#collection"
              className="flex min-h-[48px] items-center justify-center rounded-full bg-gold px-3 sm:px-4 py-3 sm:py-3.5 text-center text-xs sm:text-sm font-medium text-ink transition hover:bg-ivory active:scale-95 shadow-md"
            >
              Explore Products
            </a>
            <a
              href="#quote"
              className="flex min-h-[48px] items-center justify-center rounded-full border border-gold/50 px-3 sm:px-4 py-3 sm:py-3.5 text-center text-xs sm:text-sm font-medium text-gold transition hover:bg-gold hover:text-ink active:scale-95"
            >
              Request a Quote
            </a>
          </div>
          <div
            className="mt-3 sm:mt-5 md:mt-9 hidden sm:block"
            style={{
              opacity: close,
              transform: `translate3d(0, ${(1 - close) * 18}px, 0)`,
            }}
          >
            <p className="font-serif text-xl sm:text-2xl md:text-4xl italic leading-none">
              Quality in Every Grain.
            </p>
            <p className="mt-1 text-[10px] sm:text-[11px] text-sand md:text-xs">
              Carefully sourced. Thoughtfully processed. Delivered with trust.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- chrome ---------- */
const SECTION_LINKS = [
  { name: "Collection", href: "#collection" },
  { name: "Heritage", href: "#heritage" },
  { name: "Voices", href: "#voices" },
  { name: "Quote", href: "#quote" },
]

function Chrome({
  p,
  past,
  go,
}: {
  p: number
  past: boolean
  go: (at: number) => void
}) {
  const active = p < 0.45 ? 0 : p < 0.7 ? 1 : p < 0.9 ? 2 : 3
  return (
    <>
      {/* chapter dots — story only (hidden on small mobile to avoid interfering with thumb scroll) */}
      <nav
        aria-label="Chapters"
        className="fixed right-3 sm:right-4 top-1/2 z-30 hidden sm:flex -translate-y-1/2 flex-col items-end gap-2 sm:gap-3 text-white mix-blend-difference transition-opacity duration-700 md:right-8"
        style={{ opacity: past ? 0 : 1, pointerEvents: past ? "none" : "auto" }}
      >
        {CHAPTERS.map((c, i) => (
          <button
            key={c.name}
            onClick={() => go(c.at)}
            aria-label={c.name}
            aria-current={i === active}
            className="group flex items-center gap-3 py-1.5 min-h-[32px]"
          >
            <span
              className={`hidden text-[10px] uppercase tracking-[0.25em] transition-all duration-500 md:block ${
                i === active
                  ? "opacity-100"
                  : "translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-70"
              }`}
            >
              {c.name}
            </span>
            <span
              className={`block rounded-full bg-white transition-all duration-500 ${
                i === active
                  ? "h-6 w-[3px]"
                  : "h-[6px] w-[6px] opacity-50 group-hover:opacity-100"
              }`}
            />
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[2px]">
        <div
          className="h-full origin-left bg-gold"
          style={{ transform: `scaleX(${p})` }}
        />
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-20"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(40,28,14,.22) 100%)",
        }}
      />
    </>
  )
}

/* ---------- story root ---------- */
export default function ScrollStory({
  sel,
  setSel,
}: {
  sel: number
  setSel: (n: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { p, past } = useStageProgress(ref)
  const [totalVh, setTotalVh] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 960 : 1600,
  )

  useEffect(() => {
    const handleResize = () => {
      setTotalVh(window.innerWidth < 768 ? 960 : 1600)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const go = (at: number) => {
    const el = ref.current
    if (!el) return
    const top = el.offsetTop + at * (el.offsetHeight - window.innerHeight)
    scrollToY(top)
  }

  return (
    <>
      <div
        ref={ref}
        style={{ height: `${totalVh}vh` }}
        className="relative"
        id="top"
      >
        <div className="sticky top-0 h-dvh overflow-hidden">
          <FarmHarvest p={p} />
          <Explore p={p} sel={sel} setSel={setSel} />
          <Processing p={p} sel={sel} containerRef={ref} />
          <Final p={p} sel={sel} />
        </div>
      </div>
      <Chrome p={p} past={past} go={go} />
    </>
  )
}
