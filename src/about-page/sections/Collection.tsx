import { useState, useEffect, useCallback } from "react"
import { GrainViewer3D as GrainViewer } from "../components/Lazy3D"
import { VARIETIES, MAX_MM } from "../data"
import VarietyBag from "../components/VarietyBag"
import SplitText from "../components/SplitText"
import SectionLabel from "../components/SectionLabel"
import Button from "../components/Button"

function Meter({ l, n }: { l: string; n: number }) {
  const [anim, setAnim] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnim(true), 120)
    return () => clearTimeout(t)
  }, [n])

  return (
    <div>
      <div className="eyebrow flex justify-between text-sand text-[11px]">
        <span>{l}</span>
        <span className="text-gold font-mono">{n}%</span>
      </div>
      <div
        className="mt-2 h-px bg-gold/20"
        role="meter"
        aria-label={l}
        aria-valuenow={n}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-[2px] -translate-y-px bg-gold transition-[width] duration-1000 ease-out"
          style={{ width: anim ? `${n}%` : "0%" }}
        />
      </div>
    </div>
  )
}

export default function Collection({
  sel,
  setSel,
}: {
  sel: number
  setSel: (n: number) => void
}) {
  const [inspectingIndex, setInspectingIndex] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"both" | "bag" | "grain">("both")
  const [added, setAdded] = useState(false)

  const activeVariety =
    inspectingIndex !== null ? VARIETIES[inspectingIndex] : null

  const openInspection = (i: number) => {
    setSel(i)
    setInspectingIndex(i)
    setAdded(false)
    setViewMode("both")
  }

  const closeInspection = useCallback(() => {
    setInspectingIndex(null)
  }, [])

  const prevVariety = () => {
    if (inspectingIndex === null) return
    const nextIdx = (inspectingIndex - 1 + VARIETIES.length) % VARIETIES.length
    setSel(nextIdx)
    setInspectingIndex(nextIdx)
    setAdded(false)
  }

  const nextVariety = () => {
    if (inspectingIndex === null) return
    const nextIdx = (inspectingIndex + 1) % VARIETIES.length
    setSel(nextIdx)
    setInspectingIndex(nextIdx)
    setAdded(false)
  }

  // Handle ESC key and prevent body scrolling when modal is open
  useEffect(() => {
    if (inspectingIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeInspection()
      if (e.key === "ArrowLeft") prevVariety()
      if (e.key === "ArrowRight") nextVariety()
    }
    window.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [inspectingIndex, closeInspection])

  return (
    <section
      id="collection"
      aria-labelledby="collection-title"
      className="section relative overflow-hidden bg-coal"
    >
      <div className="pointer-events-none absolute -right-40 top-20 h-[600px] w-[600px] rounded-full bg-gold/10 blur-[140px]" />
      <div className="wrap relative">
        <SectionLabel n="03">The collection</SectionLabel>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-6">
          <SplitText
            id="collection-title"
            text={"Five _characters,_\none harvest."}
            className="display-lg"
          />
          <p className="max-w-md text-sm sm:text-base text-sand font-light leading-relaxed">
            Five signature harvest varieties calibrated for commercial export.
            Tap any sack card to inspect grain anatomy, aging, and milling specs.
          </p>
        </div>

        {/* 5-Brand Visual Cards Grid (Mobile-First: 2 per row on mobile) */}
        <div className="mt-8 sm:mt-16 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 xs:gap-3.5 sm:gap-6">
          {VARIETIES.map((x, i) => {
            const isKesharKali = x.name === "Keshar Kali"
            const isSelected = sel === i

            return (
              <div
                key={x.name}
                onClick={() => openInspection(i)}
                className={`group relative flex flex-col justify-between overflow-hidden border p-3 xs:p-4 sm:p-6 transition-all duration-300 cursor-pointer text-left ${
                  isSelected
                    ? "border-gold bg-gradient-to-b from-vault/95 to-ink shadow-[0_8px_24px_rgba(217,164,65,0.18)]"
                    : "border-gold/20 bg-gradient-to-b from-vault/60 to-ink/75 hover:border-gold/50 hover:bg-vault/80 hover:-translate-y-1 hover:shadow-lg"
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openInspection(i)
                  }
                }}
                aria-label={`Inspect ${x.name} variety details and specifications`}
              >
                {/* Top Badge Strip */}
                <div className="flex items-center justify-between text-[9px] xs:text-[10px] font-mono tracking-wider">
                  <span className="text-gold font-bold">0{i + 1}</span>
                  <span
                    className={`rounded border px-1.5 xs:px-2 py-0.5 uppercase text-[8px] xs:text-[9px] sm:text-[10px] ${
                      isKesharKali
                        ? "border-gold/50 bg-gold/15 text-gold font-semibold"
                        : "border-gold/20 bg-black/40 text-sand/80"
                    }`}
                  >
                    {x.bagWeight}
                  </span>
                </div>

                {/* SACK IMAGE: Clean authentic packaging presentation */}
                <div className="relative my-2 xs:my-3 sm:my-4 flex h-[135px] xs:h-[155px] sm:h-[220px] md:h-[250px] items-center justify-center py-1 sm:py-2 transition-transform duration-500 group-hover:scale-[1.04]">
                  <div className="pointer-events-none absolute bottom-0 h-4 sm:h-6 w-24 sm:w-32 rounded-full bg-gold/20 blur-lg sm:blur-xl" />
                  <VarietyBag
                    name={x.name}
                    className="h-full w-full"
                    canvasClassName="max-h-[125px] xs:max-h-[145px] sm:max-h-[210px] w-auto drop-shadow-[0_10px_16px_rgba(0,0,0,0.5)]"
                  />
                </div>

                {/* BRAND NAME & HIGHLIGHTS */}
                <div>
                  <h3 className="font-display text-base xs:text-lg sm:text-2xl md:text-3xl italic font-normal text-ivory group-hover:text-gold transition-colors leading-tight">
                    {x.name}
                  </h3>
                  <p className="eyebrow mt-0.5 sm:mt-1 text-[9px] xs:text-[10px] sm:text-[11px] text-sand/75 line-clamp-1">
                    {x.subname}
                  </p>

                  <div className="mt-2 xs:mt-2.5 sm:mt-3.5 flex items-center justify-between border-t border-gold/15 pt-1.5 xs:pt-2 sm:pt-2.5 text-[9px] xs:text-[10px] sm:text-[11px] font-mono text-sand/70">
                    <span className="text-gold font-medium">{x.len}</span>
                    <span className="truncate max-w-[65px] xs:max-w-[85px] sm:max-w-[120px] text-right">
                      {x.aged.split(" in ")[0]}
                    </span>
                  </div>

                  {/* Mobile-friendly tap indicator */}
                  <div className="mt-2 sm:mt-3 flex items-center justify-between text-[9px] xs:text-[10px] sm:text-[11px] font-mono text-gold group-hover:text-ivory transition-colors">
                    <span className="tracking-wider uppercase text-[8px] xs:text-[9px] sm:text-[10px]">
                      Details
                    </span>
                    <span className="text-xs sm:text-sm transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CINEMATIC INSPECTION MODAL (Opens on card click) */}
      {inspectingIndex !== null && activeVariety && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={closeInspection}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-variety-title"
        >
          <div
            className="relative w-full max-w-4xl max-h-[92dvh] overflow-y-auto border border-gold/30 bg-gradient-to-br from-vault via-ink to-coal p-5 sm:p-8 md:p-10 shadow-[0_0_80px_rgba(0,0,0,0.9)] custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-gold/20 pb-4">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-gold font-bold">
                  0{inspectingIndex + 1} / 05
                </span>
                <span className="text-gold/30">|</span>
                <span className="text-sand/80 uppercase tracking-wider text-[11px]">
                  {activeVariety.subname}
                </span>
              </div>
              <button
                type="button"
                onClick={closeInspection}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-gold/30 text-sand hover:border-gold hover:text-ivory transition-colors"
                aria-label="Close variety details"
              >
                ✕
              </button>
            </div>

            {/* Modal Header */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2
                  id="modal-variety-title"
                  className="font-display text-3xl sm:text-5xl md:text-6xl italic text-ivory"
                >
                  {activeVariety.name}
                </h2>
                <p className="mt-1 font-mono text-xs sm:text-sm text-sand/80">
                  {activeVariety.specs.varietyType} · Origin:{" "}
                  {activeVariety.specs.origin}
                </p>
              </div>
              <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-1 sm:gap-2 border-t border-gold/15 pt-2 sm:border-0 sm:pt-0 sm:text-right">
                <div className="font-display text-2xl sm:text-4xl text-gold font-normal">
                  {activeVariety.bagWeight}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-sand">
                  {activeVariety.name === "Keshar Kali"
                    ? "Signature Sack"
                    : "Standard Export Sack"}
                </div>
              </div>
            </div>

            {/* Dual Inspection Showcase: Bag & 3D Grain */}
            <div className="my-6 sm:my-8">
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-gold/15 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                  <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-sand">
                    Inspection · Packaging & Grain
                  </span>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center rounded-full border border-gold/25 bg-black/40 p-1 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-sand">
                  <button
                    type="button"
                    onClick={() => setViewMode("both")}
                    className={`rounded-full min-h-[36px] px-3 sm:px-3.5 py-1.5 transition-all ${
                      viewMode === "both"
                        ? "bg-gold text-ink font-semibold"
                        : "hover:text-ivory"
                    }`}
                  >
                    Both
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("bag")}
                    className={`rounded-full min-h-[36px] px-3 sm:px-3.5 py-1.5 transition-all ${
                      viewMode === "bag"
                        ? "bg-gold text-ink font-semibold"
                        : "hover:text-ivory"
                    }`}
                  >
                    Bag
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grain")}
                    className={`rounded-full min-h-[36px] px-3 sm:px-3.5 py-1.5 transition-all ${
                      viewMode === "grain"
                        ? "bg-gold text-ink font-semibold"
                        : "hover:text-ivory"
                    }`}
                  >
                    3D Grain
                  </button>
                </div>
              </div>

              {/* Showcase Panels */}
              <div
                className={`grid gap-4 ${
                  viewMode === "both"
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {/* Bag Panel */}
                {(viewMode === "both" || viewMode === "bag") && (
                  <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-gold/20 bg-black/40 p-5 min-h-[300px] sm:min-h-[340px]">
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                      <span className="text-gold">COMMERCIAL EXPORT SACK</span>
                      <span className="text-sand/70">
                        {activeVariety.bagWeight}
                      </span>
                    </div>
                    <div className="relative my-auto flex h-[210px] sm:h-[250px] items-center justify-center py-2">
                      <VarietyBag
                        name={activeVariety.name}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="border-t border-gold/15 pt-2 text-[11px] text-sand/80 truncate font-mono">
                      High-Barrier BOPP · Stitched Crepe Band
                    </div>
                  </div>
                )}

                {/* 3D Grain Panel */}
                {(viewMode === "both" || viewMode === "grain") && (
                  <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-gold/20 bg-black/40 p-5 min-h-[300px] sm:min-h-[340px]">
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                      <span className="text-gold">3D GRAIN ANATOMY</span>
                      <span className="text-sand/70">
                        {activeVariety.len} / {MAX_MM} MM
                      </span>
                    </div>
                    <div className="relative my-auto flex h-[210px] sm:h-[250px] w-full items-center justify-center">
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: `radial-gradient(ellipse 50% 60% at 50% 50%, ${activeVariety.tone[2]}33, transparent 70%)`,
                        }}
                      />
                      <div
                        className="relative h-full w-full"
                        role="img"
                        aria-label={`${activeVariety.name} grain in 3D`}
                      >
                        <GrainViewer
                          mm={activeVariety.mm}
                          width={activeVariety.width}
                          thickness={activeVariety.thickness}
                          color={activeVariety.tone[0]}
                          active={true}
                          onTouch={() => {}}
                        />
                      </div>
                    </div>
                    <div className="border-t border-gold/15 pt-2 text-[11px] text-sand/80 font-mono flex justify-between">
                      <span>⟷ Drag to rotate in 3D</span>
                      <span className="text-gold">{activeVariety.len}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Note & Culinary Pairing */}
            <p className="text-sm sm:text-base font-light leading-relaxed text-ivory/90">
              {activeVariety.note}
            </p>

            <div className="mt-4 p-3.5 border border-gold/15 bg-gold/[0.04] text-xs sm:text-sm text-sand">
              <span className="text-gold font-medium">Culinary pairing: </span>
              Best for {activeVariety.best.toLowerCase()}. {activeVariety.aroma}.
            </div>

            {/* Character Meters */}
            <div className="mt-6 sm:mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 border-t border-gold/15 pt-6">
              {activeVariety.meters.map(([l, n]) => (
                <Meter key={l} l={l} n={n} />
              ))}
            </div>

            {/* Technical Specifications Grid */}
            <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 gap-px bg-gold/15">
              {Object.entries(activeVariety.specs).map(([k, val]) => (
                <div key={k} className="bg-ink p-3.5 sm:p-4">
                  <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-sand/70">
                    {k.replace(/([A-Z])/g, " $1")}
                  </div>
                  <div className="mt-1 text-xs sm:text-sm text-ivory font-medium">
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Bottom Actions & Variety Navigation */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-gold/20 pt-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevVariety}
                  className="flex min-h-[44px] items-center gap-1.5 border border-gold/30 px-3.5 py-2 text-xs font-mono text-sand hover:border-gold hover:text-ivory transition-colors active:scale-95"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={nextVariety}
                  className="flex min-h-[44px] items-center gap-1.5 border border-gold/30 px-3.5 py-2 text-xs font-mono text-sand hover:border-gold hover:text-ivory transition-colors active:scale-95"
                >
                  Next →
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  variant="line"
                  onClick={() => setAdded(!added)}
                  magnetic={false}
                  className="!min-h-[48px]"
                >
                  {added ? "Added to Quote ✓" : "Add to Quote"}
                </Button>
                <Button
                  href="#quote"
                  variant="gold"
                  onClick={() => {
                    setSel(inspectingIndex)
                    closeInspection()
                  }}
                  className="!min-h-[48px]"
                >
                  Request Quote · {activeVariety.name}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

