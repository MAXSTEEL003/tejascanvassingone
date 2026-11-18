import React, { useState, useMemo } from "react"
import {
  INDIA_MAINLAND_OUTLINE,
  INDIA_STATE_BORDERS,
  INDIA_ISLANDS,
  INDIA_CLOSED_LANDMASS_SHAPES,
  MAP_DIMENSIONS,
} from "../data/indiaVectorData"
import { SUPPLY_HUBS, StateHub } from "../data/networkData"

interface Props {
  activeStateId: string | null
  onSelectState: (state: StateHub | null) => void
  selectedRegion?: string
  theme?: "dark" | "light"
}

/**
 * Memoized Static Base Cartography
 * Prevents React from re-diffing or re-rendering ~200KB of complex SVG path data
 * whenever state hover or selection changes.
 */
const StaticMapCartography = React.memo(function StaticMapCartography({
  isDark,
}: {
  isDark: boolean
}) {
  return (
    <>
      {/* Subcontinent State Polygons (Seamless Landmass Fill) */}
      <g className="landmass-layer">
        {INDIA_CLOSED_LANDMASS_SHAPES.map((shapeD, i) => (
          <path
            key={`land-${i}`}
            d={shapeD}
            fill={isDark ? "#16110a" : "#f5edd9"}
            stroke="none"
          />
        ))}
      </g>

      {/* Internal State Boundaries (Single Crisp Brass Seams with Zero Duplicate Strokes) */}
      <g className="state-borders-layer">
        {INDIA_STATE_BORDERS.map((borderD, i) => (
          <path
            key={`border-${i}`}
            d={borderD}
            fill="none"
            stroke={isDark ? "#8a6523" : "#8c5319"}
            strokeWidth={isDark ? "0.75" : "0.9"}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Coastal & International Perimeter Outline (Gleaming Gold Perimeter) */}
      <path
        d={INDIA_MAINLAND_OUTLINE}
        fill="none"
        stroke={isDark ? "#ffd700" : "#6b450c"}
        strokeWidth={isDark ? "1.6" : "1.8"}
        strokeLinejoin="round"
      />

      {/* Island Archipelagoes (Lakshadweep & Andaman Nicobar) */}
      <g className="islands-layer">
        {INDIA_ISLANDS.map((islandPath, i) => (
          <path
            key={`island-${i}`}
            d={islandPath}
            fill={isDark ? "#e5b842" : "#7a5410"}
            stroke={isDark ? "#ffd700" : "#7a5410"}
            strokeWidth="0.8"
          />
        ))}
      </g>
    </>
  )
})

interface CapitalPos {
  label: string
  anchor: "start" | "middle" | "end"
  dx: number
  dy: number
}

const CAPITAL_CONFIG: Record<string, CapitalPos> = {
  nagpur: { label: "★ Nagpur (Origin)", anchor: "middle", dx: 0, dy: 16 },
  miryalaguda: { label: "★ Miryalaguda (Origin)", anchor: "start", dx: 10, dy: -4 },
  delhi: { label: "New Delhi", anchor: "start", dx: 8, dy: -2 },
  haryana: { label: "Chandigarh", anchor: "end", dx: -8, dy: -6 },
  punjab: { label: "Amritsar", anchor: "end", dx: -8, dy: -4 },
  uttarakhand: { label: "Dehradun", anchor: "start", dx: 8, dy: -6 },
  rajasthan: { label: "Jaipur", anchor: "end", dx: -9, dy: 3 },
  gujarat: { label: "Gandhinagar", anchor: "end", dx: -9, dy: 3 },
  maharashtra: { label: "Mumbai", anchor: "end", dx: -9, dy: 3 },
  madhyapradesh: { label: "Bhopal", anchor: "middle", dx: 0, dy: -10 },
  uttarpradesh: { label: "Lucknow", anchor: "start", dx: 9, dy: 0 },
  bihar: { label: "Patna", anchor: "start", dx: 9, dy: -2 },
  jharkhand: { label: "Ranchi", anchor: "start", dx: 9, dy: 0 },
  westbengal: { label: "Kolkata", anchor: "start", dx: 9, dy: 3 },
  odisha: { label: "Bhubaneswar", anchor: "start", dx: 9, dy: 3 },
  telangana: { label: "Hyderabad", anchor: "end", dx: -9, dy: 0 },
  andhra: { label: "Amaravati", anchor: "start", dx: 9, dy: 6 },
  goa: { label: "Panaji", anchor: "end", dx: -8, dy: 3 },
  karnataka: { label: "Bengaluru", anchor: "end", dx: -9, dy: 2 },
  tamilnadu: { label: "Chennai", anchor: "start", dx: 9, dy: 2 },
  kerala: { label: "Kochi", anchor: "end", dx: -9, dy: 3 },
}

export default function IndiaVectorMap({
  activeStateId,
  onSelectState,
  selectedRegion = "All",
  theme = "dark",
}: Props) {
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null)

  // Current inspected state
  const currentId = hoveredStateId || activeStateId
  const activeState = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === currentId) || null,
    [currentId],
  )

  // Origin hubs
  const nagpurHub = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === "nagpur")!,
    [],
  )
  const miryalagudaHub = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === "miryalaguda")!,
    [],
  )

  // Filtered hubs by region
  const filteredHubs = useMemo(() => {
    if (selectedRegion === "All") return SUPPLY_HUBS
    return SUPPLY_HUBS.filter((h) => {
      if (selectedRegion === "North") return h.region === "North"
      if (selectedRegion === "West") return h.region === "West"
      if (selectedRegion === "South") return h.region === "South"
      if (selectedRegion === "East & Central")
        return h.region === "East" || h.region === "Central"
      return true
    })
  }, [selectedRegion])

  // Calculate curved bezier supply lines from origin hubs to destinations
  const supplyRoutes = useMemo(() => {
    return SUPPLY_HUBS.map((dest) => {
      if (dest.isOrigin) return null
      const origin = dest.originHub === "miryalaguda" ? miryalagudaHub : nagpurHub

      // Hub vector coordinates in 615.43 x 693 space
      const ox = origin.x * 6.1543
      const oy = origin.y * 6.93
      const dx = dest.x * 6.1543
      const dy = dest.y * 6.93

      // Bezier arch control point
      const diffX = dx - ox
      const diffY = dy - oy
      const curvature = 0.2
      const cx = ox + diffX * 0.5 - diffY * curvature
      const cy = oy + diffY * 0.5 + diffX * curvature

      return {
        id: `route-${dest.id}`,
        destId: dest.id,
        path: `M ${ox.toFixed(1)} ${oy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`,
        originName: origin.hubName || origin.name,
        destName: dest.name,
        originHub: dest.originHub || "nagpur",
      }
    }).filter(Boolean) as Array<{
      id: string
      destId: string
      path: string
      originName: string
      destName: string
      originHub: "nagpur" | "miryalaguda"
    }>
  }, [nagpurHub, miryalagudaHub])

  const isDark = theme === "dark"

  return (
    <div className="relative mx-auto flex w-full max-w-[720px] flex-col items-center select-none">
      {/* High-Performance 2D Precision Cartography Card - borderless on mobile */}
      <div
        className={`relative aspect-[100/108] w-full border-0 sm:border p-0 sm:p-7 shadow-none sm:shadow-[0_24px_80px_rgba(0,0,0,0.85)] transition-colors duration-300 ${
          isDark
            ? "sm:border-gold/25 bg-transparent sm:bg-gradient-to-b sm:from-[#140f0a] sm:via-[#0d0906] sm:to-[#050403] sm:shadow-[0_24px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(217,164,65,0.06)]"
            : "sm:border-brass/25 bg-transparent sm:bg-gradient-to-b sm:from-[#faf6ee] sm:via-[#f4ebd8] sm:to-[#e8d9bd] sm:shadow-[0_24px_80px_rgba(70,45,15,0.18)]"
        }`}
      >
        {/* Subtle Ambient Top Glow */}
        <div
          className={`pointer-events-none absolute -top-8 left-1/2 h-28 w-2/3 -translate-x-1/2 rounded-full blur-2xl ${
            isDark ? "bg-gold/10" : "bg-amber-400/20"
          }`}
        />

        {/* Header HUD - hidden on mobile to remove box frames, visible on sm+ */}
        <div
          className={`hidden sm:flex relative z-10 mb-2 items-center justify-between border-b pb-3 ${
            isDark ? "border-gold/15" : "border-brass/15"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isDark ? "bg-gold" : "bg-brass"
                }`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  isDark ? "bg-gold" : "bg-brass"
                }`}
              />
            </span>
            <span
              className={`eyebrow text-[10px] ${
                isDark ? "text-gold" : "text-brass"
              }`}
            >
              {isDark ? "Nocturne Vector" : "Terroir Vector"} · 19 Freight
              Corridors
            </span>
          </div>
          <div
            className={`hidden sm:flex items-center gap-4 eyebrow text-[10px] ${
              isDark ? "text-sand" : "text-umber font-semibold"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isDark ? "bg-saffron" : "bg-brass"
                }`}
              />{" "}
              2 Origin Citadels
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isDark ? "bg-gold" : "bg-brass"
                }`}
              />{" "}
              19 Active States
            </span>
          </div>
        </div>

        {/* High-Performance SVG Canvas with Zero Frame Drops */}
        <div className="relative h-full w-full">
          <svg
            viewBox={MAP_DIMENSIONS.viewBox}
            className="h-full w-full overflow-visible"
            aria-label="Interactive Vector Map of India Supply Network"
          >
            <defs>
              {/* Hardware-accelerated radial gradient for nodes */}
              <radialGradient id={`hubGlow-${theme}`} cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={isDark ? "#ffd875" : "#d97706"}
                  stopOpacity="0.9"
                />
                <stop
                  offset="60%"
                  stopColor={isDark ? "#d7b264" : "#b45309"}
                  stopOpacity="0.4"
                />
                <stop
                  offset="100%"
                  stopColor={isDark ? "#d7b264" : "#b45309"}
                  stopOpacity="0"
                />
              </radialGradient>

              {/* Linear gradient for supply lines */}
              <linearGradient
                id={`routeGradKarnal-${theme}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={isDark ? "#ffd700" : "#d97706"}
                  stopOpacity="0.85"
                />
                <stop
                  offset="100%"
                  stopColor={isDark ? "#d7b264" : "#92400e"}
                  stopOpacity="0.25"
                />
              </linearGradient>

              <linearGradient
                id={`routeGradWada-${theme}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={isDark ? "#f39c12" : "#c2410c"}
                  stopOpacity="0.85"
                />
                <stop
                  offset="100%"
                  stopColor={isDark ? "#d7b264" : "#9a3412"}
                  stopOpacity="0.25"
                />
              </linearGradient>

              <linearGradient
                id={`routeGradNagpur-${theme}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={isDark ? "#ff7a45" : "#ea580c"}
                  stopOpacity="0.85"
                />
                <stop
                  offset="100%"
                  stopColor={isDark ? "#d7b264" : "#9a3412"}
                  stopOpacity="0.25"
                />
              </linearGradient>

              <linearGradient
                id={`routeGradMiryala-${theme}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={isDark ? "#00e5a3" : "#059669"}
                  stopOpacity="0.85"
                />
                <stop
                  offset="100%"
                  stopColor={isDark ? "#d7b264" : "#047857"}
                  stopOpacity="0.25"
                />
              </linearGradient>
            </defs>

            {/* Memoized Static Mainland, Islands, and State Borders */}
            <StaticMapCartography isDark={isDark} />

            {/* Inter-Citadel Express Spine Line (Nagpur to Miryalaguda) */}
            <g className="citadel-spine opacity-85">
              <line
                x1={nagpurHub.x * 6.1543}
                y1={nagpurHub.y * 6.93}
                x2={miryalagudaHub.x * 6.1543}
                y2={miryalagudaHub.y * 6.93}
                stroke={isDark ? "#ffd700" : "#d97706"}
                strokeWidth="2"
                strokeDasharray="5 5"
              />
            </g>

            {/* Supply Routes: Only animate the single active route to guarantee 60-120fps */}
            <g className="routes-layer">
              {supplyRoutes.map((route) => {
                const isSelected = activeState?.id === route.destId
                const isHoveredRoute = hoveredStateId === route.destId
                const isHighlight = isSelected || isHoveredRoute
                return (
                  <path
                    key={route.id}
                    d={route.path}
                    fill="none"
                    stroke={
                      isHighlight
                        ? isDark
                          ? "#ffffff"
                          : "#7a5410"
                        : route.originHub === "miryalaguda"
                          ? `url(#routeGradMiryala-${theme})`
                          : `url(#routeGradNagpur-${theme})`
                    }
                    strokeWidth={isHighlight ? 2.4 : 1.1}
                    strokeOpacity={isHighlight ? 1 : currentId ? 0.18 : 0.5}
                    strokeDasharray={isHighlight ? "6 4" : "3 4"}
                    style={
                      isHighlight
                        ? { animation: "dashFlow 1.2s linear infinite" }
                        : undefined
                    }
                  />
                )
              })}
            </g>

            {/* Interactive State Nodes (19 States) */}
            <g className="hubs-layer">
              {SUPPLY_HUBS.map((hub) => {
                const isOrigin = hub.isOrigin
                const isSelected = activeState?.id === hub.id
                const isStateHovered = hoveredStateId === hub.id
                const isActive = isSelected || isStateHovered
                const isMatchingRegion = filteredHubs.some(
                  (h) => h.id === hub.id,
                )

                const vx = hub.x * 6.1543
                const vy = hub.y * 6.93

                const capCfg = CAPITAL_CONFIG[hub.id] || {
                  label: hub.capital.split("(")[0].split("/")[0].trim(),
                  anchor: "start" as const,
                  dx: 8,
                  dy: 2,
                }

                return (
                  <g
                    key={hub.id}
                    className="cursor-pointer"
                    onPointerEnter={() => setHoveredStateId(hub.id)}
                    onPointerLeave={() => setHoveredStateId(null)}
                    onClick={() => onSelectState(isSelected ? null : hub)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${hub.name} supply hub, Capital ${capCfg.label}`}
                  >
                    {/* Invisible expanded tap target */}
                    <circle cx={vx} cy={vy} r={22} fill="transparent" />

                    {/* Outer Pulse Ring for Active / Origin */}
                    {(isActive || isOrigin) && (
                      <circle
                        cx={vx}
                        cy={vy}
                        r={isOrigin ? 17 : 12}
                        fill="none"
                        stroke={isDark ? "#ffd700" : "#b45309"}
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        className={isActive ? "animate-pulse" : "opacity-75"}
                      />
                    )}

                    {/* Radial Glow Halo */}
                    <circle
                      cx={vx}
                      cy={vy}
                      r={isOrigin ? 13 : isActive ? 11 : 6.5}
                      fill={`url(#hubGlow-${theme})`}
                      opacity={isActive ? 1 : isMatchingRegion ? 0.85 : 0.35}
                    />

                    {/* Solid Core Dot */}
                    <circle
                      cx={vx}
                      cy={vy}
                      r={isOrigin ? 6 : isActive ? 5 : 3.5}
                      fill={
                        isOrigin
                          ? "#ffffff"
                          : isActive
                            ? isDark
                              ? "#fff0b3"
                              : "#ffffff"
                            : isDark
                              ? "#ffd770"
                              : "#a16207"
                      }
                      stroke={isDark ? "#140f0a" : "#ffffff"}
                      strokeWidth="1.3"
                    />

                    {/* Always-Visible Capital & Citadel Label with Dark Contrast Halo */}
                    <text
                      x={vx + capCfg.dx}
                      y={vy + capCfg.dy}
                      textAnchor={capCfg.anchor}
                      fontSize={isOrigin ? "9" : "8"}
                      fontFamily="var(--font-sans), system-ui, sans-serif"
                      fontWeight={isActive || isOrigin ? "700" : "600"}
                      letterSpacing="0.25px"
                      paintOrder="stroke fill"
                      stroke={isDark ? "#060403" : "#faf5ea"}
                      strokeWidth={isDark ? "3.2" : "3.0"}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      fill={
                        isOrigin
                          ? "#ffd700"
                          : isActive
                            ? isDark
                              ? "#ffd700"
                              : "#9a3412"
                            : isDark
                              ? "#fbf8f1"
                              : "#2d1f0d"
                      }
                      opacity={isActive ? 1 : isMatchingRegion ? 1 : 0.45}
                      className="pointer-events-none select-none transition-all duration-200"
                    >
                      {capCfg.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Floating Quick-Telemetry Badge if State is Inspected - borderless on mobile */}
        {activeState && (
          <div
            className={`relative z-20 mt-1 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-0 sm:border px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 transition-all ${
              isDark
                ? "sm:border-gold/25 bg-coal/80 sm:bg-coal/90 text-ivory shadow-none sm:shadow-lg"
                : "sm:border-brass/25 bg-parchment/80 sm:bg-parchment/90 text-earth shadow-none sm:shadow-md"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  isDark
                    ? "border border-gold/30 bg-gold/10 text-gold"
                    : "border border-brass/30 bg-brass/10 text-brass"
                }`}
              >
                {activeState.code}
              </span>
              <span className="font-display italic text-sm">
                {activeState.name}
              </span>
              <span
                className={`font-mono text-xs ${
                  isDark ? "text-gold" : "text-brass font-medium"
                }`}
              >
                · 🏛 {activeState.capital.split("(")[0].split("/")[0].trim()}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className={isDark ? "text-sand" : "text-umber"}>
                Transit:{" "}
                <strong
                  className={isDark ? "text-gold font-normal" : "text-brass"}
                >
                  {activeState.dispatchTime}
                </strong>
              </span>
              <span className={isDark ? "text-gold/30" : "text-brass/30"}>
                |
              </span>
              <span className={isDark ? "text-sand" : "text-umber"}>
                Partners:{" "}
                <strong
                  className={isDark ? "text-ivory font-normal" : "text-earth"}
                >
                  {activeState.partners}+ Mandis
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Legend - borderless on mobile */}
        <div
          className={`relative z-10 mt-2 sm:mt-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-t-0 sm:border-t pt-1 sm:pt-3 text-[10px] sm:text-[11px] font-mono ${
            isDark
              ? "border-gold/15 text-sand"
              : "border-brass/15 text-umber font-medium"
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 border ${
                  isDark ? "border-gold bg-white" : "border-brass bg-amber-400"
                }`}
              />
              <span>Origin Mill Citadel</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 ${isDark ? "bg-gold" : "bg-brass"}`} />
              <span>Wholesale Partner State</span>
            </span>
          </div>
          <div
            className={`hidden sm:block ${
              isDark ? "text-gold/80" : "text-brass"
            }`}
          >
            Interactive Cartography · Hover or click any state
          </div>
        </div>
      </div>
    </div>
  )
}
