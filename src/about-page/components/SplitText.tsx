import { createElement } from "react"
import { useInView } from "./Reveal"

/** Words masked and lifted in sequence. Wrap a word in _underscores_ for gold italic; use \n for a line break. */
export default function SplitText({
  text,
  as = "h2",
  className = "",
  delay = 0,
  step = 55,
  immediate = false,
  id,
}: {
  id?: string
  text: string
  as?: "h1" | "h2" | "h3" | "p"
  className?: string
  delay?: number
  step?: number
  immediate?: boolean
}) {
  const [ref, seen] = useInView<HTMLElement>(0.25)
  let i = 0
  const lines = text.split("\n")
  return createElement(
    as,
    {
      ref,
      id,
      className: `${className} ${seen || immediate ? "in-view" : ""}`,
      "aria-label": text.replace(/_/g, "").replace(/\n/g, " "),
    },
    lines.map((line, li) => (
      <span key={li} aria-hidden="true" className="block">
        {line.split(" ").map((w) => {
          const em = w.startsWith("_") && w.endsWith("_")
          const word = em ? w.slice(1, -1) : w
          const d = delay + i++ * step
          return (
            <span key={`${li}-${i}`} className="mask mr-[0.22em]">
              <span
                style={{ ["--d" as string]: `${d}ms` }}
                className={em ? "italic gold-text" : ""}
              >
                {word}
              </span>
            </span>
          )
        })}
      </span>
    )),
  )
}
