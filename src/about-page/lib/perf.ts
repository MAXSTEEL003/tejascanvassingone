export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches
export const isFinePointer = () =>
  typeof window !== "undefined" && matchMedia("(pointer: fine)").matches

export function hasWebGL() {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

export type Tier = "high" | "low" | "none"

let cached: Tier | null = null
export function gpuTier(): Tier {
  if (cached) return cached
  if (typeof window === "undefined") return "none"
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  if (!hasWebGL()) return (cached = "none")
  const weak =
    innerWidth < 768 ||
    matchMedia("(pointer: coarse)").matches ||
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    !!nav.connection?.saveData
  return (cached = weak ? "low" : "high")
}

export const maxDpr = () =>
  Math.min(gpuTier() === "low" ? 1.25 : 2, window.devicePixelRatio || 1)

export const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth < 768
