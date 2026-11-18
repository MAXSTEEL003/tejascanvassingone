import { useEffect, useRef } from "react"
import { isFinePointer, prefersReducedMotion } from "../lib/perf"

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isFinePointer() || prefersReducedMotion()) return

    document.documentElement.classList.add("has-cursor")

    let targetX = -100
    let targetY = -100
    let currentX = -100
    let currentY = -100
    let isMoving = false
    let isHidden = true
    let isKeyboardNav = false
    let rafId = 0

    const updateFrame = () => {
      // Fluid inertial ring follow
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      }

      const dist = Math.hypot(targetX - currentX, targetY - currentY)
      if (dist > 0.1 || isMoving) {
        rafId = requestAnimationFrame(updateFrame)
      } else {
        rafId = 0
      }
    }

    const startLoop = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateFrame)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (isKeyboardNav) {
        isKeyboardNav = false
        document.documentElement.classList.add("has-cursor")
      }

      targetX = e.clientX
      targetY = e.clientY

      // If mouse is near browser scrollbar edge, hide custom cursor so scrollbar works cleanly
      const isOverScrollbar = e.clientX >= window.innerWidth - 16
      if (isOverScrollbar) {
        if (!isHidden) {
          isHidden = true
          dotRef.current?.classList.add("hide")
          ringRef.current?.classList.add("hide")
        }
        return
      }

      if (isHidden) {
        isHidden = false
        dotRef.current?.classList.remove("hide")
        ringRef.current?.classList.remove("hide")
      }

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`
      }

      startLoop()

      // Contextual interactive detection
      const target = e.target as HTMLElement | null
      if (!target) return

      const isRangeSlider = !!target.closest('input[type="range"]')
      const isText =
        !isRangeSlider &&
        !!target.closest(
          'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, select',
        )
      const isHot =
        isRangeSlider ||
        !!target.closest(
          'a, button, [role="tab"], [role="button"], label, [data-cursor="pointer"]',
        )

      if (isText || isRangeSlider) {
        ringRef.current?.classList.add("hide")
        dotRef.current?.classList.add("hide")
        return
      } else {
        ringRef.current?.classList.remove("hide")
        dotRef.current?.classList.remove("hide")
      }

      // Hot interactive expansion on clickable elements
      ringRef.current?.classList.toggle("hot", isHot)
    }

    const onPointerDown = () => {
      dotRef.current?.classList.add("down")
      ringRef.current?.classList.add("down")
    }

    const onPointerUp = () => {
      dotRef.current?.classList.remove("down")
      ringRef.current?.classList.remove("down")
    }

    const onPointerLeave = () => {
      isHidden = true
      dotRef.current?.classList.add("hide")
      ringRef.current?.classList.add("hide")
    }

    const onPointerEnter = () => {
      isHidden = false
      dotRef.current?.classList.remove("hide")
      ringRef.current?.classList.remove("hide")
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        isKeyboardNav = true
        document.documentElement.classList.remove("has-cursor")
        dotRef.current?.classList.add("hide")
        ringRef.current?.classList.add("hide")
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerdown", onPointerDown, { passive: true })
    window.addEventListener("pointerup", onPointerUp, { passive: true })
    document.addEventListener("mouseleave", onPointerLeave)
    document.addEventListener("mouseenter", onPointerEnter)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointerup", onPointerUp)
      document.removeEventListener("mouseleave", onPointerLeave)
      document.removeEventListener("mouseenter", onPointerEnter)
      window.removeEventListener("keydown", onKeyDown)
      document.documentElement.classList.remove("has-cursor")
    }
  }, [])

  return (
    <>
      <div ref={ringRef} className="cursor-ring hide" aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot hide" aria-hidden="true" />
    </>
  )
}
