const items = [
  ["FSSAI licensed", "Every lot milled and packed to food-safety standard."],
  ["Aged in silo", "Six to twenty-four months of quiet ageing."],
  ["Farm origin", "Traceable to Karnal and Wada growers."],
  ["Export quality", "Graded twice, sealed, shipped worldwide."],
]
export default function Trust() {
  return (
    <section
      aria-label="Our assurances"
      className="on-ivory bg-ivory text-earth"
    >
      <div className="wrap">
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {items.map(([t, d], i) => (
            <li
              key={t}
              className={`py-6 sm:py-9 pr-3 sm:pr-6 ${
                i > 0 ? "lg:border-l lg:border-earth/15 lg:pl-8" : ""
              } ${i % 2 ? "border-l border-earth/15 pl-3.5 sm:pl-6 lg:pl-8" : ""}`}
            >
              <p className="eyebrow text-brass">0{i + 1}</p>
              <h3 className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl italic leading-tight">
                {t}
              </h3>
              <p className="mt-1.5 sm:mt-2 max-w-[22ch] text-xs sm:text-sm leading-relaxed text-umber">
                {d}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
