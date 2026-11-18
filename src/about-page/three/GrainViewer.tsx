import { useEffect, useRef } from "react"
import * as THREE from "three"
import { makeStudioEnv } from "./studio"
import { gpuTier, maxDpr } from "../lib/perf"
import { makeGrainGeometry, makeGrainMaterial } from "./grain"
import { makeDust } from "./dust"

type Props = {
  mm: number
  width: number
  thickness?: number
  color: string
  active: boolean
  onTouch: () => void
}

const MAX_MM = 8.4
const MAX_L = 6.8 // Max length in 3D units, ensuring 8.4mm grain comfortably fits inside VIEW_W=10 with zero border cutoff
const VIEW_W = 10

function calcDims(mm: number, width: number, thickness?: number) {
  const L = (MAX_L * mm) / MAX_MM
  const W = L * (width / mm)
  const Th = L * ((thickness ?? 1.2) / mm)
  return { L, W, Th }
}

export default function GrainViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const shadow = useRef<HTMLDivElement>(null)
  const P = useRef(props)
  P.current = props
  const st = useRef({
    yaw: 0.15,
    roll: -0.22,
    vy: 0,
    vr: 0,
    drag: false,
    lx: 0,
    ly: 0,
    touched: false,
    pulse: 0,
    lastMm: props.mm,
    mx: 0,
    my: 0,
    hx: 0,
    hy: 0,
  })

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas.current!,
      alpha: true,
      antialias: true,
    })
    renderer.setPixelRatio(maxDpr())
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const pm = new THREE.PMREMGenerator(renderer)
    scene.environment = makeStudioEnv(renderer)
    scene.environmentIntensity = 0.95

    // Lighting specifically tuned for translucent organic rice grain volume
    const key = new THREE.DirectionalLight("#ffe9c4", 3.2)
    key.position.set(-3.5, 4.5, 4.5)

    // Backlight: shines directly THROUGH the grain volume towards camera to illuminate translucency
    const backlight = new THREE.DirectionalLight("#ffffff", 3.8)
    backlight.position.set(0.8, 1.8, -5.5)

    const rim = new THREE.DirectionalLight("#9bb8ff", 2.4)
    rim.position.set(4.5, 1.2, -2.5)

    const fill = new THREE.DirectionalLight("#faf5ed", 1.3)
    fill.position.set(0, -3, 3)

    const ambient = new THREE.AmbientLight("#fff1dc", 0.55)
    const sweep = new THREE.PointLight("#ffc873", 90, 16, 2)
    sweep.position.set(0, 1.5, 3.5)
    const amberBack = new THREE.PointLight("#ff9a3c", 60, 18, 2)
    amberBack.position.set(-4, -1, -3)
    scene.add(key, backlight, rim, fill, ambient, sweep, amberBack)
    const dust = makeDust(gpuTier() === "low" ? 50 : 150, [16, 9, 8], 0.07)
    scene.add(dust.pts)

    const fov = 14
    const tanHalfFov = Math.tan((fov * Math.PI) / 360)
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500)

    // Outer translucent vitreous hull (using enhanced 3D rice grain model)
    const geo = makeGrainGeometry(false)
    const mat = makeGrainMaterial({
      color: P.current.color,
      roughness: 0.86,
      opacity: 0.88,
      transparent: true,
    })
    mat.depthWrite = false
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 1

    // Inner back wall of the grain seen through the translucent volume (from Kolam_Rice_Grain_Enhanced.html)
    const backMat = mat.clone()
    backMat.side = THREE.BackSide
    backMat.normalScale = new THREE.Vector2(0, 0)
    backMat.opacity = 0.88
    backMat.depthWrite = false
    const backMesh = new THREE.Mesh(geo, backMat)
    backMesh.renderOrder = 0

    const group = new THREE.Group()
    group.add(backMesh)
    group.add(mesh)
    scene.add(group)

    const initialDims = calcDims(
      P.current.mm,
      P.current.width,
      P.current.thickness,
    )
    const cur = {
      L: initialDims.L,
      W: initialDims.W,
      Th: initialDims.Th,
    }
    const tint = new THREE.Color(P.current.color)
    mat.color.copy(tint)
    backMat.color.copy(tint)
    mesh.scale.set(cur.L, cur.Th, cur.W)
    backMesh.scale.set(cur.L, cur.Th, cur.W)

    const resize = () => {
      const w = Math.max(1, el.clientWidth)
      const h = Math.max(1, el.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      const d = VIEW_W / 2 / (tanHalfFov * Math.max(0.65, camera.aspect))
      camera.position.set(0, 0, d)
      dust.setFocus(d, (h * renderer.getPixelRatio()) / 2)
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const p = P.current
      const dt = Math.min(2, (now - last) / 16.7)
      last = now
      if (!p.active || document.hidden) return
      const k = st.current

      if (p.mm !== k.lastMm) {
        k.lastMm = p.mm
        k.vy += 8
        k.pulse = 1
      }
      k.pulse *= 0.93

      const { L: tL, W: tW, Th: tTh } = calcDims(p.mm, p.width, p.thickness)

      cur.L += (tL - cur.L) * 0.11 * dt
      cur.W += (tW - cur.W) * 0.11 * dt
      cur.Th += (tTh - cur.Th) * 0.11 * dt
      tint.set(p.color)
      mat.color.lerp(tint, 0.1)
      backMat.color.lerp(tint, 0.1)
      k.hx += (k.mx - k.hx) * 0.06 * dt
      k.hy += (k.my - k.hy) * 0.06 * dt
      sweep.position.x = Math.sin(now / 1500) * 6.5
      sweep.position.y = 1.2 + Math.cos(now / 2300) * 1.8
      dust.pts.position.x = -k.hx * 0.9
      dust.pts.position.y = k.hy * 0.5
      dust.update(now, dt, 1 + k.pulse * 7)

      if (!k.drag) {
        k.yaw += k.vy * dt
        k.roll += k.vr * dt
        k.vy *= 0.94
        k.vr *= 0.94
        if (!reduceMotion) {
          k.roll += 0.005 * dt
          k.yaw += (Math.sin(now / 1900) * 0.22 - k.yaw) * 0.012 * dt
        }
      }
      const bump = 1 + k.pulse * 0.06
      mesh.scale.set(cur.L * bump, cur.Th * bump, cur.W * bump)
      backMesh.scale.set(cur.L * bump, cur.Th * bump, cur.W * bump)
      group.rotation.set(k.roll + k.hy * 0.28, k.yaw + k.hx * 0.5, -0.1, "ZYX")
      renderer.render(scene, camera)

      const sd = shadow.current
      if (sd) {
        const pxu = el.clientWidth / VIEW_W
        const spread = Math.abs(Math.cos(k.yaw)) * 0.3 + 0.7
        sd.style.width = `${cur.L * pxu * 0.9 * spread}px`
        sd.style.transform = `translate(-50%, ${(cur.Th * 0.5 + 0.9) * pxu}px)`
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      geo.dispose()
      mat.dispose()
      backMat.dispose()
      dust.dispose()
      pm.dispose()
      renderer.dispose()
    }
  }, [])

  const onDown = (e: React.PointerEvent) => {
    st.current.lx = e.clientX
    st.current.ly = e.clientY
    st.current.vy = 0
    st.current.vr = 0
    if (e.pointerType !== "touch") {
      st.current.drag = true
      if (!st.current.touched) {
        st.current.touched = true
        props.onTouch()
      }
      try {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } catch {}
    } else {
      st.current.drag = false
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    st.current.mx = ((e.clientX - r.left) / r.width - 0.5) * 2
    st.current.my = ((e.clientY - r.top) / r.height - 0.5) * 2
    const dx = e.clientX - st.current.lx
    const dy = e.clientY - st.current.ly

    if (e.pointerType === "touch" && !st.current.drag) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        st.current.drag = true
        if (!st.current.touched) {
          st.current.touched = true
          props.onTouch()
        }
        try {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        } catch {}
      } else {
        return
      }
    }

    if (!st.current.drag) return
    st.current.lx = e.clientX
    st.current.ly = e.clientY
    st.current.yaw += dx * 0.008
    st.current.roll += dy * 0.008
    st.current.vy = dx * 0.008
    st.current.vr = dy * 0.008
  }

  const onUp = (e: React.PointerEvent) => {
    st.current.drag = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  return (
    <div
      ref={host}
      className="relative h-full w-full select-none touch-pan-y"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => {
        st.current.mx = 0
        st.current.my = 0
      }}
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div
        ref={shadow}
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-8 -translate-x-1/2 rounded-full bg-gold/30 blur-2xl transition-all duration-700"
      />
    </div>
  )
}
