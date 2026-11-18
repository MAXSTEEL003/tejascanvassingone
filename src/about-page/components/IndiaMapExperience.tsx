import { lazy, Suspense, useState, useMemo, useEffect } from "react"
import { StateHub, SUPPLY_HUBS } from "../data/networkData"
import { isWebGLAvailable } from "../three/map3dUtils"

interface Props {
  activeStateId: string | null
  onSelectState: (state: StateHub | null) => void
  selectedRegion?: string
}

// Lazy: keeps three.js and the 200 KB of vector data out of the initial bundle
const India3DCanvas = lazy(() => import("../three/India3DCanvas"))
const IndiaVectorMap = lazy(() => import("./IndiaVectorMap"))

function MapFallback() {
  return (
    <div
      className="grid aspect-[4/3] w-full place-items-center border-0 sm:border border-gold/15 bg-coal/60"
      role="status"
      aria-label="Loading map"
    >
      <span className="eyebrow animate-pulse text-gold/70">
        Charting the network…
      </span>
    </div>
  )
}

export type MapMode = "3d" | "vector-dark" | "vector-light"

export default function IndiaMapExperience({
  activeStateId,
  onSelectState,
  selectedRegion = "All",
}: Props) {
  const hasWebGL = useMemo(() => isWebGLAvailable(), [])
  const [mode, setMode] = useState<MapMode>(hasWebGL ? "3d" : "vector-dark")
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768
    }
    return false
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // On phone / mobile screens, always show the dark vector map
  const effectiveMode: MapMode = isMobile ? "vector-dark" : mode

  // Find currently active state
  const activeState = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === activeStateId) || null,
    [activeStateId],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Luxury Cartography Engine Switcher Bar - hidden on mobile, shown on md+ screens */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-2 border border-gold/20 bg-coal/80 p-2 shadow-lg">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full py-0.5">
          <span className="hidden sm:inline-block px-2 font-mono text-[10px] uppercase tracking-wider text-sand/60 shrink-0">
            Engine:
          </span>

          {/* 3D Hologram / Mesh Button */}
          <button
            type="button"
            onClick={() => setMode("3d")}
            disabled={!hasWebGL}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border px-2.5 sm:px-3.5 py-1.5 min-h-[38px] text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all duration-300 ${
              effectiveMode === "3d"
                ? "border-gold bg-gold text-ink font-semibold"
                : "border-transparent text-sand hover:border-gold/20 hover:bg-gold/10 hover:text-ivory"
            } ${!hasWebGL ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
              <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
            </svg>
            <span>3D Mesh</span>
          </button>

          {/* Dark Vector Mode Button */}
          <button
            type="button"
            onClick={() => setMode("vector-dark")}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border px-2.5 sm:px-3.5 py-1.5 min-h-[38px] text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all duration-300 ${
              effectiveMode === "vector-dark"
                ? "border-gold bg-gold text-ink font-semibold"
                : "border-transparent text-sand hover:border-gold/20 hover:bg-gold/10 hover:text-ivory"
            }`}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>Dark Vector</span>
          </button>

          {/* Light Vector Mode Button */}
          <button
            type="button"
            onClick={() => setMode("vector-light")}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border px-2.5 sm:px-3.5 py-1.5 min-h-[38px] text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all duration-300 ${
              effectiveMode === "vector-light"
                ? "border-gold bg-gold text-ink font-semibold"
                : "border-transparent text-sand hover:border-gold/20 hover:bg-gold/10 hover:text-ivory"
            }`}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span>Light Terroir</span>
          </button>
        </div>

        {/* Telemetry Badge */}
        <div className="hidden sm:flex items-center gap-2 pr-2 eyebrow text-gold/80 text-[10px]">
          <span className="h-1.5 w-1.5 bg-gold animate-pulse" />
          <span>2 Origin Mills · 19 Corridors</span>
        </div>
      </div>

      {/* Map Display Container */}
      <div className="relative w-full">
        <Suspense fallback={<MapFallback />}>
          {effectiveMode === "3d" && hasWebGL ? (
            <India3DCanvas
              activeStateId={activeStateId}
              onSelectState={onSelectState}
              selectedRegion={selectedRegion}
            />
          ) : effectiveMode === "vector-dark" ? (
            <IndiaVectorMap
              activeStateId={activeStateId}
              onSelectState={onSelectState}
              selectedRegion={selectedRegion}
              theme="dark"
            />
          ) : (
            <IndiaVectorMap
              activeStateId={activeStateId}
              onSelectState={onSelectState}
              selectedRegion={selectedRegion}
              theme="light"
            />
          )}
        </Suspense>
      </div>

      {/* Active State Telemetry Strip (Synchronized across all modes) */}
      {activeState && (
        <div className="relative z-20 mt-1 w-full animate-fadeIn border-0 sm:border border-gold/20 bg-coal/90 sm:bg-coal/95 p-4 sm:p-6 shadow-xl sm:shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gold/15 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-mono text-xs font-bold text-gold">
                  {activeState.code}
                </span>
                <h4 className="font-display text-2xl sm:text-3xl italic text-ivory">
                  {activeState.name}
                </h4>
                {activeState.isOrigin && (
                  <span className="border border-saffron/40 bg-saffron/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-saffron">
                    Origin Citadel
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono text-sand">
                <span className="text-gold font-medium">
                  Capital: {activeState.capital}
                </span>
                <span className="text-gold/40">·</span>
                <span>{activeState.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="border border-gold/20 bg-vault/70 px-4 py-2 text-right">
                <span className="block eyebrow text-[9px] text-sand/80">
                  Transit
                </span>
                <span className="font-mono text-sm font-bold text-gold">
                  {activeState.dispatchTime}
                </span>
              </div>
              <div className="border border-gold/20 bg-vault/70 px-4 py-2 text-right">
                <span className="block eyebrow text-[9px] text-sand/80">
                  Network
                </span>
                <span className="font-mono text-sm font-bold text-ivory">
                  {activeState.partners}+ Mandis
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="eyebrow text-sand text-[10px] block mb-2">
                Primary Varieties Sourced & Supplied
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeState.primaryVarieties.map((v) => (
                  <span
                    key={v}
                    className="border border-gold/25 bg-gold/[0.06] px-3 py-1 font-mono text-xs text-ivory/90"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="eyebrow text-sand text-[10px] block mb-1.5">
                Supply Corridor Dynamics
              </span>
              <p className="font-sans text-xs text-sand/90 leading-relaxed">
                {activeState.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
