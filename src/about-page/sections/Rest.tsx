import { useState } from "react"
import Reveal, { CountUp, useInView } from "../components/Reveal"
import SplitText from "../components/SplitText"
import SectionLabel from "../components/SectionLabel"
import Button from "../components/Button"
import { waLink } from "../lib/whatsapp"
import { VARIETIES } from "../data"

export function Heritage() {
  const steps = [
    [
      "Harvest",
      "Late autumn, Karnal and Wada",
      "Paddy cut at peak moisture by growers we have known for decades.",
    ],
    [
      "Rest",
      "6 to 24 months",
      "Silent ageing in aerated silos. Aroma deepens, grain firms.",
    ],
    [
      "Mill",
      "Precision polish",
      "A gentle polish that keeps the needle tip and pearl core whole.",
    ],
    [
      "Grade",
      "Optical and human eye",
      "Sorted twice: once by machine, once by hand.",
    ],
    [
      "Deliver",
      "Pan-India and export",
      "Sealed, traceable, on the day we promise.",
    ],
  ]
  const [ref, seen] = useInView<HTMLOListElement>(0.1)
  return (
    <section
      id="heritage"
      aria-labelledby="heritage-title"
      className="section on-ivory relative bg-ivory text-earth"
    >
      <div className="wrap">
        <SectionLabel n="04" tone="light">
          Heritage
        </SectionLabel>
        <SplitText
          id="heritage-title"
          text={"Decades of trust,\n_grain by grain._"}
          className="display-lg mt-6 max-w-4xl"
        />
        <dl className="mt-10 sm:mt-20 grid grid-cols-2 border-y border-earth/20 lg:grid-cols-4">
          {[
            [20, "+", "Years in grain trade"],
            [1200, "+", "Trade partners"],
            [5, "", "Signature varieties"],
            [98, "%", "Separation, best lot"],
          ].map(([n, sx, l], i) => (
            <div
              key={l as string}
              className={`py-6 sm:py-10 pr-2 sm:pr-4 ${
                i % 2 ? "border-l border-earth/20 pl-3.5 sm:pl-6" : ""
              } ${i > 0 ? "lg:border-l lg:border-earth/20 lg:pl-8" : ""}`}
            >
              <dd className="font-display text-4xl sm:text-6xl italic md:text-7xl">
                <CountUp to={n as number} suffix={sx as string} />
              </dd>
              <dt className="eyebrow mt-2 sm:mt-3 text-xs sm:text-sm text-umber">{l}</dt>
            </div>
          ))}
        </dl>

        {/* Milestone Steps Timeline */}
        <div className="mt-12 sm:mt-20">
          <ol
            ref={ref}
            className="relative ml-2 border-l border-earth/20 pl-6 sm:pl-10 md:pl-16 max-w-4xl"
          >
            <span
              aria-hidden="true"
              className="absolute -left-px top-0 w-px origin-top bg-brass transition-transform duration-[2200ms] ease-out"
              style={{
                height: "100%",
                transform: seen ? "scaleY(1)" : "scaleY(0)",
              }}
            />
            {steps.map(([t, m, d], i) => (
              <Reveal key={t} delay={60}>
                <li className="relative pb-10 sm:pb-14 last:pb-0">
                  <span className="absolute -left-[29px] sm:-left-[37px] md:-left-[69px] top-3.5 sm:top-4 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-brass" />
                  <div className="grid gap-2 sm:gap-2.5 md:grid-cols-[90px_1fr_1.3fr] md:items-baseline md:gap-8">
                    <span className="eyebrow text-brass font-bold">
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="display-md text-earth">{t}</h3>
                      <p className="eyebrow mt-0.5 sm:mt-1 text-umber/80">{m}</p>
                    </div>
                    <p className="max-w-md leading-relaxed text-umber text-sm sm:text-base">
                      {d}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

const quotes = [
  [
    "The 1121 cooks up two fingers long and never clumps. Our biryani finally has a signature.",
    "Executive Chef",
    "Moti Mahal Group",
  ],
  [
    "Lot after lot, the grading is exactly what the spec sheet says. In twenty years of buying, that is rare.",
    "Import Director",
    "Gulf Pantry Trading",
  ],
  [
    "They fixed prices with us before sowing and honoured them through a hard season. That is partnership.",
    "Procurement Head",
    "Southern Staples Retail",
  ],
]

export function Voices() {
  const [i, setI] = useState(0)
  const go = (d: number) => setI((i + d + quotes.length) % quotes.length)
  return (
    <section
      id="voices"
      aria-label="Voices from the trade"
      className="section relative overflow-hidden bg-vault"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none font-display text-[40vw] italic leading-none text-gold/[0.05]">
        &ldquo;
      </div>
      <div className="relative mx-auto max-w-4xl text-center">
        <div className="flex justify-center">
          <SectionLabel n="06">Voices from the trade</SectionLabel>
        </div>
        <div
          key={i}
          aria-live="polite"
          className="reveal in mt-8 sm:mt-12 min-h-[220px] sm:min-h-[280px] px-2 sm:px-0"
        >
          <blockquote className="font-display text-2xl sm:text-3xl md:text-5xl italic leading-snug">
            {quotes[i][0]}
          </blockquote>
          <p className="mt-6 sm:mt-10 text-sm font-semibold tracking-wide">
            {quotes[i][1]}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sand">
            {quotes[i][2]}
          </p>
        </div>
        <div className="mt-6 sm:mt-10 flex items-center justify-center gap-6">
          <button
            aria-label="Previous testimonial"
            onClick={() => go(-1)}
            className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-full border border-gold/40 text-gold transition-all hover:bg-gold hover:text-ink active:scale-95"
          >
            ←
          </button>
          <div className="flex gap-2">
            {quotes.map((_, k) => (
              <span
                key={k}
                className={`h-1 rounded-full transition-all ${
                  k === i ? "w-8 bg-gold" : "w-2 bg-gold/30"
                }`}
              />
            ))}
          </div>
          <button
            aria-label="Next testimonial"
            onClick={() => go(1)}
            className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-full border border-gold/40 text-gold transition-all hover:bg-gold hover:text-ink active:scale-95"
          >
            →
          </button>
        </div>
      </div>
    </section>
  )
}

type Errs = Partial<Record<"name" | "email" | "phone" | "qty", string>>

export function Quote({
  sel,
  setSel,
}: {
  sel: number
  setSel: (n: number) => void
}) {
  const [qty, setQty] = useState(500)
  const [done, setDone] = useState(false)
  const [errs, setErrs] = useState<Errs>({})
  const v = VARIETIES[sel]
  const bagWeightKg = v.name === "Keshar Kali" ? 30 : 26
  const bagCount = Math.ceil(qty / bagWeightKg)
  const field =
    "w-full min-h-[48px] border-b border-gold/30 bg-transparent py-3 text-base sm:text-sm text-ivory placeholder:text-sand/60 transition-colors focus:border-gold focus:outline-none aria-[invalid=true]:border-saffron"
  const lab = "eyebrow text-sand"

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const g = (k: string) => String(f.get(k) ?? "").trim()
    const er: Errs = {}
    if (g("name").length < 2) er.name = "Please enter your name."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g("email")))
      er.email = "Enter a valid email, like you@company.com."
    if (g("phone") && g("phone").replace(/\D/g, "").length < 8)
      er.phone = "Phone number looks too short."
    const n = Number(g("qty"))
    if (!n || n < 100) er.qty = "Minimum order is 100 kg."
    setErrs(er)
    if (Object.keys(er).length) {
      const first = Object.keys(er)[0]
      ;(e.currentTarget.elements.namedItem(
        first,
      ) as HTMLElement | null)?.focus()
      return
    }
    setDone(true)
  }

  const err = (k: keyof Errs) =>
    errs[k] && (
      <p id={`e-${k}`} role="alert" className="mt-2 text-sm text-saffron">
        {errs[k]}
      </p>
    )
  const a11y = (k: keyof Errs) => ({
    "aria-invalid": !!errs[k],
    "aria-describedby": errs[k] ? `e-${k}` : undefined,
  })

  return (
    <section
      id="quote"
      aria-labelledby="quote-title"
      className="section relative bg-ink"
    >
      <div className="wrap grid-12 gap-y-10 lg:gap-y-16">
        <Reveal className="col-span-12 lg:col-span-5">
          <SectionLabel n="08">Request a quote</SectionLabel>
          <SplitText
            id="quote-title"
            text={"Let us fill\n_your silo._"}
            className="display-lg mt-6"
          />
          <p className="lede mt-6 text-sand">
            Pick a variety, tell us your volume. Formal quotation and dispatch
            schedule in your inbox within one business day.
          </p>
          <div
            className="mt-8 sm:mt-10 flex flex-wrap gap-2"
            role="group"
            aria-label="Variety"
          >
            {VARIETIES.map((x, i) => (
              <button
                key={x.name}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={i === sel}
                className={`min-h-[44px] rounded-full border px-4 sm:px-5 text-xs sm:text-sm transition-all ${
                  i === sel
                    ? "border-gold bg-gold text-ink font-medium"
                    : "border-gold/30 text-sand hover:border-gold hover:text-ivory"
                }`}
              >
                {x.name}
              </button>
            ))}
          </div>
          <div className="mt-8 sm:mt-10 max-w-sm border-t border-gold/20 pt-5 select-none">
            <div className="flex items-baseline justify-between text-sm text-sand select-none">
              <span className="font-mono text-xs uppercase tracking-wider text-sand/80">Batch Requirement</span>
              <span className="font-display text-2xl sm:text-3xl italic text-gold tabular-nums">
                ~{bagCount.toLocaleString("en-IN")} bags
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-xs font-mono text-ivory/80 select-none">
              <span>Selected volume:</span>
              <span className="text-sm font-semibold text-gold tabular-nums">{qty.toLocaleString("en-IN")} kg</span>
            </div>
            <input
              type="range"
              min={100}
              max={10000}
              step={bagWeightKg}
              value={qty}
              onChange={(e) => setQty(+e.target.value)}
              aria-label="Quantity in kilograms"
              className="mt-4 h-2.5 w-full appearance-none rounded-full bg-gold/20 accent-[#d9a441] cursor-pointer cursor-grab active:cursor-grabbing focus:outline-none select-none"
            />
            <div className="flex justify-between text-[10px] font-mono text-sand/60 mt-1.5 select-none">
              <span>100 kg</span>
              <span>5,000 kg</span>
              <span>10,000 kg</span>
            </div>
            <p className="eyebrow mt-3 text-sand select-none">
              {v.name === "Keshar Kali"
                ? "30 kg signature export sacks"
                : "26 kg standard export sacks"}{" "}
              · Wholesale quotation on request
            </p>
          </div>
          <div className="mt-6 sm:mt-8">
            <Button
              href={waLink(
                `Hello Tejas Canvassing, I would like to request a wholesale quote for ${qty} kg (~${bagCount} bags of ${bagWeightKg} kg) of ${v.name}.`,
              )}
              external
              variant="line"
              className="w-full sm:w-auto"
            >
              Send WhatsApp
            </Button>
          </div>
        </Reveal>
        <div className="col-span-12 border border-gold/20 bg-coal p-5 sm:p-8 md:p-12 lg:col-span-6 lg:col-start-7">
          {done ? (
            <div
              role="status"
              className="flex min-h-[420px] flex-col items-center justify-center text-center"
            >
              <div className="grid h-16 w-16 place-items-center rounded-full border border-gold text-2xl text-gold">
                ✓
              </div>
              <h3 className="mt-7 font-display text-4xl italic">
                Request received.
              </h3>
              <p className="mt-3 max-w-xs text-sand">
                Our trade desk will write to you within one business day about{" "}
                {v.name}.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  href={waLink(
                    `Hello Tejas Canvassing, I submitted a quote request for ${qty} kg of ${v.name}.`,
                  )}
                  external
                  variant="line"
                >
                  Send WhatsApp
                </Button>
                <button
                  onClick={() => setDone(false)}
                  className="eyebrow min-h-[44px] rounded-full border border-gold/40 px-6 text-gold transition-colors hover:bg-gold hover:text-ink"
                >
                  New request
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={submit}
              noValidate
              className="grid gap-x-8 gap-y-7 sm:grid-cols-2"
            >
              <label className="block">
                <span className={lab}>Name *</span>
                <input
                  name="name"
                  autoComplete="name"
                  className={field}
                  placeholder="Your full name"
                  {...a11y("name")}
                />
                {err("name")}
              </label>
              <label className="block">
                <span className={lab}>Company</span>
                <input
                  name="company"
                  autoComplete="organization"
                  className={field}
                  placeholder="Business or kitchen"
                />
              </label>
              <label className="block">
                <span className={lab}>Email *</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={field}
                  placeholder="you@company.com"
                  {...a11y("email")}
                />
                {err("email")}
              </label>
              <label className="block">
                <span className={lab}>Phone</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className={field}
                  placeholder="+91"
                  {...a11y("phone")}
                />
                {err("phone")}
              </label>
              <label className="block">
                <span className={lab}>Variety</span>
                <select
                  name="variety"
                  value={sel}
                  onChange={(e) => setSel(+e.target.value)}
                  className={`${field} bg-coal`}
                >
                  {VARIETIES.map((x, i) => (
                    <option key={x.name} value={i}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={lab}>Quantity (kg) *</span>
                <input
                  name="qty"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  value={qty}
                  onChange={(e) => setQty(+e.target.value)}
                  className={field}
                  {...a11y("qty")}
                />
                {err("qty")}
              </label>
              <label className="block sm:col-span-2">
                <span className={lab}>Message</span>
                <textarea
                  name="message"
                  rows={3}
                  className={`${field} resize-none`}
                  placeholder="Packaging, delivery city, timeline"
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full !min-h-[48px] justify-center">
                  Send request, {v.name}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer
      aria-label="Site footer"
      className="relative overflow-hidden border-t border-gold/20 bg-coal px-5 sm:px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-14 sm:pt-20 md:px-12 md:pt-28"
    >
      <div className="mx-auto grid max-w-[1300px] gap-8 sm:gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <p className="max-w-xs font-display text-2xl sm:text-3xl italic leading-snug text-ivory/90">
          Carefully sourced. Thoughtfully processed. Delivered with trust.
        </p>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-sand">
            Explore
          </p>
          <ul className="mt-4 space-y-2.5 sm:space-y-3 text-sm">
            {[
              ["Journey", "#top"],
              ["Collection", "#collection"],
              ["Heritage", "#heritage"],
              ["Network", "#network"],
              ["FAQ", "#faq"],
              ["Request a quote", "#quote"],
            ].map(([l, h]) => (
              <li key={l}>
                <a
                  href={h}
                  className="inline-flex items-center min-h-[44px] py-1 text-ivory/80 transition-colors hover:text-gold"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-sand">
            Trade desk
          </p>
          <ul className="mt-4 space-y-2.5 sm:space-y-3 text-sm text-ivory/80">
            <li>trade@tejascanvassing.in</li>
            <li>+91 98110 22334</li>
            <li>
              Grain Market Road, Karnal,
              <br />
              Haryana 132001, India
            </li>
          </ul>
        </div>
      </div>
      <div className="pointer-events-none mt-12 sm:mt-16 select-none text-center font-display text-[clamp(4.5rem,20vw,20rem)] italic leading-[0.8] text-gold/[0.07]">
        Tejas
      </div>
      <div className="mx-auto mt-8 flex max-w-[1300px] flex-col justify-between gap-3 border-t border-gold/15 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-sand md:flex-row">
        <span>© 2026 Tejas Canvassing</span>
        <span>Aged · Graded · Guarded</span>
      </div>
    </footer>
  )
}
