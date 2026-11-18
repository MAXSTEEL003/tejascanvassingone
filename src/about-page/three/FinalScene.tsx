import { useEffect, useRef } from "react"
import * as THREE from "three"
import { makeStudioEnv } from "./studio"
import { gpuTier, maxDpr } from "../lib/perf"
import { makeGrainGeometry, makeGrainMaterial } from "./grain"
import { makeDust } from "./dust"
import { VARIETIES } from "../data"
import {
  preloadedBagImg,
  drawFrontArtwork,
  drawBackArtwork,
  drawSideArtwork,
} from "./bagArtwork"

type Props = {
  t: number
  visible: boolean
  mm: number
  width: number
  name: string
  shift: number
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ez = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)
const sm = (t: number, a: number, b: number) => ez(clamp((t - a) / (b - a)))

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- authentic 3D bag model ---------- */
function makeBag(initialName: string, onBuilt?: () => void) {
  const rootGroup = new THREE.Group()
  const pivot = new THREE.Group()
  rootGroup.add(pivot)

  const HB = 3.3
  const D = 0.56
  const G = 0.2
  const NX = 100
  const NY = 140

  let frontMesh: THREE.Mesh | null = null
  let rearMesh: THREE.Mesh | null = null
  let sideL: THREE.Mesh | null = null
  let sideR: THREE.Mesh | null = null
  let zg: THREE.Group | null = null
  let frontTex: THREE.CanvasTexture | null = null
  let backTex: THREE.CanvasTexture | null = null
  let sideTex: THREE.CanvasTexture | null = null
  let bumpTex: THREE.CanvasTexture | null = null
  let frontMat: THREE.MeshPhysicalMaterial | null = null
  let rearMat: THREE.MeshPhysicalMaterial | null = null
  let sideMat: THREE.MeshStandardMaterial | null = null
  let plasticMat: THREE.MeshPhysicalMaterial | null = null
  let bandMat: THREE.MeshStandardMaterial | null = null
  const geometries: THREE.BufferGeometry[] = []

  let bagName = initialName || "Keshar Kali"
  let sc: HTMLCanvasElement | null = null
  let sCtx: CanvasRenderingContext2D | null = null
  let bc: HTMLCanvasElement | null = null
  let bCtx: CanvasRenderingContext2D | null = null
  let sk: HTMLCanvasElement | null = null
  let sCtxSide: CanvasRenderingContext2D | null = null
  let imgRef: HTMLImageElement | null = null
  let built = false
  let disposed = false

  const build = (imgEl: HTMLImageElement) => {
    if (built || disposed) return
    imgRef = imgEl
    const iw = imgEl.naturalWidth || imgEl.width
    const ih = imgEl.naturalHeight || imgEl.height
    if (!iw || !ih) return

    built = true
    const WB = (HB * iw) / ih

    // Silhouette extents per row from the cutout alpha
    sc = document.createElement("canvas")
    sc.width = iw
    sc.height = ih
    sCtx = sc.getContext("2d", { willReadFrequently: true })!
    sCtx.drawImage(imgEl, 0, 0)
    const ad = sCtx.getImageData(0, 0, iw, ih).data
    let L: number[] = []
    let Rr: number[] = []

    for (let y = 0; y < ih; y++) {
      let l = -1
      let r = -1
      for (let xx = 0; xx < iw; xx++) {
        if (ad[(y * iw + xx) * 4 + 3] > 250) {
          if (l < 0) l = xx
          r = xx
        }
      }
      L.push(l < 0 ? iw * 0.5 : l)
      Rr.push(r < 0 ? iw * 0.5 : r)
    }

    function smooth(a: number[], w = 10) {
      const o = a.slice()
      for (let i = 0; i < a.length; i++) {
        let s = 0
        let n = 0
        for (let k = -w; k <= w; k++) {
          const j = i + k
          if (j >= 0 && j < a.length) {
            s += a[j]
            n++
          }
        }
        o[i] = s / n
      }
      return o
    }

    function env(a: number[], w: number, mx: boolean) {
      const o = a.slice()
      for (let i = 0; i < a.length; i++) {
        let m = a[i]
        for (let k = -w; k <= w; k++) {
          const j = i + k
          if (j >= 0 && j < a.length) {
            m = mx ? Math.max(m, a[j]) : Math.min(m, a[j])
          }
        }
        o[i] = m
      }
      return o
    }

    L = smooth(env(L, 4, true), 4).map((v) => v + 3)
    Rr = smooth(env(Rr, 4, false), 4).map((v) => v - 3)

    let mw = 0
    let ri: number
    for (ri = 0; ri < ih; ri++) mw = Math.max(mw, Rr[ri] - L[ri])
    let rv = 0
    while (rv < ih - 1 && Rr[rv] - L[rv] < 0.85 * mw) rv++
    for (ri = 0; ri < rv; ri++) {
      L[ri] = L[rv]
      Rr[ri] = Rr[rv]
    }

    let colTop: number[] = []
    for (let cx = 0; cx < iw; cx++) {
      let ty = 0
      while (ty < ih && ad[(ty * iw + cx) * 4 + 3] <= 250) ty++
      colTop.push(ty)
    }
    ;(function () {
      let v = -1
      let i: number
      let j: number
      for (i = 0; i < iw; i++) {
        if (colTop[i] < ih) v = colTop[i]
        else if (v >= 0) colTop[i] = v
      }
      v = -1
      for (j = iw - 1; j >= 0; j--) {
        if (colTop[j] < ih) v = colTop[j]
        else if (v >= 0) colTop[j] = v
      }
    })()

    const rawTop = colTop.slice()
    colTop = smooth(env(colTop, 8, true))
    let tF = 0
    const cA = Math.round(L[rv] + 0.12 * (Rr[rv] - L[rv]))
    const cB = Math.round(Rr[rv] - 0.12 * (Rr[rv] - L[rv]))
    for (let ci = cA; ci <= cB; ci++) tF = Math.max(tF, rawTop[ci] / (ih - 1))
    tF = Math.min(0.09, tF) + 0.008

    function sealF(tt: number) {
      const smFunc = THREE.MathUtils.smoothstep
      return smFunc(tt, tF, tF + 0.14) * (1 - smFunc(tt, 0.93, 1))
    }

    const bagZ = (
      seal: number,
      side: number,
      full: number,
      x: number,
      y: number,
      tt: number,
    ) =>
      seal * (G + (D - G) * side * full) +
      (Math.sin(y * 3.2 + x * 1.4) * 0.02 * (1 - tt) +
        Math.sin(x * 4 - y * 1.5) * 0.012) *
        seal *
        side

    if (bagName !== "Keshar Kali") {
      drawFrontArtwork(sc, sCtx!, imgEl, bagName)
    }
    frontTex = new THREE.CanvasTexture(sc)
    frontTex.colorSpace = THREE.SRGBColorSpace
    frontTex.anisotropy = 8

    // Back artwork
    bc = document.createElement("canvas")
    bc.width = iw
    bc.height = ih
    bCtx = bc.getContext("2d")!
    drawBackArtwork(bc, bCtx, imgEl, bagName)

    backTex = new THREE.CanvasTexture(bc)
    backTex.colorSpace = THREE.SRGBColorSpace
    backTex.anisotropy = 8

    // Film crinkle bump map
    const kc = document.createElement("canvas")
    kc.width = kc.height = 256
    const k = kc.getContext("2d")!
    k.fillStyle = "#808080"
    k.fillRect(0, 0, 256, 256)
    const bumpRng = rng(991)
    for (let i = 0; i < 260; i++) {
      const v = bumpRng() > 0.5 ? 255 : 0
      k.strokeStyle = "rgba(" + v + "," + v + "," + v + ",.16)"
      k.lineWidth = 2 + bumpRng() * 7
      k.lineCap = "round"
      const x0 = bumpRng() * 256
      const y0 = bumpRng() * 256
      k.beginPath()
      k.moveTo(x0, y0)
      k.lineTo(x0 + (bumpRng() - 0.5) * 50, y0 + (bumpRng() - 0.5) * 120)
      k.stroke()
    }
    bumpTex = new THREE.CanvasTexture(kc)
    bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping
    bumpTex.repeat.set(3, 5) // tile the crinkle so it reads as film, not large dents
    bumpTex.anisotropy = 4

    function mat(m: THREE.Texture) {
      return new THREE.MeshPhysicalMaterial({
        map: m,
        bumpMap: bumpTex,
        bumpScale: 0.003,
        alphaTest: 0.5,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        roughness: 0.55,
        metalness: 0,
        clearcoat: 0.22,
        clearcoatRoughness: 0.45,
        envMapIntensity: 0.55,
      })
    }

    function shell(back: boolean) {
      const P: number[] = []
      const U: number[] = []
      const I: number[] = []
      for (let j = 0; j <= NY; j++) {
        const tt = j / NY
        const row = Math.min(ih - 1, Math.round(tt * (ih - 1)))
        const l = (L[row] / iw - 0.5) * WB
        const r = (Rr[row] / iw - 0.5) * WB
        const y = HB / 2 - tt * HB
        const seal = sealF(tt)
        const full =
          0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, tt * 1.05 + 0.02))
        for (let i = 0; i <= NX; i++) {
          const s = i / NX
          const x = l + (r - l) * s
          const u = Math.abs(2 * s - 1)
          const side = 1 - Math.pow(u, 3.2)
          const z = bagZ(seal, side, full, x, y, tt)
          const tu = x / WB + 0.5
          P.push(x, y, back ? -z : z)
          U.push(back ? 1 - tu : tu, 1 - tt)
        }
      }
      for (let j2 = 0; j2 < NY; j2++) {
        for (let i2 = 0; i2 < NX; i2++) {
          const q = j2 * (NX + 1) + i2
          I.push(q, q + NX + 1, q + 1, q + 1, q + NX + 1, q + NX + 2)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2))
      geo.setIndex(I)
      geo.computeVertexNormals()
      geometries.push(geo)
      return geo
    }

    frontMat = mat(frontTex)
    rearMat = mat(backTex)
    frontMesh = new THREE.Mesh(shell(false), frontMat)
    rearMesh = new THREE.Mesh(shell(true), rearMat)

    // Side gusset artwork with vertical typography
    sk = document.createElement("canvas")
    sk.width = 256
    sk.height = 1024
    sCtxSide = sk.getContext("2d")!
    drawSideArtwork(sk, sCtxSide, bagName)

    sideTex = new THREE.CanvasTexture(sk)
    sideTex.colorSpace = THREE.SRGBColorSpace
    sideTex.anisotropy = 8
    sideMat = new THREE.MeshStandardMaterial({
      map: sideTex,
      roughness: 0.55,
      metalness: 0,
      envMapIntensity: 0.45,
      side: THREE.DoubleSide,
    })

    function strip(rt: number) {
      const P: number[] = []
      const U: number[] = []
      const I: number[] = []
      const n = NY
      for (let j = 0; j <= n; j++) {
        const tt = j / n
        const row = Math.min(ih - 1, Math.round(tt * (ih - 1)))
        const x = ((rt ? Rr[row] : L[row]) / iw - 0.5) * WB
        const y = HB / 2 - tt * HB
        const z = G * sealF(tt)
        const v = 1 - tt
        P.push(x, y, z, x, y, -z)
        U.push(rt ? 0 : 1, v, rt ? 1 : 0, v)
      }
      for (let k = 0; k < n; k++) {
        const a = k * 2
        I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3))
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2))
      geo.setIndex(I)
      geo.computeVertexNormals()
      geometries.push(geo)
      return geo
    }

    sideL = new THREE.Mesh(strip(0), sideMat)
    sideR = new THREE.Mesh(strip(1), sideMat)
    sideL.castShadow = sideR.castShadow = true

    // Zip-lock track below top seal
    function surf(sVal: number, tt: number) {
      const row = Math.min(ih - 1, Math.round(tt * (ih - 1)))
      const l = (L[row] / iw - 0.5) * WB
      const r = (Rr[row] / iw - 0.5) * WB
      const y = HB / 2 - tt * HB
      const x = l + (r - l) * sVal
      const u = Math.abs(2 * sVal - 1)
      const side = 1 - Math.pow(u, 3.2)
      const seal = sealF(tt)
      const full = 0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, tt * 1.05 + 0.02))
      const z = bagZ(seal, side, full, x, y, tt)
      return new THREE.Vector3(x, y, z)
    }

    const ZN = 90
    const rr0 = Math.round(0.05 * (ih - 1))
    const l0 = (L[rr0] / iw - 0.5) * WB
    const r0 = (Rr[rr0] / iw - 0.5) * WB

    function zpt(q: number, dt: number, sg: number) {
      const x = l0 + (r0 - l0) * (0.02 + (0.96 * q) / ZN)
      const col = Math.min(
        iw - 1,
        Math.max(0, Math.round((x / WB + 0.5) * (iw - 1))),
      )
      const tt = Math.min(colTop[col] / (ih - 1), tF + 0.02) + dt
      const row = Math.min(ih - 1, Math.max(0, Math.round(tt * (ih - 1))))
      const l = (L[row] / iw - 0.5) * WB
      const r = (Rr[row] / iw - 0.5) * WB
      const p = surf(Math.min(1, Math.max(0, (x - l) / (r - l))), tt)
      p.z = sg * (p.z + 0.014)
      return p
    }

    plasticMat = new THREE.MeshPhysicalMaterial({
      color: "#e8d3a0",
      roughness: 0.28,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.9,
    })
    bandMat = new THREE.MeshStandardMaterial({
      color: "#caa95f",
      roughness: 0.45,
      side: THREE.DoubleSide,
    })

    zg = new THREE.Group()
    ;[1, -1].forEach((sg) => {
      const p1: THREE.Vector3[] = []
      const p2: THREE.Vector3[] = []
      for (let q = 0; q <= ZN; q++) {
        p1.push(zpt(q, 0.016, sg))
        p2.push(zpt(q, 0.029, sg))
      }
      ;[p1, p2].forEach((pts) => {
        const tubeGeo = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(pts),
          140,
          0.0105,
          8,
          false,
        )
        geometries.push(tubeGeo)
        const m = new THREE.Mesh(tubeGeo, plasticMat!)
        m.castShadow = true
        zg!.add(m)
      })
      const BP: number[] = []
      const BI: number[] = []
      for (let k = 0; k <= ZN; k++) {
        BP.push(
          p1[k].x,
          p1[k].y,
          p1[k].z - sg * 0.006,
          p2[k].x,
          p2[k].y,
          p2[k].z - sg * 0.006,
        )
        if (k < ZN) {
          const c = k * 2
          BI.push(c, c + 1, c + 2, c + 1, c + 3, c + 2)
        }
      }
      const bg2 = new THREE.BufferGeometry()
      bg2.setAttribute("position", new THREE.Float32BufferAttribute(BP, 3))
      bg2.setIndex(BI)
      bg2.computeVertexNormals()
      geometries.push(bg2)
      zg!.add(new THREE.Mesh(bg2, bandMat!))
    })

    frontMesh.castShadow = rearMesh.castShadow = true
    frontMesh.receiveShadow = rearMesh.receiveShadow = true

    pivot.add(sideL, sideR, frontMesh, rearMesh, zg)
    onBuilt?.()
  }

  if (preloadedBagImg.complete && preloadedBagImg.naturalWidth > 0) {
    build(preloadedBagImg)
  } else {
    preloadedBagImg.onload = () => {
      build(preloadedBagImg)
    }
  }

  // Staged on the left side of the composition, resting gracefully on the floor
  rootGroup.position.set(-0.95, HB / 2 - 0.02, -0.2)
  pivot.rotation.set(0.02, 0.35, 0)

  const redraw = (n: string) => {
    bagName = n || "Keshar Kali"
    if (sc && sCtx && imgRef && frontTex) {
      drawFrontArtwork(sc, sCtx, imgRef, bagName)
      frontTex.needsUpdate = true
    }
    if (bc && bCtx && imgRef && backTex) {
      drawBackArtwork(bc, bCtx, imgRef, bagName)
      backTex.needsUpdate = true
    }
    if (sk && sCtxSide && sideTex) {
      drawSideArtwork(sk, sCtxSide, bagName)
      sideTex.needsUpdate = true
    }
  }

  const setRotation = (pitch: number, yaw: number) => {
    pivot.rotation.set(pitch, yaw, 0)
  }

  const dispose = () => {
    disposed = true
    preloadedBagImg.onload = null
    geometries.forEach((geo) => geo.dispose())
    frontMat?.dispose()
    rearMat?.dispose()
    sideMat?.dispose()
    plasticMat?.dispose()
    bandMat?.dispose()
    frontTex?.dispose()
    backTex?.dispose()
    sideTex?.dispose()
    bumpTex?.dispose()
  }

  return {
    rootGroup,
    pivot,
    redraw,
    setRotation,
    dispose,
    isBuilt: () => built,
  }
}
/* ---------- bowl ---------- */
const BOWL = { x: 0.96, z: 0.35, R: 1.0, H: 0.52 }
function makeBowl(env: THREE.Texture) {
  const { R, H } = BOWL
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(R * 0.44, 0),
    new THREE.Vector2(R * 0.46, 0.07),
  ]
  const n = 22
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2)
    pts.push(
      new THREE.Vector2(
        R * 0.46 + (R - R * 0.46) * Math.sin(a),
        0.07 + H * (1 - Math.cos(a)),
      ),
    )
  }
  const top = 0.07 + H
  pts.push(
    new THREE.Vector2(R + 0.012, top + 0.02),
    new THREE.Vector2(R - 0.035, top + 0.028),
    new THREE.Vector2(R - 0.075, top),
  )
  for (let i = n; i >= 0; i--) {
    const a = (i / n) * (Math.PI / 2)
    pts.push(
      new THREE.Vector2(
        (R - 0.075) * (0.47 + 0.53 * Math.sin(a)),
        0.17 + (H - 0.1) * (1 - Math.cos(a)),
      ),
    )
  }
  pts.push(new THREE.Vector2(0.001, 0.17))
  const geo = new THREE.LatheGeometry(pts, 96)
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#c49a3c", // golden brass thali
    roughness: 0.28,
    metalness: 0.62,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    sheen: 0.35,
    side: THREE.DoubleSide,
    // Explicit env map: scene.environmentIntensity (0.42) is tuned for the rice; metal needs
    // a stronger reflection to read as polished brass.
    envMap: env,
    envMapIntensity: 0.7,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(BOWL.x, 0, BOWL.z)
  return {
    mesh,
    dispose: () => {
      geo.dispose()
      mat.dispose()
    },
  }
}

/* ---------- grain field (struct-of-arrays, sorted by fill time) ---------- */
// Layer ids (used for baked-AO tint)
const L_SURF = 0,
  L_SUB1 = 1,
  L_SUB2 = 2,
  L_CORE = 3,
  L_RIM = 4,
  L_GROUND = 5

type GrainField = {
  n: number
  rest: Float32Array // xyz
  rot: Float32Array // xyz euler
  sc: Float32Array
  start: Float32Array // xyz
  spin: Float32Array // xyz
  fillT: Float32Array // ascending
  layer: Uint8Array
}

type StreamGrain = {
  phase: number
  speed: number
  radius: number
  angle: number
  spin: THREE.Vector3
  rot0: THREE.Vector3
  sc: number
  wobble: number
}

function buildStreamInstances(nStream = 360): StreamGrain[] {
  const r = rng(1337)
  const out: StreamGrain[] = []
  for (let i = 0; i < nStream; i++) {
    out.push({
      phase: i / nStream,
      speed: 0.95 + r() * 0.45,
      radius: Math.pow(r(), 0.7) * 0.28,
      angle: r() * Math.PI * 2,
      spin: new THREE.Vector3(
        (r() - 0.5) * 16,
        (r() - 0.5) * 22,
        (r() - 0.5) * 16,
      ),
      rot0: new THREE.Vector3(
        r() * Math.PI * 2,
        r() * Math.PI * 2,
        r() * Math.PI * 2,
      ),
      sc: 0.92 + r() * 0.18,
      wobble: (r() - 0.5) * 0.08,
    })
  }
  return out
}

function buildInstances(totalTarget = 10500): GrainField {
  const r = rng(7)
  const { R, H } = BOWL
  const topY = 0.07 + H
  const RR = R - 0.075

  // Plain number arrays while building (no per-grain objects -> far less memory / GC)
  const rest: number[] = [],
    rot: number[] = [],
    scA: number[] = [],
    start: number[] = [],
    spin: number[] = []
  const fillA: number[] = [],
    layerA: number[] = []

  const mk = (
    layer: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    sc = 1,
    fillT = 0.5,
  ) => {
    const pourX = BOWL.x + 0.04
    const pourZ = BOWL.z - 0.03
    const startY = 4.4 + r() * 0.8
    const startX = pourX + (r() - 0.5) * 0.16
    const startZ = pourZ + (r() - 0.5) * 0.16
    rest.push(x, y, z)
    rot.push(rx, ry, rz)
    scA.push(sc)
    start.push(startX, startY, startZ)
    spin.push((r() - 0.5) * 10, (r() - 0.5) * 12, (r() - 0.5) * 10)
    fillA.push(Math.max(0.02, Math.min(0.84, fillT)))
    layerA.push(layer)
  }

  const nSurf = Math.round(totalTarget * 0.33)
  const nSub1 = Math.round(totalTarget * 0.24)
  const nSub2 = Math.round(totalTarget * 0.16)
  const nCore = Math.round(totalTarget * 0.11)
  const nRim = Math.round(totalTarget * 0.05)
  const maxGround = Math.round(totalTarget * 0.14)
  const GOLDEN = 2.39996323

  // 1. dense top surface dome (Fermat spiral, gapless)
  for (let i = 0; i < nSurf; i++) {
    const f = (i + 0.5) / nSurf
    const rad = (RR + 0.012) * Math.sqrt(f)
    const phi = i * GOLDEN
    const dome = Math.pow(Math.max(0, 1 - Math.pow(rad / RR, 1.75)), 0.72)
    const y = topY + 0.016 + 0.35 * dome + (r() - 0.5) * 0.014
    const slope =
      rad > 0.04
        ? (-0.35 *
            0.72 *
            1.75 *
            Math.pow(Math.max(0, 1 - Math.pow(rad / RR, 1.75)), -0.28) *
            Math.pow(rad / RR, 0.75)) /
          RR
        : 0
    const sClamped = Math.max(-0.65, Math.min(0, isFinite(slope) ? slope : 0))
    const yaw = phi + Math.PI * 0.5 + (r() - 0.5) * 1.15
    const pitch = sClamped * Math.cos(yaw - phi) + (r() - 0.5) * 0.18
    const roll = (r() - 0.5) * 0.22
    const sc = 0.94 + r() * 0.16
    const fillT = 0.54 + 0.22 * dome + (r() - 0.5) * 0.03
    mk(
      L_SURF,
      BOWL.x + Math.cos(phi) * rad,
      y,
      BOWL.z + Math.sin(phi) * rad,
      pitch,
      yaw,
      roll,
      sc,
      fillT,
    )
  }

  // 2. sub-surface layer 1
  for (let i = 0; i < nSub1; i++) {
    const f = (i + 0.5) / nSub1
    const rad = (RR - 0.01) * Math.sqrt(f)
    const phi = i * GOLDEN + 1.25
    const dome = Math.pow(Math.max(0, 1 - Math.pow(rad / RR, 1.75)), 0.72)
    const depth = 0.035 + r() * 0.045
    const y = topY + 0.35 * dome - depth
    const yaw = r() * Math.PI * 2
    const pitch = (r() - 0.5) * 0.28
    const roll = (r() - 0.5) * 0.28
    const sc = 0.92 + r() * 0.18
    const fillT =
      0.36 + 0.18 * clamp((y - 0.58) / 0.25, 0, 1) + (r() - 0.5) * 0.03
    mk(
      L_SUB1,
      BOWL.x + Math.cos(phi) * rad,
      y,
      BOWL.z + Math.sin(phi) * rad,
      pitch,
      yaw,
      roll,
      sc,
      fillT,
    )
  }

  // 3. sub-surface layer 2
  for (let i = 0; i < nSub2; i++) {
    const f = (i + 0.5) / nSub2
    const rad = (RR - 0.04) * Math.sqrt(f)
    const phi = i * GOLDEN + 2.7
    const dome = Math.pow(Math.max(0, 1 - Math.pow(rad / RR, 1.75)), 0.72)
    const depth = 0.08 + r() * 0.08
    const y = topY + 0.35 * dome - depth
    const yaw = r() * Math.PI * 2
    const pitch = (r() - 0.5) * 0.32
    const roll = (r() - 0.5) * 0.32
    const sc = 0.9 + r() * 0.18
    const fillT =
      0.18 + 0.18 * clamp((y - 0.4) / 0.22, 0, 1) + (r() - 0.5) * 0.03
    mk(
      L_SUB2,
      BOWL.x + Math.cos(phi) * rad,
      y,
      BOWL.z + Math.sin(phi) * rad,
      pitch,
      yaw,
      roll,
      sc,
      fillT,
    )
  }

  // 4. deep bowl cavity fill
  for (let i = 0; i < nCore; i++) {
    const yFrac = r()
    const y = 0.2 + yFrac * (topY - 0.24)
    const rMax = 0.46 + 0.55 * Math.sqrt(yFrac)
    const rad = Math.max(0, rMax - 0.04) * Math.sqrt(r())
    const phi = r() * Math.PI * 2
    const rx = (r() - 0.5) * 0.35
    const ry = r() * Math.PI * 2
    const rz = (r() - 0.5) * 0.35
    const sc = 0.88 + r() * 0.2
    const fillT =
      0.03 + 0.15 * clamp((y - 0.2) / 0.24, 0, 1) + (r() - 0.5) * 0.02
    mk(
      L_CORE,
      BOWL.x + Math.cos(phi) * rad,
      y,
      BOWL.z + Math.sin(phi) * rad,
      rx,
      ry,
      rz,
      sc,
      fillT,
    )
  }

  // 5. rim crest collar
  for (let i = 0; i < nRim; i++) {
    const phi = (i / nRim) * Math.PI * 2 + (r() - 0.5) * 0.06
    const rad = RR + (r() - 0.35) * 0.09
    const y = topY + (r() - 0.5) * 0.025
    const yaw = phi + Math.PI * 0.5 + (r() - 0.5) * 0.5
    const pitch = (r() - 0.3) * 0.35
    const roll = (r() - 0.5) * 0.2
    const sc = 0.94 + r() * 0.16
    const fillT = 0.72 + r() * 0.08
    mk(
      L_RIM,
      BOWL.x + Math.cos(phi) * rad,
      y,
      BOWL.z + Math.sin(phi) * rad,
      pitch,
      yaw,
      roll,
      sc,
      fillT,
    )
  }

  // 6. spilled pile + tabletop scatter
  let placed = 0
  while (placed < maxGround) {
    const spill = r() < 0.55
    let x: number
    let z: number
    let y = 0.028
    if (spill) {
      const u = r()
      x = BOWL.x - 0.55 - u * 2.2 + (r() - 0.5) * 0.75 * (0.35 + u)
      z = BOWL.z - 0.15 - u * 0.75 + (r() - 0.5) * 0.75 * (0.35 + u)
      y = 0.028 + (1 - u) * 0.09 * (r() * 0.6 + 0.4)
    } else if (r() < 0.25) {
      x = -0.95 + (r() - 0.5) * 2.2
      z = -0.2 + (r() - 0.5) * 1.5
      y = 0.025 + r() * 0.02
    } else {
      const a = r() * Math.PI * 2
      const d = 1.04 + Math.abs(r() + r() - 1) * 1.5
      x = BOWL.x + Math.cos(a) * d
      z = BOWL.z + Math.sin(a) * d * 0.85
      y = 0.025 + r() * 0.015
    }
    if (Math.hypot(x - BOWL.x, z - BOWL.z) < 1.04 && y < 0.25) continue
    if (z > 3.6 || z < -1.2 || Math.abs(x) > 4.5) continue
    const rx = (r() - 0.5) * 0.14
    const ry = r() * Math.PI * 2
    const rz = (r() - 0.5) * 0.14
    const sc = 0.92 + r() * 0.18
    const fillT = 0.76 + r() * 0.08
    mk(L_GROUND, x, y, z, rx, ry, rz, sc, fillT)
    placed++
  }

  // Sort by fill time so "which grains are in flight" is a contiguous window [lo, hi)
  const n = fillA.length
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => fillA[a] - fillA[b],
  )
  const out: GrainField = {
    n,
    rest: new Float32Array(n * 3),
    rot: new Float32Array(n * 3),
    sc: new Float32Array(n),
    start: new Float32Array(n * 3),
    spin: new Float32Array(n * 3),
    fillT: new Float32Array(n),
    layer: new Uint8Array(n),
  }
  for (let k = 0; k < n; k++) {
    const s = order[k]
    for (let c = 0; c < 3; c++) {
      out.rest[k * 3 + c] = rest[s * 3 + c]
      out.rot[k * 3 + c] = rot[s * 3 + c]
      out.start[k * 3 + c] = start[s * 3 + c]
      out.spin[k * 3 + c] = spin[s * 3 + c]
    }
    out.sc[k] = scA[s]
    out.fillT[k] = fillA[s]
    out.layer[k] = layerA[s]
  }
  return out
}

/* ---------- matrix helpers (shared temporaries, zero per-frame allocation) ---------- */
const _e = new THREE.Euler()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _m = new THREE.Matrix4()
function writeMat(
  arr: Float32Array,
  i: number,
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
  sx: number,
  sy: number,
  sz: number,
) {
  _e.set(rx, ry, rz)
  _q.setFromEuler(_e)
  _p.set(px, py, pz)
  _s.set(sx, sy, sz)
  _m.compose(_p, _q, _s)
  _m.toArray(arr, i * 16)
}

// first index with a[i] >= x
function lowerBound(a: Float32Array, x: number) {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (a[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}
// first index with a[i] > x
function upperBound(a: Float32Array, x: number) {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (a[mid] <= x) lo = mid + 1
    else hi = mid
  }
  return lo
}

const DT_FALL = 0.045 // scroll-progress length of one grain's fall
const SETTLE_T = 0.88 // bowl full from here on

/* ---------- component ---------- */
export default function FinalScene(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const P = useRef(props)
  P.current = props

  const api = useRef<{
    redraw: (n: string) => void
    dirty: () => void
  } | null>(null)

  useEffect(() => {
    api.current?.redraw(props.name)
  }, [props.name])

  // Render-on-demand: wake the loop whenever anything that affects the image changes
  useEffect(() => {
    api.current?.dirty()
  }, [props.t, props.visible, props.mm, props.width, props.name, props.shift])

  useEffect(() => {
    const el = host.current!
    const cv = canvas.current!
    const LOW = gpuTier() === "low"
    const reduceMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const renderer = new THREE.WebGLRenderer({
      canvas: cv,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    const maxPr = maxDpr()
    let dpr = maxPr
    renderer.setPixelRatio(dpr)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.shadowMap.autoUpdate = false // shadows are re-rendered only when geometry actually moved
    renderer.shadowMap.needsUpdate = true
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const env = makeStudioEnv(renderer)
    scene.environment = env
    scene.environmentIntensity = 0.42

    // Key light: warm raking sun, tracks scroll progress (cooler/dimmer at the start -> golden at the end)
    const sun = new THREE.DirectionalLight("#fff2da", 4.5)
    sun.position.set(-3.4, 5.2, 3.2)
    sun.target.position.set(BOWL.x * 0.6, 0.45, BOWL.z * 0.6)
    sun.castShadow = true
    sun.shadow.mapSize.set(LOW ? 1024 : 4096, LOW ? 1024 : 4096)
    const sc = sun.shadow.camera
    sc.left = -2.8
    sc.right = 2.8
    sc.top = 3.2
    sc.bottom = -1.4
    sc.near = 1.0
    sc.far = 16
    sun.shadow.radius = 1.0
    sun.shadow.bias = -0.00004
    sun.shadow.normalBias = 0.0028

    const fill = new THREE.DirectionalLight("#7898ba", 0.32)
    fill.position.set(5.0, 4.0, 3.5)

    const backRim = new THREE.DirectionalLight("#ffffff", 3.4)
    backRim.position.set(2.8, 3.8, -4.0)

    const spot = new THREE.SpotLight("#ffe8ba", 28, 25, 0.42, 0.5, 1.6)
    spot.position.set(1.4, 6.8, 2.2)
    spot.target.position.set(BOWL.x, 0.75, BOWL.z)
    const goldRim = new THREE.PointLight("#ff9a3c", 70, 22, 2)
    goldRim.position.set(-4, 2.5, -2.5)
    // Every light is evaluated per fragment on ~10k instanced grains: drop the two least visible on weak GPUs.
    scene.add(sun, sun.target, backRim, spot, spot.target)
    if (!LOW) scene.add(fill, goldRim)

    const sunCold = new THREE.Color("#ffe6c2")
    const sunWarm = new THREE.Color("#fff2da")

    const discCv = document.createElement("canvas")
    discCv.width = discCv.height = 256
    const dg = discCv.getContext("2d")!
    const dgr = dg.createRadialGradient(128, 128, 20, 128, 128, 128)
    dgr.addColorStop(0, "#fff")
    dgr.addColorStop(0.55, "#aaa")
    dgr.addColorStop(1, "#000")
    dg.fillStyle = dgr
    dg.fillRect(0, 0, 256, 256)
    const discTex = new THREE.CanvasTexture(discCv)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 96),
      new THREE.MeshStandardMaterial({
        color: "#241a0e",
        roughness: 0.38,
        metalness: 0.65,
        transparent: true,
        alphaMap: discTex,
      }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = -0.002
    scene.add(disc)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.24, 128),
      new THREE.MeshBasicMaterial({
        color: "#d9a441",
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.003
    scene.add(ring)
    const dust = makeDust(LOW ? 60 : 200, [16, 9, 12], 0.07, "#ffd98a", 0.7)
    dust.pts.position.set(0.1, 3.5, 0)
    scene.add(dust.pts)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.55 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    /* ---- loop state ---- */
    let disposed = false
    let needs = true
    let shadowDirty = true
    const bag = makeBag(P.current.name, () => {
      needs = true
      shadowDirty = true
    })
    const bowl = makeBowl(env)
    bag.rootGroup.scale.set(0.9, 0.9, 0.9)
    scene.add(bag.rootGroup, bowl.mesh)

    /* ---- grains ---- */
    const geo = makeGrainGeometry(false, 24, 14) // nLathe < 60 -> shared LOD mesh (see grain.ts)
    const mat = makeGrainMaterial({
      color: "#fffdf6",
      roughness: 0.32,
      normalScale: 0.85,
      opacity: 0.98,
      transparent: false,
    })
    mat.clearcoat = LOW ? 0 : 0.28 // clearcoat is a whole extra specular lobe per fragment
    mat.clearcoatRoughness = 0.2

    const field = buildInstances(LOW ? 4800 : 10500)
    const N = field.n
    const riceMesh = new THREE.InstancedMesh(geo, mat, N)
    riceMesh.castShadow = true
    riceMesh.receiveShadow = true
    riceMesh.frustumCulled = false
    riceMesh.count = 0 // nothing drawn until grains start falling

    const streamGrains = buildStreamInstances(LOW ? 140 : 360)
    const streamMesh = new THREE.InstancedMesh(geo, mat, streamGrains.length)
    streamMesh.castShadow = true
    streamMesh.receiveShadow = true
    streamMesh.frustumCulled = false

    // Tone variation + baked ambient-occlusion tint per depth layer
    const PALETTE = ["#ffffff", "#fcf8ea", "#f5e6c4", "#ebd2a0"].map(
      (c) => new THREE.Color(c),
    )
    const AO = [1, 0.88, 0.76, 0.64, 0.94, 0.92] // indexed by layer id
    const toneRand = rng(882)
    const cVar = new THREE.Color()
    const pickTone = (v: number, lim: [number, number, number]) =>
      v < lim[0]
        ? PALETTE[0]
        : v < lim[1]
          ? PALETTE[1]
          : v < lim[2]
            ? PALETTE[2]
            : PALETTE[3]
    for (let i = 0; i < N; i++) {
      cVar
        .copy(pickTone(toneRand(), [0.3, 0.7, 0.88]))
        .multiplyScalar(AO[field.layer[i]])
      riceMesh.setColorAt(i, cVar)
    }
    riceMesh.instanceColor!.needsUpdate = true
    scene.add(riceMesh)

    for (let i = 0; i < streamGrains.length; i++) {
      streamMesh.setColorAt(i, pickTone(toneRand(), [0.32, 0.72, 0.9]))
    }
    streamMesh.instanceColor!.needsUpdate = true
    scene.add(streamMesh)

    const fov = 30
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 100)
    const tgt = new THREE.Vector3()
    const cam0 = new THREE.Vector3()
    const cam1 = new THREE.Vector3()
    const look0 = new THREE.Vector3()
    const look1 = new THREE.Vector3()
    let w = 1
    let h = 1

    /* ---- grain placement ---- */
    const settled = new Float32Array(N * 16) // final resting matrices, rebuilt only when grain size changes
    const dims = { lg: 0, wg: 0, tg: 0 }
    let prevLo = 0
    let prevHi = 0
    let lastMm = -1
    let lastWidth = -1
    let lastName = P.current.name
    let lastGrainT = -1
    let isSettled = false

    const rebuildSettled = (mm: number, width: number) => {
      const lg = 0.34 * (mm / 8.3)
      const wg = lg * (width / mm)
      const tg = lg * (1.35 / mm)
      dims.lg = lg
      dims.wg = wg
      dims.tg = tg
      for (let i = 0; i < N; i++) {
        const k = i * 3
        let y = field.rest[k + 1]
        if (y < 0.1) y = Math.max(y, tg * 0.42)
        const s = field.sc[i]
        writeMat(
          settled,
          i,
          field.rest[k],
          y,
          field.rest[k + 2],
          field.rot[k],
          field.rot[k + 1],
          field.rot[k + 2],
          lg * s,
          tg * s,
          wg * s,
        )
      }
    }

    // Only grains whose state changed since the last call are rewritten and uploaded.
    const updateGrains = (scrollT: number, full: boolean) => {
      const arr = riceMesh.instanceMatrix.array as Float32Array
      const lo = upperBound(field.fillT, scrollT - DT_FALL) // [0, lo): settled
      const hi = lowerBound(field.fillT, scrollT) //            [lo, hi): in flight, [hi, N): not poured yet
      const from = full ? 0 : Math.min(prevLo, lo)
      const to = full ? N : Math.max(prevHi, hi)
      const { lg, wg, tg } = dims

      for (let i = from; i < to; i++) {
        if (i < lo) {
          arr.set(settled.subarray(i * 16, i * 16 + 16), i * 16)
        } else if (i < hi) {
          const k = i * 3
          const u = (scrollT - field.fillT[i]) / DT_FALL // 0..1
          // Free fall straight down the pour stream (y ~ u^2), then scatter sideways on impact
          const lat = ez(clamp((u - 0.62) / 0.38))
          const flutter = Math.sin(u * 10 + i) * 0.012 * (1 - lat)
          const sx = field.start[k]
          const sy = field.start[k + 1]
          const sz = field.start[k + 2]
          const rx = field.rest[k]
          let ry = field.rest[k + 1]
          const rz = field.rest[k + 2]
          if (ry < 0.1) ry = Math.max(ry, tg * 0.42)
          const px = sx + (rx - sx) * lat + flutter
          const py = sy + (ry - sy) * u * u
          const pz = sz + (rz - sz) * lat - flutter
          const tumble = (1 - u) * 5
          const a = Math.min(1, u * 3.5) * field.sc[i]
          writeMat(
            arr,
            i,
            px,
            py,
            pz,
            field.rot[k] + field.spin[k] * tumble,
            field.rot[k + 1] + field.spin[k + 1] * tumble,
            field.rot[k + 2] + field.spin[k + 2] * tumble,
            lg * a,
            tg * a,
            wg * a,
          )
        }
        // i >= hi: not drawn (mesh.count = hi), nothing to write
      }

      prevLo = lo
      prevHi = hi
      riceMesh.count = hi
      const im = riceMesh.instanceMatrix
      if (full || typeof im.addUpdateRange !== "function") {
        im.needsUpdate = true
      } else if (to > from) {
        im.clearUpdateRanges()
        im.addUpdateRange(from * 16, (to - from) * 16)
        im.needsUpdate = true
      }
    }

    // Continuous pour stream while scrolling
    const updateStream = (nowMs: number, scrollT: number) => {
      if (scrollT >= SETTLE_T) {
        streamMesh.visible = false
        return
      }
      streamMesh.visible = true
      const streamTaper = clamp((SETTLE_T - scrollT) / 0.12, 0, 1)
      const { lg, wg, tg } = dims
      const tSec = nowMs * 0.001
      const pourX = BOWL.x + 0.04
      const pourZ = BOWL.z - 0.03
      const yTop = 4.6
      const yMound = 0.22 + 0.76 * clamp(scrollT / 0.78, 0, 1)
      const arr = streamMesh.instanceMatrix.array as Float32Array

      for (let i = 0; i < streamGrains.length; i++) {
        const sg = streamGrains[i]
        const p = (((tSec * sg.speed * 0.72 + sg.phase) % 1.0) + 1.0) % 1.0
        if (p < 0.76) {
          const u = p / 0.76
          const y = yTop - (yTop - yMound) * (0.32 * u + 0.68 * u * u)
          const rad = sg.radius * (0.35 + 0.65 * u)
          const angle = sg.angle + u * 2.0 + tSec * 0.4
          const x =
            pourX + Math.cos(angle) * rad + Math.sin(u * 7 + sg.wobble) * 0.02
          const z =
            pourZ + Math.sin(angle) * rad + Math.cos(u * 7 + sg.wobble) * 0.02
          const appear = Math.min(1.0, u * 12.0) * streamTaper * sg.sc
          writeMat(
            arr,
            i,
            x,
            y,
            z,
            sg.rot0.x + sg.spin.x * tSec * 1.5,
            sg.rot0.y + sg.spin.y * tSec * 1.5,
            sg.rot0.z + sg.spin.z * tSec * 1.5,
            lg * appear,
            tg * appear,
            wg * appear,
          )
        } else {
          const v = (p - 0.76) / 0.24
          const spread = sg.radius * 1.2 + v * 0.48
          const angle = sg.angle + v * 1.2
          const x = BOWL.x + Math.cos(angle) * spread
          const z = BOWL.z + Math.sin(angle) * spread
          const bounceArc = Math.sin(v * Math.PI) * 0.05
          const domeSlope = Math.pow(Math.min(1.0, spread / BOWL.R), 1.7) * 0.26
          const y = yMound - domeSlope + bounceArc
          const fade =
            Math.max(0.001, 1.0 - Math.pow(v, 3.2)) * streamTaper * sg.sc
          writeMat(
            arr,
            i,
            x,
            y,
            z,
            sg.rot0.x + sg.spin.x * tSec * 3.2,
            sg.rot0.y + sg.spin.y * tSec * 3.2,
            sg.rot0.z + sg.spin.z * tSec * 3.2,
            lg * fade,
            tg * fade,
            wg * fade,
          )
        }
      }
      streamMesh.instanceMatrix.needsUpdate = true
    }

    // Initial layout
    rebuildSettled(P.current.mm, P.current.width)
    lastMm = P.current.mm
    lastWidth = P.current.width
    if (P.current.t >= SETTLE_T) {
      updateGrains(1.0, true)
      streamMesh.visible = false
      isSettled = true
    } else {
      updateGrains(clamp(P.current.t), true)
      updateStream(performance.now(), P.current.t)
    }
    lastGrainT = P.current.t

    /* ---- interaction state ---- */
    const intro0 = reduceMotion ? 0 : 1 - sm(clamp(P.current.t), 0.04, 0.78)
    let yaw = intro0 * 0.45
    let pitch = intro0 * 0.03
    bag.setRotation(pitch, yaw)
    let tYaw = 0
    let tPitch = 0
    let velYaw = 0
    let auto = false
    let isDragging = false
    let lx = 0
    let ly = 0
    let lastFrameT = -1
    let mouseX = 0
    let mouseY = 0
    let curMouseX = 0
    let curMouseY = 0

    api.current = {
      redraw: (n: string) => {
        bag.redraw(n)
        needs = true
        shadowDirty = true
      },
      dirty: () => {
        needs = true
      },
    }

    const applyDpr = () => {
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      needs = true
    }
    const resize = () => {
      w = Math.max(1, el.clientWidth)
      h = Math.max(1, el.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      needs = true
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    document.fonts?.ready.then(() => {
      if (disposed) return
      bag.redraw(P.current.name)
      needs = true
    })

    const onPointerDown = (e: PointerEvent) => {
      lx = e.clientX
      ly = e.clientY
      velYaw = 0
      auto = false
      if (e.pointerType !== "touch") {
        isDragging = true
        try {
          cv.setPointerCapture?.(e.pointerId)
        } catch {}
        needs = true
      } else {
        isDragging = false
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - lx
      const dy = e.clientY - ly

      if (e.pointerType === "touch" && !isDragging) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          isDragging = true
          try {
            cv.setPointerCapture?.(e.pointerId)
          } catch {}
        } else {
          return
        }
      }

      if (!isDragging) return
      const d = dx * 0.008
      tYaw += d
      velYaw = velYaw * 0.6 + d * 0.4 // smoothed release velocity for inertia
      tPitch = Math.max(-0.25, Math.min(0.35, tPitch + dy * 0.004))
      lx = e.clientX
      ly = e.clientY
      needs = true
    }
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false
      try {
        cv.releasePointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      needs = true
    }
    cv.addEventListener("pointerdown", onPointerDown)
    cv.addEventListener("pointermove", onPointerMove)
    cv.addEventListener("pointerup", onPointerUp)
    cv.addEventListener("pointercancel", onPointerUp)

    const onWinMove = (e: MouseEvent) => {
      if (reduceMotion) return
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onWinMove, { passive: true })

    const onContextLost = (e: Event) => e.preventDefault()
    const onContextRestored = () => {
      needs = true
      shadowDirty = true
    }
    cv.addEventListener("webglcontextlost", onContextLost)
    cv.addEventListener("webglcontextrestored", onContextRestored)

    /* ---- frame ---- */
    // Returns true when a frame was actually rendered.
    const frame = (nowMs: number, dt: number): boolean => {
      const p = P.current
      const t = clamp(p.t)
      const tc = sm(t, 0.04, 0.78)

      // drag inertia / auto-rotate feed the yaw target
      if (!isDragging && Math.abs(velYaw) > 0.00015) {
        tYaw += velYaw
        velYaw *= 0.93
        needs = true
      } else if (!isDragging) {
        velYaw = 0
      }
      if (auto && !isDragging) {
        tYaw += dt * 0.35
        needs = true
      }

      // Bag turns from a 3/4 angle into a front-facing pose as the bowl fills (plus user drag on top)
      const intro = reduceMotion ? 0 : 1 - tc
      const wantYaw = tYaw + intro * 0.45
      const wantPitch = tPitch + intro * 0.03
      const dy = wantYaw - yaw
      const dp = wantPitch - pitch
      const bagMoving = Math.abs(dy) > 0.0002 || Math.abs(dp) > 0.0002
      const mouseMoving =
        Math.abs(mouseX - curMouseX) > 0.0008 ||
        Math.abs(mouseY - curMouseY) > 0.0008
      const dimsChanged = p.mm !== lastMm || p.width !== lastWidth
      const nameChanged = p.name !== lastName
      const streaming = t < SETTLE_T

      if (
        !(
          needs ||
          bagMoving ||
          mouseMoving ||
          t !== lastFrameT ||
          streaming ||
          dimsChanged ||
          nameChanged ||
          isDragging
        )
      )
        return false
      needs = false
      lastFrameT = t

      let moved = false
      if (bagMoving) {
        const k = 1 - Math.exp(-dt * 5.5) // frame-rate independent smoothing
        yaw += dy * k
        pitch += dp * k
        bag.setRotation(pitch, yaw)
        moved = true
      }

      if (nameChanged) {
        lastName = p.name
        bag.redraw(p.name)
        moved = true
      }

      // ---- grains ----
      if (dimsChanged) {
        lastMm = p.mm
        lastWidth = p.width
        rebuildSettled(p.mm, p.width)
        isSettled = false
        lastGrainT = -1
        prevLo = 0
        prevHi = 0
      }
      if (streaming) {
        isSettled = false
        if (Math.abs(t - lastGrainT) > 0.0004 || lastGrainT < 0) {
          updateGrains(t, lastGrainT < 0)
          lastGrainT = t
        }
        updateStream(nowMs, t)
        moved = true
      } else if (!isSettled) {
        updateGrains(1.0, true)
        updateStream(nowMs, 1.0)
        isSettled = true
        lastGrainT = t
        moved = true
      }

      // ---- lights follow scroll progress ----
      sun.intensity = 4.1 + 0.4 * tc
      sun.color.copy(sunCold).lerp(sunWarm, tc)
      goldRim.intensity = 45 + 25 * tc

      // ---- camera ----
      const aspect = w / h
      const wide = aspect >= 1.05
      const baseLookX = wide ? 0.82 : 0.08
      const baseLookY = 1.45
      const baseLookZ = 0.15
      const distPull = wide
        ? 8.5
        : Math.max(
            9.0,
            3.8 / (2 * Math.tan((fov * Math.PI) / 360) * Math.min(1, aspect)),
          )

      cam1.set(baseLookX, 2.05, baseLookZ + distPull)
      look1.set(baseLookX, baseLookY, baseLookZ)
      cam0.copy(cam1).add(_p.set(-0.06, 0.25, -1.0))
      look0.copy(look1).add(_p.set(-0.02, -0.1, 0.05))
      camera.position.lerpVectors(cam0, cam1, tc)
      tgt.lerpVectors(look0, look1, tc)

      const km = 1 - Math.exp(-dt * 3.7)
      curMouseX += (mouseX - curMouseX) * km
      curMouseY += (mouseY - curMouseY) * km
      camera.position.x += curMouseX * 0.22 * tc
      camera.position.y += -curMouseY * 0.14 * tc
      camera.lookAt(tgt)

      dust.setFocus(
        camera.position.distanceTo(tgt),
        (h * renderer.getPixelRatio()) / 2,
      )
      dust.pts.rotation.y = t * 1.2
      dust.pts.position.y = 3.5 + t * 1.5

      bag.rootGroup.position.y = 1.485 - (1 - sm(t, 0.05, 0.5)) * 0.12
      renderer.toneMappingExposure = 0.9 + 0.18 * tc

      // Shadow map is the most expensive pass: refresh only if something that casts shadows moved
      if (moved || shadowDirty) {
        renderer.shadowMap.needsUpdate = true
        shadowDirty = false
      }
      renderer.render(scene, camera)
      return true
    }

    /* ---- adaptive resolution: trade pixel ratio for frame rate on weak devices ---- */
    let emaMs = 16.7
    let samples = 0
    let goodWindows = 0
    const governor = (ms: number) => {
      if (ms <= 0 || ms > 100) return
      emaMs += (ms - emaMs) * 0.1
      if (++samples < 60) return
      samples = 0
      if (emaMs > 26 && dpr > 1) {
        dpr = Math.max(1, dpr * 0.85)
        goodWindows = 0
        applyDpr()
      } else if (emaMs < 17.5 && dpr < maxPr) {
        if (++goodWindows >= 3) {
          dpr = Math.min(maxPr, dpr * 1.1)
          goodWindows = 0
          applyDpr()
        }
      } else {
        goodWindows = 0
      }
    }

    let raf = 0
    let lastTime = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const rawMs = now - lastTime
      lastTime = now
      if (!P.current.visible || disposed) return
      const dt = Math.min(0.05, rawMs / 1000)
      if (frame(now, dt)) governor(rawMs)
    }
    frame(performance.now(), 0.016)
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      api.current = null
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onWinMove)
      cv.removeEventListener("pointerdown", onPointerDown)
      cv.removeEventListener("pointermove", onPointerMove)
      cv.removeEventListener("pointerup", onPointerUp)
      cv.removeEventListener("pointercancel", onPointerUp)
      cv.removeEventListener("webglcontextlost", onContextLost)
      cv.removeEventListener("webglcontextrestored", onContextRestored)
      ro.disconnect()
      bag.dispose()
      bowl.dispose()
      geo.dispose()
      mat.dispose()
      riceMesh.dispose()
      streamMesh.dispose()
      dust.dispose()
      disc.geometry.dispose()
      ;(disc.material as THREE.Material).dispose()
      discTex.dispose()
      ring.geometry.dispose()
      ;(ring.material as THREE.Material).dispose()
      ground.geometry.dispose()
      ;(ground.material as THREE.Material).dispose()
      env.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={host} className="absolute inset-0 select-none overflow-hidden">
      <canvas
        ref={canvas}
        className="block h-full w-full touch-pan-y"
        aria-label={`${props.name} rice bag and serving bowl`}
      />
    </div>
  )
}
