import { useEffect, useState } from "react"
import Hero from "./sections/Hero"
import Journey from "./sections/Journey"
import { Marquee } from "./sections/Story"
import Collection from "./sections/Collection"
import { Heritage, Voices, Quote, Footer } from "./sections/Rest"
import Trust from "./sections/Trust"
import Network from "./sections/Network"
import Faq from "./sections/Faq"
import Nav from "./components/Nav"
import Cursor from "./components/Cursor"
import Intro from "./components/Intro"
import { initSmooth, scrollToHash } from "./lib/smooth"
import "./index.css"

export default function App() {
  const [sel, setSel] = useState(0)

  useEffect(() => {
    document.documentElement.classList.add("about-page-active", "about-active")
    document.body.classList.add("about-page-active", "about-active")

    const stop = initSmooth()
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null
      if (!a || e.defaultPrevented) return
      const h = a.getAttribute("href")!
      if (h.length > 1 && !document.querySelector(h) && h !== "#home") return
      e.preventDefault()
      scrollToHash(h)
    }
    document.addEventListener("click", click)
    return () => {
      document.documentElement.classList.remove("about-page-active", "about-active")
      document.body.classList.remove("about-page-active", "about-active")
      stop()
      document.removeEventListener("click", click)
    }
  }, [])

  return (
    <div className="tejas-luxury-about-root bg-ink text-ivory min-h-screen selection:bg-gold selection:text-ink">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Intro />
      <Cursor />
      <Nav />
      <main id="main" className="bg-ink">
        <Hero />
        <Journey sel={sel} setSel={setSel} />
        <Marquee />
        <Trust />
        <Collection sel={sel} setSel={setSel} />
        <Heritage />
        <Network />
        <Voices />
        <Faq />
        <Quote sel={sel} setSel={setSel} />
      </main>
      <Footer />
      <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-coal sm:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gold/30 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <a
          href="#quote"
          className="eyebrow flex min-h-[48px] flex-1 items-center justify-center bg-gold text-ink font-semibold tracking-wider transition-colors active:bg-gold-light"
        >
          Request a quote
        </a>
      </div>
    </div>
  )
}
