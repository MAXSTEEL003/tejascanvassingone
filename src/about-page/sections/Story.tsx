import Reveal from "../components/Reveal"
import Grain from "../components/Grain"

const words = [
  "Every",
  "grain",
  "is",
  "chosen,",
  "aged,",
  "graded",
  "and",
  "guarded",
  "before",
  "it",
  "reaches",
  "your",
  "table.",
]

export function Marquee() {
  const items = [
    "Wada Kolam",
    "HMT Raw",
    "Sona Masoori",
    "KNM Raw",
    "1121 Basmati",
    "Aged 24 Months",
    "Hand-graded",
  ]
  const row = [...items, ...items]
  return (
    <div className="overflow-hidden border-y border-gold/20 bg-coal py-4 sm:py-6">
      <div
        className="flex w-max"
        style={{ animation: "marquee 40s linear infinite" }}
      >
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((t, i) => (
              <span
                key={i}
                className="flex items-center gap-6 sm:gap-10 px-3 sm:px-5 font-display text-2xl sm:text-3xl italic text-ivory/85 md:text-5xl"
              >
                {t}
                <span className="text-gold/50 text-xl sm:text-2xl font-light not-italic">·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Story() {
  return (
    <section
      id="story"
      className="relative bg-ink px-5 sm:px-6 py-16 sm:py-24 md:px-12 md:py-44"
    >
      <div className="mx-auto max-w-[1300px]">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold">
            01 — Philosophy
          </p>
        </Reveal>
        <h2 className="mt-8 font-display text-[clamp(2.4rem,6.5vw,6rem)] leading-[1.05]">
          {words.map((w, i) => (
            <Reveal key={i} delay={i * 70} className="mr-[0.25em] inline-block">
              <span className={i === 1 || i === 4 ? "italic text-gold" : ""}>
                {w}
              </span>
            </Reveal>
          ))}
        </h2>
        <div className="mt-12 sm:mt-16 md:mt-24 grid gap-px bg-gold/15 md:grid-cols-3">
          {[
            [
              "I",
              "Sourced",
              "We buy at the farm gate, at harvest, from growers we have known for decades, then pay fair, fixed prices.",
            ],
            [
              "II",
              "Aged",
              "Rested in aerated and wooden silos for 6 to 24 months until every grain dries to a glass-hard, aromatic core.",
            ],
            [
              "III",
              "Guarded",
              "Optically sorted and hand-checked. Lot after lot, the grading matches the spec sheet exactly.",
            ],
          ].map(([n, t, d], i) => (
            <Reveal key={t} delay={i * 150} className="h-full">
              <div className="group h-full bg-ink p-6 sm:p-10 md:p-12 transition-colors duration-500 hover:bg-vault">
                <div className="font-display text-4xl sm:text-5xl italic text-gold/70 transition-colors group-hover:text-gold">
                  {n}
                </div>
                <h3 className="mt-6 sm:mt-10 font-display text-2xl sm:text-3xl">{t}</h3>
                <p className="mt-3 sm:mt-4 leading-relaxed text-sand text-sm sm:text-base">{d}</p>
                <div className="mt-6 sm:mt-10 origin-left scale-x-50 opacity-70 transition-transform duration-700 group-hover:scale-x-100">
                  <Grain w={140} id={`s${i}`} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
