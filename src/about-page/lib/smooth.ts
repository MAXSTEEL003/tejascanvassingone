import Lenis from "lenis"
import { prefersReducedMotion } from "./perf"

let lenis: Lenis | null = null

export type ScrollPayload = {
  scroll: number
  limit: number
  velocity: number
  direction: number
  progress: number
}

type ScrollCallback = (e: ScrollPayload) => void
const scrollListeners = new Set<ScrollCallback>()

export function getLenis() {
  return lenis
}

export function onSmoothScroll(cb: ScrollCallback) {
  scrollListeners.add(cb)
  return () => {
    scrollListeners.delete(cb)
  }
}

export function initSmooth() {
  if (prefersReducedMotion()) return () => {}

  lenis = new Lenis({
    lerp: 0.085, // silky luxury inertial damping
    wheelMultiplier: 0.95, // natural, controlled wheel response
    touchMultiplier: 1.0, // 1:1 natural mobile touch response
    smoothWheel: true,
  })

  // Broadcast scroll updates to subscribers in sync with Lenis frame
  lenis.on("scroll", (e: any) => {
    scrollListeners.forEach((fn) => fn(e))
  })

  let raf = 0
  const loop = (t: number) => {
    lenis?.raf(t)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    scrollListeners.clear()
    lenis?.destroy()
    lenis = null
  }
}

export function scrollToY(y: number) {
  if (lenis) {
    lenis.scrollTo(y, {
      duration: 1.4,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    })
  } else {
    window.scrollTo({
      top: y,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }
}

export function scrollToHash(hash: string) {
  if (hash === "#" || hash === "#home") {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true })
    } else {
      window.scrollTo({ top: 0, behavior: "instant" })
    }
    return
  }

  const el = document.querySelector(hash) as HTMLElement | null
  if (!el) return

  // Smooth scroll only when clicking from Hero down into the start of the journey
  const isBeginningJourney =
    hash === "#top" && window.scrollY < window.innerHeight * 0.8

  if (lenis) {
    if (isBeginningJourney) {
      lenis.scrollTo(el, {
        offset: 0,
        duration: 1.0,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      })
    } else {
      lenis.scrollTo(el, {
        offset: -88,
        immediate: true,
      })
    }
  } else {
    const y = el.getBoundingClientRect().top + window.scrollY - 88
    window.scrollTo({
      top: y,
      behavior: isBeginningJourney ? "smooth" : "instant",
    })
  }
}
