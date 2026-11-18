import { useState } from "react"
import SplitText from "../components/SplitText"
import SectionLabel from "../components/SectionLabel"

const faqs = [
  [
    "What is the minimum order?",
    "One hundred kilograms for any single variety. Mixed pallets are available from five hundred kilograms.",
  ],
  [
    "How long is the rice aged?",
    "Between six and twenty-four months in aerated silos, depending on the variety. The ageing period is printed on every spec sheet.",
  ],
  [
    "Do you export?",
    "Yes. We pack to export standard with lot traceability and ship through Indian ports on FOB and CIF terms.",
  ],
  [
    "Can I get samples?",
    "Send us your address and the variety you wish to try. A one-kilo sample leaves Karnal within two working days.",
  ],
  [
    "How fast will I hear back?",
    "Within one business day. For urgent lots, specify your dispatch timeline in your quote request.",
  ],
  [
    "Which variety suits biryani?",
    "1121 Basmati. At 8.4 mm raw it cooks long, dry and separate. Keshar Kali is our choice for a softer, fragrant pulao.",
  ],
]

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="section on-ivory bg-ivory text-earth"
    >
      <div className="wrap grid-12">
        <div className="col-span-12 lg:col-span-5">
          <SectionLabel n="07" tone="light">
            Questions
          </SectionLabel>
          <SplitText
            id="faq-title"
            text={"Asked,\n_answered._"}
            className="display-lg mt-6"
          />
        </div>
        <div className="col-span-12 mt-8 sm:mt-12 lg:col-span-7 lg:mt-4">
          <ul className="border-t border-earth/20">
            {faqs.map(([q, a], i) => {
              const o = open === i
              return (
                <li key={q} className="border-b border-earth/20">
                  <h3>
                    <button
                      aria-expanded={o}
                      aria-controls={`faq-${i}`}
                      id={`faq-b-${i}`}
                      onClick={() => setOpen(o ? null : i)}
                      className="flex min-h-[56px] sm:min-h-[64px] w-full items-center justify-between gap-4 sm:gap-6 py-4 sm:py-5 text-left font-display text-xl sm:text-2xl md:text-3xl"
                    >
                      <span>{q}</span>
                      <span
                        aria-hidden="true"
                        className={`grid h-8 w-8 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-full border border-earth/30 text-lg sm:text-xl transition-transform duration-500 ${
                          o ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`faq-${i}`}
                    role="region"
                    aria-labelledby={`faq-b-${i}`}
                    className={`grid transition-[grid-template-rows] duration-500 ${
                      o ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-xl pb-5 sm:pb-7 text-sm sm:text-base leading-relaxed text-umber">
                        {a}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
