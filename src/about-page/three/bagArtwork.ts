import { VARIETIES } from "../data"
import { KESHAR_KALI_BAG_IMAGE, VARIETY_BAG_IMAGES } from "./kesharKaliBagData"

export type VarietyTheme = {
  sideDark: string
  sideMid: string
  panelTop: string
  panelBottom: string
  accent: string
  tag: string
}

export function getVarietyTheme(nameStr: string): VarietyTheme {
  const n = (nameStr || "").toLowerCase()
  if (n.includes("hmt")) {
    return {
      sideDark: "#081321",
      sideMid: "#142742",
      panelTop: "#0d1b2d",
      panelBottom: "#07101c",
      accent: "#dfb758",
      tag: "SHORT BOLD GRAIN · RICH FLAVOUR",
    }
  }
  if (n.includes("sona")) {
    return {
      sideDark: "#071c12",
      sideMid: "#123824",
      panelTop: "#0d2b1b",
      panelBottom: "#06170e",
      accent: "#dfb758",
      tag: "MEDIUM SLENDER · LIGHT & AROMATIC",
    }
  }
  if (n.includes("knm")) {
    return {
      sideDark: "#201007",
      sideMid: "#3d2010",
      panelTop: "#2d170a",
      panelBottom: "#170b05",
      accent: "#e2af5c",
      tag: "LONG SLENDER · HIGH MILLING YIELD",
    }
  }
  if (n.includes("basmati")) {
    return {
      sideDark: "#1b0818",
      sideMid: "#391232",
      panelTop: "#2b0c26",
      panelBottom: "#150613",
      accent: "#f3c85f",
      tag: "EXTRA LONG GRAIN · ROYAL HERITAGE",
    }
  }
  return {
    sideDark: "#3a110c",
    sideMid: "#64201a",
    panelTop: "#4a1711",
    panelBottom: "#280c09",
    accent: "#d9a441",
    tag: "PREMIUM WADA KOLAM · KHILA KHILA DANA",
  }
}

// Preload the bag image immediately at module load
export const imageCache = new Map<string, HTMLImageElement>()
export const preloadedBagImg =
  typeof Image !== "undefined" ? new Image() : {} as HTMLImageElement
if (typeof Image !== "undefined") {
  preloadedBagImg.src = KESHAR_KALI_BAG_IMAGE
  imageCache.set(KESHAR_KALI_BAG_IMAGE, preloadedBagImg)
}

export function getOrLoadBagImage(
  src: string,
  onLoaded?: () => void,
): HTMLImageElement | null {
  if (imageCache.has(src)) {
    const img = imageCache.get(src)!
    if (img.complete && img.naturalWidth > 0) return img
    if (onLoaded) {
      const prev = img.onload
      img.onload = (e) => {
        prev?.call(img, e)
        onLoaded()
      }
    }
    return null
  }
  if (typeof Image === "undefined") return null
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.src = src
  imageCache.set(src, img)
  if (onLoaded) {
    img.onload = () => onLoaded()
  }
  return null
}

export const drawSideArtwork = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  nameStr: string,
) => {
  const W = canvas.width
  const H = canvas.height
  ctx.save()
  ctx.clearRect(0, 0, W, H)

  const v =
    VARIETIES.find((x) => x.name.toLowerCase() === nameStr.toLowerCase()) ||
    VARIETIES[0]
  const theme = getVarietyTheme(nameStr)

  const sgGrad = ctx.createLinearGradient(0, 0, W, 0)
  sgGrad.addColorStop(0, theme.sideDark)
  sgGrad.addColorStop(0.5, theme.sideMid)
  sgGrad.addColorStop(1, theme.sideDark)
  ctx.fillStyle = sgGrad
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = "#d9a441"
  ctx.fillRect(10, 0, 4, H)
  ctx.fillRect(242, 0, 4, H)
  ctx.fillRect(24, 0, 1.5, H)
  ctx.fillRect(230, 0, 1.5, H)

  ctx.save()
  ctx.translate(128, 512)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = "center"
  ctx.fillStyle = "#f6e7c4"
  ctx.font = 'italic 500 130px "Bodoni Moda",Georgia,serif'
  ctx.fillText(v.name, 0, 34)
  ctx.fillStyle = "#d9a441"
  ctx.font = '600 24px "Hanken Grotesk",sans-serif'
  ctx.fillText((v.subname || "PREMIUM RICE").toUpperCase(), 0, 88)
  ctx.fillRect(-300, 112, 600, 2)
  ctx.restore()

  ctx.restore()
}

export const drawBackArtwork = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  imgEl: HTMLImageElement,
  nameStr: string,
) => {
  const W = canvas.width
  const H = canvas.height
  ctx.save()
  ctx.clearRect(0, 0, W, H)

  const v =
    VARIETIES.find((x) => x.name.toLowerCase() === nameStr.toLowerCase()) ||
    VARIETIES[0]
  const theme = getVarietyTheme(nameStr)

  const gr = ctx.createLinearGradient(0, 0, W, 0)
  gr.addColorStop(0, theme.sideDark)
  gr.addColorStop(0.5, theme.sideMid)
  gr.addColorStop(1, theme.sideDark)
  ctx.fillStyle = gr
  ctx.fillRect(0, 0, W, H)

  const tg = ctx.createLinearGradient(0, 0, 0, H * 0.065)
  tg.addColorStop(0, "#f1e3b0")
  tg.addColorStop(1, "#e2cd8a")
  ctx.fillStyle = tg
  ctx.fillRect(0, 0, W, H * 0.065)

  ctx.fillStyle = "#d9a441"
  ctx.fillRect(0, H * 0.065, W, H * 0.008)
  ctx.fillRect(0, H * 0.94, W, H * 0.022)

  ctx.strokeStyle = "rgba(217,164,65,.6)"
  ctx.lineWidth = 3
  ctx.strokeRect(W * 0.1, H * 0.11, W * 0.8, H * 0.78)

  ctx.textAlign = "center"
  ctx.fillStyle = "#f6e7c4"
  ctx.font =
    "italic 500 " + Math.round(W * 0.13) + 'px "Bodoni Moda",Georgia,serif'
  ctx.fillText(v.name, W / 2, H * 0.28)

  ctx.fillStyle = "#d9a441"
  ctx.font = "600 " + Math.round(W * 0.038) + 'px "Hanken Grotesk",sans-serif'
  ctx.fillText(v.subname.toUpperCase(), W / 2, H * 0.35)

  ctx.fillStyle = "#f6e7c4"
  ctx.font =
    "italic " + Math.round(W * 0.075) + 'px "Bodoni Moda",Georgia,serif'
  ctx.fillText(v.texture.split("(")[0].trim(), W / 2, H * 0.48)

  ctx.fillStyle = "rgba(246,231,196,.85)"
  ctx.font = Math.round(W * 0.038) + 'px "Hanken Grotesk",sans-serif'
  ctx.fillText(v.aged, W / 2, H * 0.6)
  ctx.fillText("Origin: " + v.specs.origin, W / 2, H * 0.66)
  ctx.fillText(
    "Grain Specs: " + v.len + " Length × " + v.width + " mm Width",
    W / 2,
    H * 0.72,
  )
  const isKesharKaliBack = nameStr.toLowerCase().includes("keshar")
  ctx.fillText(
    "Export Packaging: NET WT. " + (isKesharKaliBack ? "30 KG" : "26 KG"),
    W / 2,
    H * 0.78,
  )

  ctx.globalCompositeOperation = "destination-in"
  ctx.translate(W, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(imgEl, 0, 0, W, H)
  ctx.restore()
}

export const drawFrontArtwork = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  imgEl: HTMLImageElement,
  nameStr: string,
) => {
  const W = canvas.width
  const H = canvas.height
  ctx.save()
  ctx.clearRect(0, 0, W, H)

  // 1. If it's Keshar Kali, draw the original bag image directly
  if (nameStr === "Keshar Kali") {
    ctx.drawImage(imgEl, 0, 0, W, H)
    ctx.restore()
    return
  }

  // Check if custom bag image was provided in VARIETY_BAG_IMAGES
  const customSrc = VARIETY_BAG_IMAGES[nameStr]
  if (customSrc && customSrc !== KESHAR_KALI_BAG_IMAGE) {
    const customImg = getOrLoadBagImage(customSrc, () => {
      drawFrontArtwork(canvas, ctx, imgEl, nameStr)
    })
    if (customImg) {
      ctx.drawImage(customImg, 0, 0, W, H)
      ctx.restore()
      return
    }
  }

  // 2. Otherwise (user will provide custom image later):
  // Render authentic tailored export packaging label over the realistic sack base
  const v =
    VARIETIES.find((x) => x.name.toLowerCase() === nameStr.toLowerCase()) ||
    VARIETIES[0]
  const theme = getVarietyTheme(nameStr)

  // Draw base sack texture first (retains crepe header, stitching, creases, realistic lighting)
  ctx.drawImage(imgEl, 0, 0, W, H)

  // Front Printable Panel Zone
  const padX = W * 0.12
  const panelW = W * 0.76
  const panelY = H * 0.155
  const panelH = H * 0.725
  const cornerR = 24

  // Rich background panel
  ctx.save()
  ctx.beginPath()
  if (typeof (ctx as any).roundRect === "function") {
    ;(ctx as any).roundRect(padX, panelY, panelW, panelH, cornerR)
  } else {
    ctx.rect(padX, panelY, panelW, panelH)
  }
  ctx.clip()

  const bgGrad = ctx.createLinearGradient(padX, panelY, padX, panelY + panelH)
  bgGrad.addColorStop(0, theme.panelTop)
  bgGrad.addColorStop(0.5, theme.panelBottom)
  bgGrad.addColorStop(1, theme.panelTop)
  ctx.fillStyle = bgGrad
  ctx.fillRect(padX, panelY, panelW, panelH)

  // Luxury radial glow in center
  const glow = ctx.createRadialGradient(
    W / 2,
    panelY + panelH * 0.38,
    20,
    W / 2,
    panelY + panelH * 0.38,
    panelW * 0.65,
  )
  glow.addColorStop(0, "rgba(217, 164, 65, 0.2)")
  glow.addColorStop(1, "rgba(0, 0, 0, 0)")
  ctx.fillStyle = glow
  ctx.fillRect(padX, panelY, panelW, panelH)

  // Subtle woven pattern simulation
  ctx.fillStyle = "rgba(255, 255, 255, 0.02)"
  for (let py = panelY; py < panelY + panelH; py += 6) {
    ctx.fillRect(padX, py, panelW, 1.5)
  }
  ctx.restore()

  // Multi-tier gold foil borders
  ctx.save()
  // Outer border
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 3.5
  ctx.beginPath()
  if (typeof (ctx as any).roundRect === "function") {
    ;(ctx as any).roundRect(
      padX + 2,
      panelY + 2,
      panelW - 4,
      panelH - 4,
      cornerR - 2,
    )
  } else {
    ctx.rect(padX + 2, panelY + 2, panelW - 4, panelH - 4)
  }
  ctx.stroke()

  // Inner pinstripe border
  ctx.strokeStyle = "rgba(217, 164, 65, 0.45)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (typeof (ctx as any).roundRect === "function") {
    ;(ctx as any).roundRect(
      padX + 12,
      panelY + 12,
      panelW - 24,
      panelH - 24,
      cornerR - 10,
    )
  } else {
    ctx.rect(padX + 12, panelY + 12, panelW - 24, panelH - 24)
  }
  ctx.stroke()

  // Corner decorative marks
  const cOff = 12
  const corners = [
    [padX + cOff, panelY + cOff],
    [padX + panelW - cOff, panelY + cOff],
    [padX + cOff, panelY + panelH - cOff],
    [padX + panelW - cOff, panelY + panelH - cOff],
  ]
  ctx.fillStyle = theme.accent
  corners.forEach(([cx, cy]) => {
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fill()
  })

  // BRAND HEADER
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(246, 231, 196, 0.9)"
  ctx.font = "600 " + Math.round(W * 0.026) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText(
    "★  TEJAS AGRO HERITAGE EXPORTS  ★",
    W / 2,
    panelY + panelH * 0.065,
  )

  ctx.fillStyle = theme.accent
  ctx.font = "500 " + Math.round(W * 0.022) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText(
    "GOVERNMENT RECOGNIZED EXPORT GRADE",
    W / 2,
    panelY + panelH * 0.098,
  )

  // Decorative divider
  ctx.strokeStyle = "rgba(217, 164, 65, 0.6)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W / 2 - panelW * 0.35, panelY + panelH * 0.12)
  ctx.lineTo(W / 2 + panelW * 0.35, panelY + panelH * 0.12)
  ctx.stroke()

  // VARIETY MAIN TITLE
  ctx.shadowColor = "rgba(0,0,0,0.6)"
  ctx.shadowBlur = 12
  ctx.fillStyle = "#fff7e6"
  const titleFontSize = Math.min(
    Math.round(W * 0.11),
    Math.round((panelW * 0.92) / (v.name.length * 0.55)),
  )
  ctx.font = "italic 600 " + titleFontSize + 'px "Bodoni Moda", Georgia, serif'
  ctx.fillText(v.name, W / 2, panelY + panelH * 0.23)

  ctx.shadowBlur = 0
  ctx.fillStyle = theme.accent
  ctx.font = "600 " + Math.round(W * 0.033) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText(v.subname.toUpperCase(), W / 2, panelY + panelH * 0.285)

  // GOLDEN MEDALLION / GUARANTEE SEAL
  const badgeY = panelY + panelH * 0.45
  const badgeR = panelW * 0.165
  ctx.beginPath()
  ctx.arc(W / 2, badgeY, badgeR, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)"
  ctx.fill()
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(W / 2, badgeY, badgeR - 6, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(217, 164, 65, 0.4)"
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = theme.accent
  ctx.font = "bold " + Math.round(W * 0.024) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText("100% PURE GRAIN", W / 2, badgeY - badgeR * 0.42)

  ctx.fillStyle = "#ffffff"
  ctx.font =
    "italic 600 " + Math.round(W * 0.052) + 'px "Bodoni Moda", Georgia, serif'
  ctx.fillText(v.len, W / 2, badgeY + badgeR * 0.08)

  ctx.fillStyle = "rgba(246, 231, 196, 0.85)"
  ctx.font = "500 " + Math.round(W * 0.022) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText("CALIBRATED LENGTH", W / 2, badgeY + badgeR * 0.45)

  // TAGLINE PILL
  const pillY = panelY + panelH * 0.63
  const pillW = panelW * 0.74
  const pillH = Math.round(W * 0.062)
  ctx.beginPath()
  if (typeof (ctx as any).roundRect === "function") {
    ;(ctx as any).roundRect(
      W / 2 - pillW / 2,
      pillY - pillH / 2,
      pillW,
      pillH,
      pillH / 2,
    )
  } else {
    ctx.rect(W / 2 - pillW / 2, pillY - pillH / 2, pillW, pillH)
  }
  ctx.fillStyle = "rgba(217, 164, 65, 0.16)"
  ctx.fill()
  ctx.strokeStyle = "rgba(217, 164, 65, 0.55)"
  ctx.lineWidth = 1.2
  ctx.stroke()

  ctx.fillStyle = "#f8ecc8"
  ctx.font =
    "italic 500 " + Math.round(W * 0.028) + 'px "Bodoni Moda", Georgia, serif'
  ctx.fillText(theme.tag, W / 2, pillY + pillH * 0.16)

  // SPECS ROW
  const specsY = panelY + panelH * 0.74
  ctx.fillStyle = "rgba(246, 231, 196, 0.75)"
  ctx.font = Math.round(W * 0.024) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText("ORIGIN: " + v.specs.origin.toUpperCase(), W / 2, specsY)
  ctx.fillText(
    "PROCESSED & AGED: " +
      v.aged.replace("in aerated silos", "").toUpperCase().trim(),
    W / 2,
    specsY + Math.round(W * 0.038),
  )

  // BOTTOM EXPORT PACKING BAR
  const bBarY = panelY + panelH * 0.88
  ctx.fillStyle = theme.accent
  ctx.fillRect(padX + 16, bBarY - 14, panelW - 32, 1.5)

  const isKesharKali = nameStr.toLowerCase().includes("keshar")
  const netWtLabel = isKesharKali ? "NET WT. 30 KG" : "NET WT. 26 KG"
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold " + Math.round(W * 0.036) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText(netWtLabel, W / 2, bBarY + 14)

  ctx.fillStyle = "rgba(246, 231, 196, 0.65)"
  ctx.font = Math.round(W * 0.02) + 'px "Hanken Grotesk", sans-serif'
  ctx.fillText(
    "EXPORT PACKING · HIGH BARRIER LAMINATED SACK",
    W / 2,
    bBarY + 34,
  )

  ctx.restore()

  // Mask to the cutout alpha of the sack
  ctx.save()
  ctx.globalCompositeOperation = "destination-in"
  ctx.drawImage(imgEl, 0, 0, W, H)
  ctx.restore()
}
