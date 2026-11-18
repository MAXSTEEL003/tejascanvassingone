export default function Grain({
  w = 200,
  tone = ["#fffdf7", "#f6edd9", "#d2b47e"],
  id = "g",
}: {
  w?: number
  tone?: string[]
  id?: string
}) {
  const h = w * 0.2
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 200 40"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 8px 14px rgba(0,0,0,.55))" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone[0]} />
          <stop offset=".55" stopColor={tone[1]} />
          <stop offset="1" stopColor={tone[2]} />
        </linearGradient>
      </defs>
      <path
        d="M2 20 C 30 2, 150 2, 197 17 L 198 23 C 150 38, 30 38, 2 20 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M12 16 C 60 8, 130 8, 185 18"
        stroke="#fff"
        strokeOpacity=".55"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
