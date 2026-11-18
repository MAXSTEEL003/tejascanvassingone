export default function SectionLabel({
  n,
  total = "09",
  children,
  tone = "dark",
}: {
  n: string
  total?: string
  children: string
  tone?: "dark" | "light"
}) {
  const c = tone === "dark" ? "text-gold" : "text-brass"
  return (
    <div className={`eyebrow flex items-center gap-4 ${c}`}>
      <span>
        {n} / {total}
      </span>
      <span className="h-px w-10 bg-current opacity-50" />
      <span>{children}</span>
    </div>
  )
}
