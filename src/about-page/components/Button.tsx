import type { ReactNode } from "react"
import Magnetic from "./Magnetic"

type Props = {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: "button" | "submit"
  variant?: "gold" | "line" | "ink" | "line-dark"
  className?: string
  external?: boolean
  disabled?: boolean
  magnetic?: boolean
}

export default function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "gold",
  className = "",
  external,
  disabled,
  magnetic = true,
}: Props) {
  const cls = `btn btn-${variant} ${className}`
  const inner = href ? (
    <a
      href={href}
      onClick={onClick}
      className={cls}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  ) : (
    <button type={type} onClick={onClick} className={cls} disabled={disabled}>
      {children}
    </button>
  )
  return magnetic ? <Magnetic>{inner}</Magnetic> : inner
}
