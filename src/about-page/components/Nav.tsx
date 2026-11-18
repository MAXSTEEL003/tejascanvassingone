import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { 
  Building2, 
  Warehouse, 
  Briefcase, 
  ShieldCheck, 
  ArrowRight, 
  ChevronRight, 
  X, 
  LogIn, 
  UserPlus, 
  Lock 
} from "lucide-react"
import { onSmoothScroll } from "../lib/smooth"

const navLinks = [
  { name: "STORY", href: "#top" },
  { name: "COLLECTION", href: "#collection" },
  { name: "HERITAGE", href: "#heritage" },
  { name: "VOICES", href: "#voices" },
]


export default function Nav() {
  const navigate = useNavigate()
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

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

  const handlePortalNavigate = (path: string) => {
    setShowSignIn(false)
    setOpen(false)
    navigate(path)
  }

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
              ? "bg-black/50 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.5)] border-white/25"
              : "bg-black/20 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
          }`}
        >
          {/* Left Brand: Official Logo + TEJAS CANVASSING */}
          <a
            href="#home"
            className="group flex items-center gap-2.5 sm:gap-3 shrink-0 focus-visible:outline-none min-h-[44px]"
            aria-label="Tejas Canvassing, back to top"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 border border-gold/40 p-0.5 flex items-center justify-center shrink-0 shadow-xs transition-transform duration-300 group-hover:scale-105">
              <img src="/logo.png" alt="Tejas Canvassing" className="w-full h-full object-contain" />
            </div>
            <span className="font-mono text-[10px] sm:text-xs text-ivory tracking-[0.16em] sm:tracking-[0.28em] uppercase transition-colors group-hover:text-gold whitespace-nowrap font-medium">
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

            {/* Sign In / Portals Trigger Button */}
            <button
              type="button"
              onClick={() => setShowSignIn(true)}
              className="eyebrow inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 hover:bg-gold/25 hover:border-gold px-3 sm:px-4 min-h-[44px] py-2 text-gold-light hover:text-white transition-all duration-300 active:scale-95 whitespace-nowrap cursor-pointer shadow-[0_2px_12px_rgba(217,164,65,0.18)]"
              aria-label="Open sign in options"
            >
              <Lock className="h-3 w-3 text-gold" />
              <span className="text-[10px] sm:text-xs font-semibold tracking-wider">SIGN IN</span>
            </button>

            {/* Mobile Menu Toggle Button */}
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
              className="pointer-events-auto relative z-50 mt-2 w-full max-w-[1240px] max-h-[calc(100dvh-88px-env(safe-area-inset-top))] overflow-y-auto rounded-3xl border border-gold/25 bg-ink/95 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl lg:hidden animate-fadeIn pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
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

                {/* Mobile Direct Portal Logins Section */}
                <div className="mt-5 pt-3 border-t border-gold/20 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <img src="/logo.png" alt="Tejas Canvassing" className="w-4 h-4 object-contain rounded-xs" />
                    <span className="eyebrow text-gold text-[10px] font-semibold tracking-[0.2em]">
                      LOGIN PORTALS
                    </span>
                  </div>

                  {/* Merchant Login */}
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=merchant")}
                    className="flex items-center justify-between p-3 rounded-2xl bg-coal/90 border border-gold/30 text-left hover:border-gold transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-ivory">Merchant Login</div>
                        <div className="text-[10px] text-sand/80 font-mono">Wholesale Mandi Orders</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gold" />
                  </button>

                  {/* Miller Login */}
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=miller")}
                    className="flex items-center justify-between p-3 rounded-2xl bg-coal/90 border border-white/15 text-left hover:border-gold transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                        <Warehouse className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-ivory">Miller Portal</div>
                        <div className="text-[10px] text-sand/80 font-mono">Millers & Suppliers</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gold" />
                  </button>

                  {/* Staff Login */}
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=employee")}
                    className="flex items-center justify-between p-3 rounded-2xl bg-coal/90 border border-white/15 text-left hover:border-gold transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-ivory">Staff Operations</div>
                        <div className="text-[10px] text-sand/80 font-mono">APMC Field & Dispatch</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gold" />
                  </button>

                  {/* Admin Login */}
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/admin")}
                    className="flex items-center justify-between p-3 rounded-2xl bg-coal/90 border border-white/15 text-left hover:border-gold transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-ivory">Admin Console</div>
                        <div className="text-[10px] text-sand/80 font-mono">Master Ledger & Analytics</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gold" />
                  </button>

                  {/* Register New Wholesale Buyer */}
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=merchant&tab=signup")}
                    className="mt-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gold/30 bg-gold/10 text-gold font-mono text-[11px] font-semibold tracking-wider hover:bg-gold/20 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>REGISTER AS WHOLESALE BUYER</span>
                  </button>
                </div>

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

      {/* Luxury Trade Portal & Sign In Dialog */}
      {showSignIn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowSignIn(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl border border-gold/30 bg-[#12100c]/98 p-5 sm:p-8 text-ivory shadow-[0_24px_80px_rgba(0,0,0,0.85)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowSignIn(false)}
              className="absolute right-4 top-4 sm:right-6 sm:top-6 grid h-10 w-10 min-h-[40px] min-w-[40px] place-items-center rounded-full border border-white/15 bg-white/5 text-sand hover:text-ivory hover:border-gold/40 active:scale-95 transition-all cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl border border-gold/40 bg-white/10 p-1.5 flex items-center justify-center shadow-[0_0_20px_rgba(217,164,65,0.2)] shrink-0">
                <img src="/logo.png" alt="Tejas Canvassing" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="eyebrow text-gold text-[10px] sm:text-xs">TEJAS TRADING GATEWAY</span>
                <h3
                  id="signin-title"
                  className="font-display text-2xl sm:text-3xl italic text-white mt-0.5"
                >
                  Choose Your Workspace
                </h3>
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-sand/90">
              Direct access for verified mandi wholesalers, rice millers, logistics staff, and executive administration.
            </p>

            {/* 4 Role Portal Cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Merchant / Buyer */}
              <div className="group rounded-2xl border border-gold/30 bg-[#18140e] p-4 sm:p-5 flex flex-col justify-between hover:border-gold hover:shadow-[0_8px_24px_rgba(217,164,65,0.18)] transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/25">
                      Wholesale Buyer
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="font-display text-lg text-white font-medium">Merchant Portal</h4>
                  <p className="mt-1.5 text-xs text-sand/80 leading-relaxed">
                    Live APMC rates, bulk consignment booking, dispatch notifications, and bag tracking.
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=merchant")}
                    className="eyebrow flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-gold text-ink font-semibold text-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Merchant Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=merchant&tab=signup")}
                    className="eyebrow flex items-center justify-center gap-1.5 w-full py-2 rounded-full border border-gold/40 text-gold text-[11px] hover:bg-gold/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Register New Buyer</span>
                  </button>
                </div>
              </div>

              {/* 2. Miller & Supplier */}
              <div className="group rounded-2xl border border-white/15 bg-[#18140e] p-4 sm:p-5 flex flex-col justify-between hover:border-amber-400 hover:shadow-[0_8px_24px_rgba(245,158,11,0.15)] transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/25">
                      Processors
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                      <Warehouse className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="font-display text-lg text-white font-medium">Miller Portal</h4>
                  <p className="mt-1.5 text-xs text-sand/80 leading-relaxed">
                    Update mill rates, submit daily loading status, report dispatches, and review delivery orders.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=miller")}
                    className="eyebrow flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-white/10 border border-white/20 text-ivory hover:border-gold hover:text-gold text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Miller Login</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              </div>

              {/* 3. Operations & Staff */}
              <div className="group rounded-2xl border border-white/15 bg-[#18140e] p-4 sm:p-5 flex flex-col justify-between hover:border-sky-400 hover:shadow-[0_8px_24px_rgba(56,189,248,0.15)] transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full border border-sky-400/25">
                      Operations Desk
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                      <Briefcase className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="font-display text-lg text-white font-medium">Staff Operations</h4>
                  <p className="mt-1.5 text-xs text-sand/80 leading-relaxed">
                    Arrival entries, lorry loading sheets, dispatch tasks, and inventory checks in the yard.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/login?portal=employee")}
                    className="eyebrow flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-white/10 border border-white/20 text-ivory hover:border-sky-400 hover:text-sky-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Staff Sign In</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              </div>

              {/* 4. Executive Administration */}
              <div className="group rounded-2xl border border-white/15 bg-[#18140e] p-4 sm:p-5 flex flex-col justify-between hover:border-emerald-400 hover:shadow-[0_8px_24px_rgba(52,211,153,0.15)] transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/25">
                      Executive Admin
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="font-display text-lg text-white font-medium">Admin Console</h4>
                  <p className="mt-1.5 text-xs text-sand/80 leading-relaxed">
                    Executive ledger control, digital patti book, customer accounts, and master analytics.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handlePortalNavigate("/admin")}
                    className="eyebrow flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-white/10 border border-white/20 text-ivory hover:border-emerald-400 hover:text-emerald-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin Console</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Direct Login Redirect */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sand">
              <span className="text-[11px] text-sand/80">Prefer the central unified login terminal?</span>
              <button
                type="button"
                onClick={() => handlePortalNavigate("/login")}
                className="eyebrow text-gold hover:text-gold-light hover:underline flex items-center gap-1 text-xs font-medium cursor-pointer"
              >
                <span>Go to Central Login Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
