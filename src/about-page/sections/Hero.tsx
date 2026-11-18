import GrainField from "../components/GrainField"
import SplitText from "../components/SplitText"
import Button from "../components/Button"
import Parallax from "../components/Parallax"
import { CountUp } from "../components/Reveal"

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` })

export default function Hero() {
  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="relative flex min-h-[100dvh] items-center overflow-hidden bg-ink"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_72%_38%,rgba(217,164,65,.2),transparent_70%),radial-gradient(ellipse_50%_50%_at_8%_95%,rgba(236,138,42,.12),transparent_70%)]" />
      <GrainField />
      <div className="vignette pointer-events-none absolute inset-0" />
      <div
        style={{ paddingTop: "calc(max(6.5rem, 5.5rem + env(safe-area-inset-top, 0px)))" }}
        className="wrap relative grid-12 w-full items-end pb-14 md:pb-28"
      >
        <div className="col-span-12 lg:col-span-9">
          <p className="reveal in eyebrow text-gold" style={d(1500)}>
            Gadchiroli · Miryalaguda · Est. two decades of grain
          </p>
          <Parallax speed={0.04}>
            <SplitText
              id="hero-title"
              as="h1"
              text={"The _grain_\nof people."}
              delay={1500}
              step={90}
              immediate
              className="display-xl mt-4 sm:mt-7"
            />
          </Parallax>
          <p className="reveal in lede mt-5 sm:mt-10 text-sand max-w-xl" style={d(2000)}>
            Multiple varieties, aged up to twenty-four months in silence, graded by
            eye and by machine. Rice worth the wait.
          </p>
          <div
            className="reveal in mt-6 sm:mt-10 flex items-center"
            style={d(2200)}
          >
            <Button
              href="#top"
              className="w-full sm:w-auto min-h-[48px] !shadow-[0_8px_24px_rgba(217,164,65,0.25)] hover:!shadow-[0_12px_32px_rgba(217,164,65,0.4)] transition-all active:scale-95"
            >
              Begin the journey <span aria-hidden="true" className="ml-1 inline-block">↓</span>
            </Button>
          </div>

          {/* Mobile At a Glance Ribbon: Sculpted Glass Capsule */}
          <div
            className="reveal in mt-6 sm:mt-8 relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-vault/80 via-coal/90 to-ink/95 p-3.5 xs:p-4 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.45)] lg:hidden"
            style={d(2400)}
          >
            {/* Top specular hairline accent */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

            <dl className="grid grid-cols-3 divide-x divide-gold/15">
              {[
                ["24", " mo", "Silo Aged"],
                ["8.4", " mm", "Max Grain"],
                ["10", "", "Varieties"],
              ].map(([n, u, l]) => (
                <div key={l} className="flex flex-col items-center justify-center px-1 text-center">
                  <dd className="font-display text-2xl xs:text-3xl italic text-gold font-normal tracking-tight leading-none drop-shadow-[0_2px_12px_rgba(217,164,65,0.2)]">
                    <CountUp
                      to={parseFloat(n)}
                      decimals={n.includes(".") ? 1 : 0}
                      suffix={u}
                    />
                  </dd>
                  <dt className="font-mono text-[9px] xs:text-[10px] uppercase tracking-[0.16em] text-sand/80 mt-1.5 whitespace-nowrap">
                    {l}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <aside
          aria-label="At a glance"
          className="reveal in col-span-12 mt-16 hidden lg:col-span-3 lg:mt-0 lg:block"
          style={d(2400)}
        >
          <dl className="border-t border-gold/30">
            {[
              ["24", " mo", "Silo ageing"],
              ["8.4", " mm", "Longest grain"],
              ["10", "", "Varieties"],
            ].map(([n, u, l]) => (
              <div
                key={l}
                className="flex items-baseline justify-between border-b border-gold/15 py-5"
              >
                <dt className="eyebrow text-sand">{l}</dt>
                <dd className="font-display text-5xl italic">
                  <CountUp
                    to={parseFloat(n)}
                    decimals={n.includes(".") ? 1 : 0}
                    suffix={u}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      <div
        aria-hidden="true"
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 md:flex"
      >
        <span className="eyebrow text-sand">Scroll</span>
        <span className="scroll-cue block h-10 w-px bg-gold" />
      </div>
    </section>
  )
}
