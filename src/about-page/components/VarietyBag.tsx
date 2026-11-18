import { useEffect, useRef, useState } from "react"
import {
  preloadedBagImg,
  drawFrontArtwork,
  getOrLoadBagImage,
  getVarietyTheme,
} from "../three/bagArtwork"
import {
  KESHAR_KALI_BAG_IMAGE,
  VARIETY_BAG_IMAGES,
} from "../three/kesharKaliBagData"

interface VarietyBagProps {
  name: string
  className?: string
  canvasClassName?: string
  width?: number
  height?: number
  showShadow?: boolean
  interactive?: boolean
  alt?: string
}

export default function VarietyBag({
  name,
  className = "",
  canvasClassName = "max-h-[290px] md:max-h-[330px] w-auto",
  width = 480,
  height = 760,
  showShadow = true,
  interactive = true,
  alt,
}: VarietyBagProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const theme = getVarietyTheme(name)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return

    cv.width = width
    cv.height = height

    const render = () => {
      // Check if target custom image exists in registry
      const targetSrc = VARIETY_BAG_IMAGES[name] || KESHAR_KALI_BAG_IMAGE
      const img = getOrLoadBagImage(targetSrc, () => {
        const c = canvasRef.current
        if (!c) return
        const x = c.getContext("2d")
        if (x) {
          drawFrontArtwork(
            c,
            x,
            preloadedBagImg.complete ? preloadedBagImg : img || preloadedBagImg,
            name,
          )
          setLoaded(true)
        }
      })

      const baseImg =
        preloadedBagImg.complete && preloadedBagImg.naturalWidth > 0
          ? preloadedBagImg
          : img
      if (baseImg && baseImg.complete && baseImg.naturalWidth > 0) {
        drawFrontArtwork(cv, ctx, baseImg, name)
        setLoaded(true)
      } else {
        baseImg?.addEventListener(
          "load",
          () => {
            drawFrontArtwork(cv, ctx, baseImg, name)
            setLoaded(true)
          },
          { once: true },
        )
      }
    }

    render()

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (canvasRef.current) {
          const c = canvasRef.current
          const x = c.getContext("2d")
          if (x && preloadedBagImg.complete) {
            drawFrontArtwork(c, x, preloadedBagImg, name)
          }
        }
      })
    }
  }, [name, width, height])

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
    >
      {/* Ambient color bloom tailored to variety */}
      {showShadow && (
        <div
          className="pointer-events-none absolute -inset-4 rounded-full opacity-35 blur-2xl transition-all duration-700"
          style={{
            background: `radial-gradient(circle, ${theme.accent} 0%, ${theme.panelTop} 45%, transparent 70%)`,
          }}
        />
      )}

      {/* Bag canvas */}
      <div
        className={`relative z-10 transition-transform duration-500 ease-out ${
          interactive ? "hover:scale-[1.03] hover:-translate-y-1" : ""
        }`}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={alt || `${name} authentic export rice bag packaging`}
          className={`h-full ${canvasClassName} drop-shadow-[0_20px_26px_rgba(0,0,0,0.65)] select-none transition-opacity duration-300`}
          style={{
            opacity: loaded ? 1 : 0.85,
            filter: "contrast(1.02) saturate(1.03)",
          }}
        />

        {/* Floor contact reflection & shadow */}
        {showShadow && (
          <div
            className="pointer-events-none mx-auto mt-[-10px] h-[18px] w-[75%] rounded-[100%] opacity-60 blur-sm transition-opacity duration-500"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(10,5,0,0.4) 55%, transparent 80%)",
            }}
          />
        )}
      </div>
    </div>
  )
}
