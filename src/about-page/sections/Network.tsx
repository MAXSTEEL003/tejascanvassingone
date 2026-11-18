import { useState, useMemo } from "react"
import IndiaMapExperience from "../components/IndiaMapExperience"
import { SUPPLY_HUBS, NETWORK_STATS, StateHub } from "../data/networkData"
import Button from "../components/Button"
import SplitText from "../components/SplitText"
import SectionLabel from "../components/SectionLabel"
import Reveal, { CountUp } from "../components/Reveal"

const REGIONS = ["All", "North", "West", "South", "East & Central"] as const
type RegionFilter = typeof REGIONS[number]

export default function Network() {
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>("All")
  const [activeState, setActiveState] = useState<StateHub | null>(
    SUPPLY_HUBS[1],
  ) // Default to Maharashtra (Wada)
  const [searchQuery, setSearchQuery] = useState("")

  // Filtered hubs for the directory
  const filteredList = useMemo(() => {
    return SUPPLY_HUBS.filter((hub) => {
      const matchesRegion =
        selectedRegion === "All"
          ? true
          : selectedRegion === "East & Central"
            ? hub.region === "East" || hub.region === "Central"
            : hub.region === selectedRegion

      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        q === ""
          ? true
          : hub.name.toLowerCase().includes(q) ||
            hub.code.toLowerCase().includes(q) ||
            hub.capital.toLowerCase().includes(q) ||
            hub.primaryVarieties.some((v) => v.toLowerCase().includes(q))

      return matchesRegion && matchesSearch
    })
  }, [selectedRegion, searchQuery])

  return (
    <section
      id="network"
      aria-labelledby="network-title"
      className="section relative bg-ink text-ivory overflow-hidden"
    >
      {/* Ambient gold radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[550px] w-[880px] -translate-x-1/2 rounded-full bg-gold/[0.04] blur-[150px]" />

      <div className="wrap relative z-10">
        {/* Editorial Section Header matching site rhythm */}
        <div className="grid-12 items-end">
          <div className="col-span-12 lg:col-span-7">
            <SectionLabel n="05">Pan-India Network</SectionLabel>
            <SplitText
              id="network-title"
              text={"Supplying 19 states,\n_coast to coast._"}
              className="display-lg mt-6"
            />
          </div>
          <p className="lede col-span-12 text-sand lg:col-span-5 lg:col-start-8">
            From twin milling and logistics citadels in{" "}
            <span className="text-gold font-normal">Nagpur (Central)</span> and{" "}
            <span className="text-gold font-normal">Miryalaguda (South)</span>,
            direct grain transit connects 1,600+ commercial mandi wholesalers,
            luxury hospitality groups, and institutional buyers nationwide.
          </p>
        </div>

        {/* KPI Counter Strip matching Heritage & Rest.tsx */}
        <Reveal className="mt-10 sm:mt-16">
          <dl className="grid grid-cols-2 border-y border-gold/20 lg:grid-cols-4">
            {[
              [
                NETWORK_STATS.statesCovered,
                "",
                "States & UTs Supplied",
                "Interstate express corridors",
              ],
              [
                NETWORK_STATS.activePartners,
                "+",
                "Active Trade Partners",
                "Mandis & luxury HoReCa",
              ],
              [
                36,
                "h",
                "Transit Guarantee",
                "Fast dispatch from Nagpur & Miryalaguda",
              ],
              [
                NETWORK_STATS.originMills,
                " Citadels",
                "Origin Milling Hubs",
                "Aerated silos & optical Sortex",
              ],
            ].map(([n, sx, l, sub], i) => (
              <div
                key={l as string}
                className={`py-6 sm:py-8 pr-2 sm:pr-4 ${
                  i % 2 ? "border-l border-gold/15 pl-3.5 sm:pl-6" : ""
                } ${i > 0 ? "lg:border-l lg:border-gold/15 lg:pl-8" : ""}`}
              >
                <dd className="font-display text-3xl sm:text-5xl md:text-6xl italic text-gold font-normal flex flex-wrap items-baseline">
                  <CountUp to={n as number} suffix={sx as string} />
                </dd>
                <dt className="eyebrow mt-2 sm:mt-3 text-xs sm:text-sm text-ivory/90 font-medium leading-tight">{l}</dt>
                <p className="mt-1 font-mono text-[10px] sm:text-[11px] text-sand/60 leading-snug">{sub}</p>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* Region Filter Bar & Search */}
        <div className="mt-8 sm:mt-12 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gold/15 pb-6">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {REGIONS.map((region) => {
              const count =
                region === "All"
                  ? SUPPLY_HUBS.length
                  : region === "East & Central"
                    ? SUPPLY_HUBS.filter(
                        (h) => h.region === "East" || h.region === "Central",
                      ).length
                    : SUPPLY_HUBS.filter((h) => h.region === region).length

              const isActive = selectedRegion === region
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={`border px-3 sm:px-4 py-2 min-h-[44px] text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all duration-300 ${
                    isActive
                      ? "border-gold bg-gold text-ink font-semibold"
                      : "border-gold/25 bg-coal/50 text-sand hover:border-gold/50 hover:text-ivory"
                  }`}
                >
                  {region}{" "}
                  <span
                    className={`text-[10px] ml-1 ${
                      isActive ? "text-ink/75 font-semibold" : "text-gold"
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Quick Search (Desktop) */}
          <div className="relative w-full md:w-auto md:min-w-[260px] hidden lg:block">
            <input
              type="text"
              placeholder="Search state, capital, or variety..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] border border-gold/25 bg-coal/70 px-4 py-2 pl-9 pr-8 text-base sm:text-xs font-mono text-ivory placeholder:text-sand/40 outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold"
            />
            <svg
              className="absolute left-3 top-3.5 h-3.5 w-3.5 text-gold/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-xs font-mono text-sand/60 hover:text-ivory"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Interactive Grid: Map Canvas + State Directory */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Interactive 3D & Vector Map (7 cols) */}
          <div className="lg:col-span-7">
            <IndiaMapExperience
              activeStateId={activeState?.id || null}
              onSelectState={setActiveState}
              selectedRegion={selectedRegion}
            />
          </div>

          {/* Right: State Directory & Logistics Breakdown (Desktop only - hidden on mobile) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col gap-4">
            <div className="border border-gold/20 bg-coal/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-gold/15 pb-4">
                <div>
                  <h3 className="font-display text-2xl italic font-normal text-ivory">
                    State Logistics Directory
                  </h3>
                  <p className="font-mono text-[11px] text-sand/70 mt-0.5">
                    Verified dispatch corridors & partners
                  </p>
                </div>
                <span className="eyebrow text-gold">
                  {filteredList.length} Active Hubs
                </span>
              </div>

              {/* Scrollable State Hubs List */}
              <div className="mt-4 max-h-[460px] overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                {filteredList.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="font-display text-lg italic text-sand">
                      No states match your search
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedRegion("All")
                      }}
                      className="mt-3 text-xs font-mono text-gold hover:underline"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  filteredList.map((hub) => {
                    const isSelected = activeState?.id === hub.id
                    return (
                      <div
                        key={hub.id}
                        onClick={() => setActiveState(hub)}
                        className={`group cursor-pointer border p-3.5 transition-all duration-300 ${
                          isSelected
                            ? "border-gold bg-gold/[0.12] shadow-[0_0_24px_rgba(217,164,65,0.15)]"
                            : "border-gold/15 bg-vault/50 hover:border-gold/40 hover:bg-vault/90"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                                isSelected
                                  ? "bg-gold text-ink"
                                  : "border border-gold/30 bg-gold/10 text-gold"
                              }`}
                            >
                              {hub.code}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-display text-lg italic text-ivory group-hover:text-gold transition-colors">
                                  {hub.name}
                                </span>
                                {hub.isOrigin && (
                                  <span className="border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-saffron">
                                    Origin Citadel
                                  </span>
                                )}
                              </div>
                              {hub.capital && (
                                <p className="font-mono text-[11px] text-sand/80 mt-0.5">
                                  Capital:{" "}
                                  {hub.capital
                                    .split("(")[0]
                                    .split("/")[0]
                                    .trim()}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-xs text-gold font-medium">
                            {hub.dispatchTime}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-gold/10 pt-2.5 text-[11px] text-sand">
                          <span className="truncate max-w-[210px] font-sans">
                            {hub.primaryVarieties.slice(0, 2).join(" · ")}
                          </span>
                          <span className="font-mono text-ivory/80 font-medium">
                            {hub.partners}+ Mandis
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Direct Inquire CTA for Active State */}
              {activeState && (
                <div className="mt-5 border-t border-gold/15 pt-4">
                  <Button
                    href="#quote"
                    variant="gold"
                    className="w-full !min-h-[48px] !text-xs !tracking-wider"
                  >
                    Book Supply · {activeState.name}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
