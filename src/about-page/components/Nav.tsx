import { useEffect, useState } from "react"
import { onSmoothScroll } from "../lib/smooth"

const navLinks = [
  { name: "STORY", href: "#top" },
  { name: "COLLECTION", href: "#collection" },
  { name: "HERITAGE", href: "#heritage" },
  { name: "VOICES", href: "#voices" },
]

function WheatIcon({
  className = "h-4 w-4 text-gold",
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Central spine */}
      <path
        d="M12 2v20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Top kernel */}
      <path d="M12 2.5C10.6 4.2 10.6 6 12 7.5C13.4 6 13.4 4.2 12 2.5Z" />
      {/* Top pair */}
      <path d="M11.2 6.8C8.8 6.5 7.6 8.5 8.7 10.5C10 9.8 10.8 8.6 11.2 6.8Z" />
      <path d="M12.8 6.8C15.2 6.5 16.4 8.5 15.3 10.5C14 9.8 13.2 8.6 12.8 6.8Z" />
      {/* Middle pair */}
      <path d="M11.2 11.2C8.8 10.9 7.6 12.9 8.7 14.9C10 14.2 10.8 13 11.2 11.2Z" />
      <path d="M12.8 11.2C15.2 10.9 16.4 12.9 15.3 14.9C14 14.2 13.2 13 12.8 11.2Z" />
      {/* Lower pair */}
      <path d="M11.2 15.6C8.8 15.3 7.6 17.3 8.7 19.3C10 18.4 10.8 17.2 11.2 15.6Z" />
      <path d="M12.8 15.6C15.2 15.3 16.4 17.3 15.3 19.3C14 18.4 13.2 17.2 12.8 15.6Z" />
    </svg>
  )
}

function LockIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="11" rx="2.5" ry="2.5" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function Nav() {
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const f = () => setSolid(window.scrollY > 40)
    f()
    const unsub = onSmoothScroll((e) => setSolid(e.scroll > 40))
    window.addEventListener("scroll", f, { passive: true })
    return () => {
      unsub()
      window.removeEventListener("scroll", f)
    }
  }, [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setShowSignIn(false)
      }
    }
    addEventListener("keydown", k)
    return () => removeEventListener("keydown", k)
  }, [])

  return (
    <>
      <header
        style={{
          top: "max(0.5rem, calc(0.35rem + env(safe-area-inset-top, 0px)))",
          paddingLeft: "max(0.625rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(0.625rem, env(safe-area-inset-right, 0px))",
        }}
        className="fixed inset-x-0 z-50 flex flex-col items-center pointer-events-none"
      >
        {/* Transparent Floating Glass Pill Bar */}
        <div
          className={`pointer-events-auto relative flex w-full max-w-[1240px] items-center justify-between min-h-[48px] h-[52px] sm:h-[58px] md:h-[62px] px-3 sm:px-6 md:px-8 rounded-full border border-white/20 transition-all duration-500 ${
            solid
              ? "bg-black/40 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.5)] border-white/25"
              : "bg-black/15 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
          }`}
        >
          {/* Left Brand: Wheat Icon + TEJAS CANVASSING */}
          <a
            href="#home"
            className="group flex items-center gap-2 sm:gap-3 shrink-0 focus-visible:outline-none min-h-[44px]"
            aria-label="Tejas Canvassing, back to top"
          >
            <WheatIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gold shrink-0 transition-transform duration-300 group-hover:scale-110" />
            <span className="font-mono text-[10px] sm:text-xs text-ivory tracking-[0.16em] sm:tracking-[0.28em] uppercase transition-colors group-hover:text-gold whitespace-nowrap">
              TEJAS CANVASSING
            </span>
          </a>

          {/* Center Links: STORY, COLLECTION, HERITAGE, VOICES */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-8 xl:gap-10"
          >
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="eyebrow link-sweep py-2 text-ivory/70 transition-colors hover:text-gold"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Right Actions: SKIP TO QUOTE and SIGN IN */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <a
              href="#quote"
              className="eyebrow group hidden sm:inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/20 hover:bg-gold/30 hover:border-gold px-4 sm:px-5 min-h-[44px] py-2 text-gold transition-all duration-300 active:scale-95 whitespace-nowrap"
            >
              <span>SKIP TO QUOTE</span>
              <span
                className="transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                →
              </span>
            </a>

            <button
              type="button"
              onClick={() => setShowSignIn(true)}
              className="eyebrow inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/5 hover:bg-white/15 hover:border-white/40 px-3 sm:px-4 min-h-[44px] py-2 text-ivory transition-all duration-300 active:scale-95 whitespace-nowrap"
            >
              <LockIcon className="h-3 w-3 text-ivory/80" />
              <span className="text-[10px] sm:text-xs">SIGN IN</span>
            </button>

            {/* Mobile Menu Toggle Button (Accessible 44x44px touch area) */}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen(!open)}
              className="lg:hidden grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-full border border-white/20 bg-white/5 text-gold hover:bg-white/10 active:bg-white/15 transition-colors ml-0.5"
            >
              <span className="relative block h-3 w-4">
                <span
                  className={`absolute left-0 top-0 h-px w-4 bg-gold transition-transform duration-300 ${
                    open ? "translate-y-[5px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[10px] h-px w-4 bg-gold transition-transform duration-300 ${
                    open ? "-translate-y-[5px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {open && (
          <>
            {/* Backdrop click dismiss */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden pointer-events-auto"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              id="mobile-nav"
              className="pointer-events-auto relative z-50 mt-2 w-full max-w-[1240px] max-h-[calc(100dvh-88px-env(safe-area-inset-top))] overflow-y-auto rounded-3xl border border-white/20 bg-ink/95 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl lg:hidden animate-fadeIn pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            >
              <nav className="flex flex-col gap-1">
                {navLinks.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="eyebrow flex min-h-[48px] items-center justify-between border-b border-white/10 py-3.5 text-ivory transition-colors hover:text-gold active:text-gold"
                  >
                    <span className="text-xs sm:text-sm font-medium tracking-widest">{item.name}</span>
                    <span className="text-sm text-gold" aria-hidden="true">→</span>
                  </a>
                ))}
                <div className="mt-4 flex flex-col gap-2.5 pt-1">
                  <a
                    href="#quote"
                    onClick={() => setOpen(false)}
                    className="eyebrow flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-gold/50 bg-gold/20 py-3.5 text-gold font-medium transition-all active:scale-95"
                  >
                    <span className="text-xs tracking-widest">SKIP TO QUOTE</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </nav>
            </div>
          </>
        )}
      </header>

      {/* Trade Portal Sign In Dialog */}
      {showSignIn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowSignIn(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/20 bg-[#14100b] p-5 sm:p-7 text-ivory shadow-[0_24px_64px_rgba(0,0,0,0.8)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowSignIn(false)}
              className="absolute right-4 top-4 grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-full border border-white/15 bg-white/5 text-sand hover:text-ivory hover:border-white/30 active:scale-95 transition-transform"
              aria-label="Close dialog"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-gold/40 bg-gold/10">
                <WheatIcon className="h-5 w-5 text-gold" />
              </div>
              <div>
                <span className="eyebrow text-gold">Trade Portal</span>
                <h3
                  id="signin-title"
                  className="font-display text-2xl italic text-white mt-1"
                >
                  Commercial Sign In
                </h3>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-sand">
              Direct access for authorized Mandi wholesalers, export partners,
              and institutional grain procurement teams.
            </p>

            {signedIn ? (
              <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-5 text-center">
                <p className="eyebrow text-gold">✓ Trade Account Verified</p>
                <p className="mt-1 text-xs text-sand">
                  Redirecting to live mandi allocations & pricing…
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowSignIn(false)
                    window.location.href = "/login"
                  }}
                  className="eyebrow mt-4 min-h-[48px] w-full rounded-full bg-gold py-3 text-ink font-semibold active:scale-95 transition-transform"
                >
                  Enter Portal
                </button>
              </div>
            ) : (
              <form
                className="mt-6 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSignedIn(true)
                }}
              >
                <div>
                  <label className="block eyebrow text-sand mb-1.5">
                    Buyer ID / Registered Email
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TC-9482 or buyer@trade.com"
                    className="w-full min-h-[48px] rounded-xl border border-white/15 bg-coal/80 px-4 py-3 text-base sm:text-sm text-ivory placeholder:text-sand/40 focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block eyebrow text-sand mb-1.5">
                    Access Pin / Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full min-h-[48px] rounded-xl border border-white/15 bg-coal/80 px-4 py-3 text-base sm:text-sm text-ivory placeholder:text-sand/40 focus:border-gold focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-sand">
                  <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      className="accent-gold rounded h-4 w-4"
                      defaultChecked
                    />
                    <span className="eyebrow text-sand text-[10px] sm:text-xs">Remember terminal</span>
                  </label>
                  <a
                    href="#quote"
                    onClick={() => setShowSignIn(false)}
                    className="eyebrow text-gold hover:underline text-[10px] sm:text-xs py-1"
                  >
                    Forgot PIN?
                  </a>
                </div>

                <button
                  type="submit"
                  className="eyebrow mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-gold bg-gold py-3.5 text-ink font-semibold shadow-sm transition-transform hover:brightness-105 active:scale-95"
                >
                  <LockIcon className="h-3.5 w-3.5 text-ink" />
                  <span>Authenticate & Enter</span>
                </button>

                <p className="text-center font-mono text-[10px] text-sand/70 pt-2">
                  Not a verified buyer yet?{" "}
                  <a
                    href="#quote"
                    onClick={() => setShowSignIn(false)}
                    className="text-gold underline underline-offset-2"
                  >
                    Request trade allotment
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
