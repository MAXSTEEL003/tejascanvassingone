import { VARIETIES } from "../data"
import Reveal from "../components/Reveal"
import SplitText from "../components/SplitText"
import SectionLabel from "../components/SectionLabel"
import Button from "../components/Button"

export default function Pricing({ setSel }: { setSel: (n: number) => void }) {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="section relative bg-ink"
    >
      <div className="wrap">
        <div className="grid-12 items-end">
          <div className="col-span-12 lg:col-span-7">
            <SectionLabel n="06">Wholesale & Export</SectionLabel>
            <SplitText
              id="pricing-title"
              text={"Commercial export,\n_tailored_ volume."}
              className="display-lg mt-6"
            />
          </div>
          <p className="lede col-span-12 text-sand lg:col-span-4 lg:col-start-9">
            Export-calibrated packaging for culinary kitchens and global trade.
            Only Keshar Kali is packed in 30 kg sacks; all other varieties are
            packed in 26 kg sacks.
          </p>
        </div>
        <Reveal className="mt-10 sm:mt-16">
          {/* Mobile-first editorial cards for phones (< md) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {VARIETIES.map((v, i) => {
              const isKesharKali = v.name === "Keshar Kali"
              return (
                <div
                  key={v.name}
                  className="border border-gold/20 bg-coal/80 p-5 shadow-lg transition-colors hover:border-gold/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl italic font-normal text-ivory">
                        {v.name}
                      </h3>
                      <p className="eyebrow mt-1 text-xs text-sand">
                        {v.subname}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                        isKesharKali
                          ? "border-gold bg-gold/15 text-gold font-bold shadow-[0_0_12px_rgba(217,164,65,0.2)]"
                          : "border-gold/25 bg-black/40 text-sand"
                      }`}
                    >
                      {v.bagWeight} · {isKesharKali ? "Signature" : "Standard"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-y border-gold/15 py-3 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-sand/60 block">
                        Silo Ageing
                      </span>
                      <span className="font-mono text-sm text-ivory/90 font-medium">
                        {v.aged}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-sand/60 block">
                        Grain Length
                      </span>
                      <span className="font-display text-base italic text-gold">
                        {v.len}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-gold/10">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-sand/60 block">
                        Specification
                      </span>
                      <p className="font-sans text-xs text-sand/80 mt-0.5 leading-relaxed">
                        {v.specs.varietyType} · {v.packaging}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      href="#quote"
                      variant="line"
                      className="w-full !min-h-[48px] justify-center !text-xs !tracking-wider"
                      magnetic={false}
                      onClick={() => setSel(i)}
                    >
                      Request Quote · {v.name}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop & Tablet Table (md+) */}
          <div
            className="hidden md:block overflow-x-auto border border-gold/20"
            tabIndex={0}
            role="region"
            aria-label="Wholesale specification table"
          >
            <table className="w-full min-w-[720px] border-collapse text-left">
              <caption className="sr-only">
                Commercial export packaging specifications by variety
              </caption>
              <thead>
                <tr className="border-b border-gold/25 bg-coal">
                  <th scope="col" className="eyebrow p-4 sm:p-5 text-sand">
                    Variety
                  </th>
                  <th scope="col" className="eyebrow p-4 sm:p-5 text-sand">
                    Pack Net Wt.
                  </th>
                  <th scope="col" className="eyebrow p-4 sm:p-5 text-sand">
                    Silo Ageing
                  </th>
                  <th scope="col" className="eyebrow p-4 sm:p-5 text-sand">
                    Grain Specification
                  </th>
                  <th scope="col" className="eyebrow p-4 sm:p-5 text-right text-gold">
                    Wholesale Quote
                  </th>
                </tr>
              </thead>
              <tbody>
                {VARIETIES.map((v, i) => {
                  const isKesharKali = v.name === "Keshar Kali"
                  return (
                    <tr
                      key={v.name}
                      className="border-b border-gold/10 transition-colors hover:bg-gold/[0.05]"
                    >
                      <th
                        scope="row"
                        className="p-5 font-display text-2xl italic font-normal"
                      >
                        {v.name}
                        <span className="eyebrow mt-1 block not-italic text-sand">
                          {v.subname}
                        </span>
                      </th>
                      <td className="p-5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-display text-2xl text-gold font-medium">
                            {v.bagWeight}
                          </span>
                          <span
                            className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                              isKesharKali
                                ? "border-gold/50 bg-gold/15 text-gold font-bold"
                                : "border-gold/20 bg-black/40 text-sand"
                            }`}
                          >
                            {isKesharKali
                              ? "Signature 30 kg"
                              : "Standard 26 kg"}
                          </span>
                        </div>
                        <span className="mt-1 block font-mono text-[11px] text-sand/70">
                          {v.packaging}
                        </span>
                      </td>
                      <td className="p-5 font-mono text-sm text-ivory/80">
                        {v.aged}
                      </td>
                      <td className="p-5 text-sm text-sand">
                        <span className="font-display text-lg italic text-ivory">
                          {v.len}
                        </span>{" "}
                        · {v.specs.varietyType}
                      </td>
                      <td className="p-5 text-right">
                        <Button
                          href="#quote"
                          variant="line"
                          className="!min-h-[44px] !px-5"
                          magnetic={false}
                          onClick={() => setSel(i)}
                        >
                          Request quote
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="eyebrow mt-5 text-sand">
            High-barrier sealed laminated sacks · Lot traceability verified ·
            Custom wholesale quotations and dispatch schedule on request
          </p>
        </Reveal>
      </div>
    </section>
  )
}
