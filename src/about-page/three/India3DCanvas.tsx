import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import {
  INDIA_MAINLAND_OUTLINE,
  INDIA_STATE_BORDERS,
  INDIA_ISLANDS,
} from "../data/indiaVectorData"
import { SUPPLY_HUBS, StateHub } from "../data/networkData"
import {
  svgToWorld3D,
  parseSvgPathToShape,
  parseSvgPathsToLineSegmentsGeometry,
  createArchedSupplyCurve,
  isWebGLAvailable,
} from "./map3dUtils"

/** Pin with eased (animated) visual state: render loop moves `c*` toward `t*` every frame */
type PinAnim = {
  group: THREE.Group
  mesh: THREE.Mesh
  halo: THREE.Mesh
  cScale: number
  tScale: number
  cEm: number
  tEm: number
  cHalo: number
  tHalo: number
  cY: number
  tY: number
  tEmColor: THREE.Color
  tHaloColor: THREE.Color
  delay: number // intro stagger (seconds)
}

type RouteAnim = {
  destId: string
  curve: THREE.QuadraticBezierCurve3
  line: THREE.Line
  particles: THREE.Points
  lut: Float32Array // pre-sampled curve (zero allocation in frame loop)
  cOpacity: number
  tOpacity: number
  cSize: number
  tSize: number
  cPOp: number
  tPOp: number
  tColor: THREE.Color
  delay: number
}

const LUT_STEPS = 96
const ease01 = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

function disposeObject(
  o: THREE.Object3D,
  disposedGeoms?: Set<THREE.BufferGeometry>,
  disposedMats?: Set<THREE.Material>,
) {
  const m = o as THREE.Mesh
  if (m.geometry) {
    if (!disposedGeoms || !disposedGeoms.has(m.geometry)) {
      m.geometry.dispose()
      disposedGeoms?.add(m.geometry)
    }
  }
  const mat = m.material as THREE.Material | THREE.Material[] | undefined
  const kill = (x: THREE.Material) => {
    if (disposedMats && disposedMats.has(x)) return
    disposedMats?.add(x)
    const basic = x as THREE.MeshBasicMaterial
    if (basic.map) basic.map.dispose()
    x.dispose()
  }
  if (Array.isArray(mat)) mat.forEach(kill)
  else if (mat) kill(mat)
}

interface Props {
  activeStateId: string | null
  onSelectState: (state: StateHub | null) => void
  selectedRegion?: string
}

export default function India3DCanvas({
  activeStateId,
  onSelectState,
  selectedRegion = "All",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [hoveredHub, setHoveredHub] = useState<StateHub | null>(null)
  const [isAutoRotate, setIsAutoRotate] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  // Internal refs to keep animation loops smooth without React re-renders
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const statePinsRef = useRef<Map<string, PinAnim>>(new Map())
  const supplyCurvesRef = useRef<RouteAnim[]>([])

  // Latest callback ref without re-building scene when identity changes
  const onSelectRef = useRef(onSelectState)
  onSelectRef.current = onSelectState

  // Direct DOM tooltip writes (zero React re-renders on pointer move)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const pointerPxRef = useRef({ x: 0, y: 0 })
  const rayDirtyRef = useRef(true)

  // Eased camera glide controls
  const focusTargetRef = useRef(new THREE.Vector3())
  const focusActiveRef = useRef(false)
  const camGoalRef = useRef<THREE.Vector3 | null>(null)

  const raycasterRef = useRef(new THREE.Raycaster())
  const mousePosRef = useRef(new THREE.Vector2(-999, -999))
  const hoveredHubRef = useRef<StateHub | null>(null)

  // Origin hubs in data
  const nagpurHub = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === "nagpur")!,
    [],
  )
  const miryalagudaHub = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === "miryalaguda")!,
    [],
  )

  // Currently active hub
  const activeHub = useMemo(
    () => SUPPLY_HUBS.find((h) => h.id === activeStateId) || null,
    [activeStateId],
  )

  // Filtered hubs by region
  const isHubMatchingRegion = useCallback(
    (hub: StateHub) => {
      if (selectedRegion === "All") return true
      if (selectedRegion === "North") return hub.region === "North"
      if (selectedRegion === "West") return hub.region === "West"
      if (selectedRegion === "South") return hub.region === "South"
      if (selectedRegion === "East & Central")
        return hub.region === "East" || hub.region === "Central"
      return true
    },
    [selectedRegion],
  )

  useEffect(() => {
    const container = mountRef.current
    if (!container || !isWebGLAvailable()) {
      setIsLoading(false)
      return
    }

    const width = container.clientWidth || 700
    const height = container.clientHeight || 560

    // 1. Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene
    // Clear horizon fog (starts beyond the map so subcontinent is 100% crystal-clear and bright)
    scene.fog = new THREE.Fog(0x0a0705, 110, 260)

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
    camera.position.set(0, 52, 60)
    cameraRef.current = camera

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    rendererRef.current = renderer
    renderer.setSize(width, height)
    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth < 768 ||
        matchMedia("(pointer: coarse)").matches ||
        /iPhone|iPad|Android/i.test(navigator.userAgent))
    const maxPr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.0 : 1.75)
    let dprNow = maxPr
    renderer.setPixelRatio(dprNow)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    container.replaceChildren(renderer.domElement)

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    renderer.domElement.style.touchAction = "pan-y" // Allow vertical page scrolling on touch devices
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = false // Smooth page scroll
    controls.minDistance = 32
    controls.maxDistance = 110
    controls.minPolarAngle = Math.PI * 0.16
    controls.maxPolarAngle = Math.PI * 0.42
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controls.target.set(0, 0, 0)

    controls.addEventListener("start", () => {
      setIsAutoRotate(false)
      focusActiveRef.current = false
      camGoalRef.current = null
    })

    // 5. Cinematic Architectural Museum Lighting Rig (Ultra-Optimized)
    // Hemisphere light provides warm sky radiance and rich dark ground bounce (zero shadow ALU overhead)
    const hemiLight = new THREE.HemisphereLight(0xfff6e8, 0x22160d, 1.35)
    scene.add(hemiLight)

    // Primary High Key Light (crisp specular highlights grazing top chamfers and state relief)
    const topKeyLight = new THREE.DirectionalLight(0xfffaea, 1.45)
    topKeyLight.position.set(24, 58, 28)
    scene.add(topKeyLight)

    // Northern/Western Rim Accent Light (soft fill to accentuate Himalayan ridges and Gujarat coast)
    const rimLight = new THREE.DirectionalLight(0xd9be8b, 0.65)
    rimLight.position.set(-36, 38, -38)
    scene.add(rimLight)

    // Origin citadel local accent lights (Nagpur and Miryalaguda)
    const nagpurLight = new THREE.PointLight(0xff7a45, 2.6, 32, 2)
    const nagpurWorldPos = svgToWorld3D(nagpurHub.x * 6.1543, nagpurHub.y * 6.93, 3.4)
    nagpurLight.position.copy(nagpurWorldPos)
    scene.add(nagpurLight)

    const miryalaLight = new THREE.PointLight(0x00e5a3, 2.6, 32, 2)
    const miryalaWorldPos = svgToWorld3D(miryalagudaHub.x * 6.1543, miryalagudaHub.y * 6.93, 3.4)
    miryalaLight.position.copy(miryalaWorldPos)
    scene.add(miryalaLight)

    // 6. Subcontinent 3D Extruded Geometry (Seamless Unified Landmass + Islands)
    // Extruded as a solid monolithic continent with beveled coastal rim to eliminate internal border canyons
    const mainlandShape = parseSvgPathToShape(INDIA_MAINLAND_OUTLINE)
    const islandShapes = INDIA_ISLANDS.map((pathData) =>
      parseSvgPathToShape(pathData),
    )
    const subcontinentShapes: THREE.Shape[] = [mainlandShape, ...islandShapes]

    // High-precision extrusion settings with beveled chamfers that catch grazing light
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 2.2,
      bevelEnabled: true,
      bevelSegments: 2, // Optimized from 3 to 2 (cuts bevel vertex buffer significantly)
      steps: 1,
      bevelSize: 0.35,
      bevelThickness: 0.35,
      curveSegments: 6, // Smooth curves with optimal vertex count
    }
    const landGeometry = new THREE.ExtrudeGeometry(
      subcontinentShapes,
      extrudeSettings,
    )
    landGeometry.rotateX(Math.PI / 2)
    landGeometry.translate(-307.7, 0, -346.5)
    landGeometry.scale(0.12, 1, 0.12)
    landGeometry.computeVertexNormals()

    // Sculpted Dark Obsidian Cartographic Material (Replacing Gold Fill)
    // Deep obsidian charcoal matching the website's dark luxury theme and Dark Vector mode (#16110a)
    // Provides high-contrast, glare-free depth so gleaming gold boundaries, citadels, and supply arcs shine
    const landMaterial = new THREE.MeshStandardMaterial({
      color: 0x16120c, // Sleek Dark Obsidian / Rich Charcoal
      metalness: 0.42, // Refined satin metallic response
      roughness: 0.46, // Velvety smooth, glare-free diffuse finish
      emissive: 0x0f0b07, // Subtle warm ambient depth
      emissiveIntensity: 0.16,
    })
    const landMesh = new THREE.Mesh(landGeometry, landMaterial)
    landMesh.position.y = 1.7
    scene.add(landMesh)

    // Sculpted Obsidian Bronze Shadow Plinth (Stepped Pedestal beneath the Landmass)
    const baseExtrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 2.6,
      bevelEnabled: true,
      bevelSegments: 1, // 1 segment is optimal for dark foundation base
      steps: 1,
      bevelSize: 0.65,
      bevelThickness: 0.35,
      curveSegments: 6, // 6 curve subdivisions for base plinth
    }
    const baseGeometry = new THREE.ExtrudeGeometry(
      subcontinentShapes,
      baseExtrudeSettings,
    )
    baseGeometry.rotateX(Math.PI / 2)
    baseGeometry.translate(-307.7, 0, -346.5)
    baseGeometry.scale(0.12, 1, 0.12)
    baseGeometry.computeVertexNormals()

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x0e0a06, // Deep foundation obsidian base
      metalness: 0.55,
      roughness: 0.52,
      emissive: 0x0a0704,
      emissiveIntensity: 0.12,
    })
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial)
    baseMesh.position.y = 1.2
    scene.add(baseMesh)

    // 7. Luminous International & Coastal Boundaries (Gleaming Gold Perimeter)
    const intlBordersGeom = parseSvgPathsToLineSegmentsGeometry(
      INDIA_MAINLAND_OUTLINE,
      2.1,
    )
    const intlBordersMat = new THREE.LineBasicMaterial({
      color: 0xffe899,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
    })
    const intlLineSegments = new THREE.LineSegments(
      intlBordersGeom,
      intlBordersMat,
    )
    scene.add(intlLineSegments)

    // 8. Internal State Boundaries (Refined Engraved Brass & Gold Filigree)
    const stateBordersGeom = parseSvgPathsToLineSegmentsGeometry(
      INDIA_STATE_BORDERS,
      2.08,
    )
    const stateBordersMat = new THREE.LineBasicMaterial({
      color: 0xc99632, // Luminous Warm Gold/Brass matching Dark Vector map borders
      linewidth: 1,
      transparent: true,
      opacity: 0.82,
    })
    const stateLineSegments = new THREE.LineSegments(
      stateBordersGeom,
      stateBordersMat,
    )
    scene.add(stateLineSegments)

    // 9. Island Archipelago Perimeter Outlines (Warm Gold)
    const islandBordersGeom = parseSvgPathsToLineSegmentsGeometry(
      INDIA_ISLANDS,
      2.09,
    )
    const islandBordersMat = new THREE.LineBasicMaterial({
      color: 0xffd770,
      linewidth: 1.2,
      transparent: true,
      opacity: 0.95,
    })
    const islandLineSegments = new THREE.LineSegments(
      islandBordersGeom,
      islandBordersMat,
    )
    scene.add(islandLineSegments)

    // 10. Ambient Holographic Ground Grid (concentric telemetry rings)
    const gridGroup = new THREE.Group()
    const ringRadii = [18, 32, 46, 60]
    ringRadii.forEach((r) => {
      const ringGeom = new THREE.RingGeometry(r, r + 0.15, 64)
      ringGeom.rotateX(-Math.PI / 2)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd7b264,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      ring.position.y = -1.8
      gridGroup.add(ring)
    })
    scene.add(gridGroup)

    // 11. Citadels (Nagpur and Miryalaguda) Special 3D Diamond Beacons & Vertical Lasers
    const citadelGroup = new THREE.Group()
    const citadels = [
      { hub: nagpurHub, name: "Nagpur Central Grain Citadel", color: 0xff7a45 },
      { hub: miryalagudaHub, name: "Miryalaguda Rice Milling Citadel", color: 0x00e5a3 },
    ]

    const animatedCitadels: Array<{
      crystal: THREE.Mesh
      beacon: THREE.Mesh
      ring: THREE.Mesh
      baseY: number
    }> = []

    // Reusable shared geometries for citadels
    const sharedCrystalGeom = new THREE.OctahedronGeometry(1.2, 0)
    const sharedBeamGeom = new THREE.CylinderGeometry(0.12, 0.6, 26, 16, 1, true)
    sharedBeamGeom.translate(0, 13, 0)
    const sharedCitadelPulseGeom = new THREE.RingGeometry(0.8, 1.4, 28)
    sharedCitadelPulseGeom.rotateX(-Math.PI / 2)

    citadels.forEach(({ hub, color }) => {
      const pos = svgToWorld3D(hub.x * 6.1543, hub.y * 6.93, 2.12)

      // Dual rotating octahedron crystal
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: color,
        emissiveIntensity: 1.8,
        metalness: 0.95,
        roughness: 0.1,
      })
      const crystal = new THREE.Mesh(sharedCrystalGeom, crystalMat)
      crystal.position.copy(pos)
      crystal.position.y += 1.8
      citadelGroup.add(crystal)

      // Vertical Laser Beam Ascending into the Clouds
      const beamMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const beacon = new THREE.Mesh(sharedBeamGeom, beamMat)
      beacon.position.copy(pos)
      citadelGroup.add(beacon)

      // Ground pulse ring
      const pulseMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(sharedCitadelPulseGeom, pulseMat)
      ring.position.copy(pos)
      ring.position.y = pos.y + 0.03
      citadelGroup.add(ring)

      animatedCitadels.push({ crystal, beacon, ring, baseY: pos.y + 1.8 })
    })
    scene.add(citadelGroup)

    // 12. 19 State Destination Pins with Eased Animation States
    const pinGroup = new THREE.Group()
    const pinMap = new Map<string, PinAnim>()

    // Shared reusable pin geometries & static materials (1 instance shared across all 19 hubs)
    const sharedPostGeom = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 12)
    sharedPostGeom.translate(0, 0.8, 0)
    const sharedPostMat = new THREE.MeshStandardMaterial({
      color: 0x8a6d3b,
      metalness: 0.9,
      roughness: 0.2,
    })

    const sharedSphereGeom = new THREE.SphereGeometry(0.7, 12, 12)
    sharedSphereGeom.translate(0, 1.8, 0)

    const sharedHaloGeom = new THREE.RingGeometry(0.6, 1.1, 20)
    sharedHaloGeom.rotateX(-Math.PI / 2)

    const sharedHitGeom = new THREE.SphereGeometry(2.4, 8, 8)
    sharedHitGeom.translate(0, 1.2, 0)
    const sharedHitMat = new THREE.MeshBasicMaterial({ visible: false })

    const labelTextures: THREE.CanvasTexture[] = []

    SUPPLY_HUBS.forEach((hub, hubIdx) => {
      const pos = svgToWorld3D(hub.x * 6.1543, hub.y * 6.93, 2.12)
      const nodeGroup = new THREE.Group()
      nodeGroup.position.copy(pos)
      nodeGroup.scale.setScalar(0.001)

      // Post (uses shared geometry and shared material)
      const post = new THREE.Mesh(sharedPostGeom, sharedPostMat)
      nodeGroup.add(post)

      // Top Beacon Sphere (uses shared geometry; individual material for emissive animation)
      const sphereMat = new THREE.MeshStandardMaterial({
        color: hub.isOrigin ? 0xffffff : 0xffe28a,
        emissive: hub.isOrigin ? 0xffd700 : 0xd7b264,
        emissiveIntensity: hub.isOrigin ? 1.6 : 0.8,
        metalness: 0.8,
        roughness: 0.2,
      })
      const sphere = new THREE.Mesh(sharedSphereGeom, sphereMat)
      sphere.userData = { hubId: hub.id }
      nodeGroup.add(sphere)

      // Ground Halo Ring (uses shared geometry)
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xd7b264,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      })
      const halo = new THREE.Mesh(sharedHaloGeom, haloMat)
      halo.position.y = 0.04
      nodeGroup.add(halo)

      // High-DPI 3D Billboard Sprite Label (Code + Capital with Dynamic Width)
      const cleanCap = hub.capital.split("(")[0].split("/")[0].trim()
      const labelCanvas = document.createElement("canvas")
      const lCtx = labelCanvas.getContext("2d")
      if (lCtx) {
        // Measure text dynamically for perfectly fitted badge width
        const fontSize = 28
        lCtx.font = `bold ${fontSize}px "Outfit", "Inter", -apple-system, sans-serif`
        const codeWidth = lCtx.measureText(hub.code).width
        lCtx.font = `500 ${fontSize - 4}px "Outfit", "Inter", -apple-system, sans-serif`
        const capWidth = lCtx.measureText(cleanCap).width
        const dotWidth = 20

        const padX = 24
        const cWidth = Math.ceil(padX * 2 + codeWidth + dotWidth + capWidth)
        const cHeight = 80

        labelCanvas.width = cWidth
        labelCanvas.height = cHeight

        lCtx.clearRect(0, 0, cWidth, cHeight)

        // Smooth pill badge with translucent obsidian/gold gradient
        lCtx.beginPath()
        const r = cHeight / 2 - 3
        if (typeof lCtx.roundRect === "function") {
          lCtx.roundRect(3, 3, cWidth - 6, cHeight - 6, r)
        } else {
          lCtx.rect(3, 3, cWidth - 6, cHeight - 6)
        }

        const grad = lCtx.createLinearGradient(0, 0, cWidth, 0)
        if (hub.isOrigin) {
          grad.addColorStop(0, "rgba(36, 24, 10, 0.95)")
          grad.addColorStop(1, "rgba(20, 14, 6, 0.95)")
        } else {
          grad.addColorStop(0, "rgba(16, 12, 8, 0.90)")
          grad.addColorStop(1, "rgba(10, 8, 5, 0.90)")
        }
        lCtx.fillStyle = grad
        lCtx.fill()

        // Hairline gold border
        lCtx.strokeStyle = hub.isOrigin
          ? "rgba(255, 215, 0, 0.85)"
          : "rgba(215, 178, 100, 0.55)"
        lCtx.lineWidth = hub.isOrigin ? 3.5 : 2.5
        lCtx.stroke()

        // Typography
        const midY = cHeight / 2
        let curX = padX

        // State Code
        lCtx.fillStyle = hub.isOrigin ? "#ffd700" : "#e6be68"
        lCtx.font = `bold ${fontSize}px "Outfit", "Inter", -apple-system, sans-serif`
        lCtx.textAlign = "left"
        lCtx.textBaseline = "middle"
        lCtx.fillText(hub.code, curX, midY)
        curX += codeWidth + 8

        // Bullet separator
        lCtx.fillStyle = "rgba(215, 178, 100, 0.45)"
        lCtx.font = `bold ${fontSize - 6}px sans-serif`
        lCtx.fillText("•", curX, midY)
        curX += dotWidth

        // Capital name
        lCtx.fillStyle = "#f8ecdc"
        lCtx.font = `600 ${fontSize - 4}px "Outfit", "Inter", -apple-system, sans-serif`
        lCtx.fillText(cleanCap, curX, midY)

        const lTex = new THREE.CanvasTexture(labelCanvas)
        lTex.generateMipmaps = false
        lTex.minFilter = THREE.LinearFilter
        labelTextures.push(lTex)

        const sMat = new THREE.SpriteMaterial({
          map: lTex,
          transparent: true,
          depthTest: true,
          depthWrite: false,
        })
        const labelSprite = new THREE.Sprite(sMat)
        const spriteHeight = 1.18
        const spriteWidth = spriteHeight * (cWidth / cHeight)
        labelSprite.scale.set(spriteWidth, spriteHeight, 1)
        labelSprite.position.set(0, 3.55, 0)
        nodeGroup.add(labelSprite)
      }

      // Invisible expanded hit sphere for effortless pointer selection (shared geom & mat)
      const hitMesh = new THREE.Mesh(sharedHitGeom, sharedHitMat)
      hitMesh.userData = { hubId: hub.id }
      nodeGroup.add(hitMesh)

      pinGroup.add(nodeGroup)
      pinMap.set(hub.id, {
        group: nodeGroup,
        mesh: sphere,
        halo,
        cScale: 1,
        tScale: 1,
        cEm: hub.isOrigin ? 1.6 : 0.8,
        tEm: 0.8,
        cHalo: 0.5,
        tHalo: 0.5,
        cY: 0,
        tY: 0,
        tEmColor: new THREE.Color(0xd7b264),
        tHaloColor: new THREE.Color(0xd7b264),
        delay: 0.25 + hubIdx * 0.045,
      })
    })
    statePinsRef.current = pinMap
    scene.add(pinGroup)

    // 13. Arched 3D Supply Conduits & Flowing Photon Particles
    const routesGroup = new THREE.Group()
    const supplyRoutes: RouteAnim[] = []

    SUPPLY_HUBS.forEach((dest, destIdx) => {
      if (dest.isOrigin) return

      const originHub = dest.originHub === "miryalaguda" ? miryalagudaHub : nagpurHub
      const routeColor = dest.originHub === "miryalaguda" ? 0x00e5a3 : 0xff7a45

      const pOrigin = svgToWorld3D(
        originHub.x * 6.1543,
        originHub.y * 6.93,
        3.9,
      )
      const pDest = svgToWorld3D(dest.x * 6.1543, dest.y * 6.93, 3.9)

      const curve = createArchedSupplyCurve(pOrigin, pDest, 7.5)
      const pts = curve.getPoints(36)
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts)
      const lineMat = new THREE.LineBasicMaterial({
        color: routeColor,
        transparent: true,
        opacity: 0,
      })
      const line = new THREE.Line(lineGeom, lineMat)
      lineGeom.setDrawRange(0, 2)
      routesGroup.add(line)

      // Traveling photon particle along the curve
      const particleCount = 4
      const particleGeom = new THREE.BufferGeometry()
      const posArray = new Float32Array(particleCount * 3)
      particleGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(posArray, 3),
      )
      const particleMat = new THREE.PointsMaterial({
        color: routeColor,
        size: 0.9,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      })
      const particles = new THREE.Points(particleGeom, particleMat)
      routesGroup.add(particles)

      // Pre-sample points along curve into typed lookup table (zero allocations during animation)
      const lutPts = curve.getPoints(LUT_STEPS)
      const lut = new Float32Array(lutPts.length * 3)
      lutPts.forEach((pt, i) => {
        lut[i * 3] = pt.x
        lut[i * 3 + 1] = pt.y
        lut[i * 3 + 2] = pt.z
      })
      particles.visible = false

      supplyRoutes.push({
        destId: dest.id,
        curve,
        line,
        particles,
        lut,
        cOpacity: 0.35,
        tOpacity: 0.35,
        cSize: 0.9,
        tSize: 0.9,
        cPOp: 0.8,
        tPOp: 0.8,
        tColor: new THREE.Color(routeColor),
        delay: 0.9 + destIdx * 0.07,
      })
    })

    // Inter-Citadel Express Artery (Nagpur to Miryalaguda Central-South Spine)
    const p1 = svgToWorld3D(nagpurHub.x * 6.1543, nagpurHub.y * 6.93, 4.2)
    const p2 = svgToWorld3D(miryalagudaHub.x * 6.1543, miryalagudaHub.y * 6.93, 4.2)
    const interCurve = createArchedSupplyCurve(p1, p2, 8.5)
    const interPts = interCurve.getPoints(42)
    const interLineGeom = new THREE.BufferGeometry().setFromPoints(interPts)
    const interLineMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.85,
    })
    const interLine = new THREE.Line(interLineGeom, interLineMat)
    routesGroup.add(interLine)

    const interParticlesGeom = new THREE.BufferGeometry()
    interParticlesGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(5 * 3), 3))
    const interParticlesMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.25,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    })
    const interParticles = new THREE.Points(interParticlesGeom, interParticlesMat)
    routesGroup.add(interParticles)

    const interLutPts = interCurve.getPoints(LUT_STEPS)
    const interLut = new Float32Array(interLutPts.length * 3)
    interLutPts.forEach((pt, i) => {
      interLut[i * 3] = pt.x
      interLut[i * 3 + 1] = pt.y
      interLut[i * 3 + 2] = pt.z
    })

    supplyRoutes.push({
      destId: "inter-nagpur-miryala",
      curve: interCurve,
      line: interLine,
      particles: interParticles,
      lut: interLut,
      cOpacity: 0.75,
      tOpacity: 0.75,
      cSize: 1.25,
      tSize: 1.25,
      cPOp: 0.95,
      tPOp: 0.95,
      tColor: new THREE.Color(0xffd700),
      delay: 0.6,
    })
    supplyCurvesRef.current = supplyRoutes
    scene.add(routesGroup)

    // 14. Floating Golden Grain / Chaff Dust Particle Field
    const dustCount = 280
    const dustGeom = new THREE.BufferGeometry()
    const dustPos = new Float32Array(dustCount * 3)
    const dustVel = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3 + 0] = (Math.random() - 0.5) * 80
      dustPos[i * 3 + 1] = Math.random() * 26 + 1
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 90

      dustVel[i * 3 + 0] = (Math.random() - 0.5) * 0.02
      dustVel[i * 3 + 1] = Math.random() * 0.015 + 0.005
      dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.02
    }
    dustGeom.setAttribute("position", new THREE.BufferAttribute(dustPos, 3))
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd770,
      size: 0.55,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    })
    const dustParticles = new THREE.Points(dustGeom, dustMat)
    scene.add(dustParticles)

    setIsLoading(false)

    // 15. Animation Loop with Visibility Throttling, Eased Lerping, and Frame-Rate Independence
    const clock = new THREE.Clock()
    let elapsed = 0
    let frameNo = 0
    let isVisible = true

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
      },
      { threshold: 0.05 },
    )
    observer.observe(container)

    const handleVisibilityChange = () => {
      isVisible = !document.hidden
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const hitCandidates: THREE.Object3D[] = []
    pinGroup.children.forEach((grp) =>
      grp.children.forEach((c) => {
        if (c.userData && c.userData.hubId) hitCandidates.push(c)
      }),
    )

    const applySize = () => {
      const w = container.clientWidth || 700
      const h = container.clientHeight || 560
      const aspect = w / h
      camera.aspect = aspect
      if (aspect < 1) {
        // Broaden FOV dynamically so wide peninsular and eastern state extremities fit fully on narrow mobile screens
        camera.fov = Math.min(56, 42 / Math.min(1, aspect * 1.08))
      } else {
        camera.fov = 42
      }
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(dprNow)
      renderer.setSize(w, h)
    }

    let emaMs = 16.7
    let govSamples = 0

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      if (!isVisible) {
        clock.getDelta()
        return
      }

      const dt = Math.min(0.05, clock.getDelta())
      elapsed += dt
      frameNo++
      const kp = 1 - Math.exp(-dt * 9) // Smooth exponential easing

      // Adaptive DPR governor: drops resolution gracefully if sustained lag occurs
      emaMs += (dt * 1000 - emaMs) * 0.05
      if (++govSamples >= 120) {
        govSamples = 0
        if (emaMs > 24 && dprNow > 1) {
          dprNow = Math.max(1, dprNow * 0.9)
          applySize()
        }
      }

      // Eased camera glide (zoom buttons, reset, hub selection)
      const goal = camGoalRef.current
      if (goal) {
        camera.position.lerp(goal, 1 - Math.exp(-dt * 4.5))
        if (camera.position.distanceToSquared(goal) < 0.0025) {
          camera.position.copy(goal)
          camGoalRef.current = null
        }
      }
      if (focusActiveRef.current) {
        controls.target.lerp(focusTargetRef.current, 1 - Math.exp(-dt * 4.2))
        if (
          controls.target.distanceToSquared(focusTargetRef.current) < 0.0004
        ) {
          controls.target.copy(focusTargetRef.current)
          focusActiveRef.current = false
        }
      }
      controls.update()

      // Clean steady illumination: no wandering glare hotspots

      // Animate Citadel crystals, lasers and sonar pulse rings
      animatedCitadels.forEach(({ crystal, beacon, ring, baseY }, idx) => {
        crystal.rotation.y = elapsed * 0.8 * (idx === 0 ? 1 : -1)
        crystal.rotation.x = Math.sin(elapsed * 1.5 + idx) * 0.15
        crystal.position.y = baseY + Math.sin(elapsed * 2 + idx) * 0.3

        const bMat = beacon.material as THREE.MeshBasicMaterial
        bMat.opacity = 0.35 + Math.sin(elapsed * 4 + idx) * 0.18

        const scale = 1 + ((elapsed * 1.2 + idx * 0.6) % 1) * 2.2
        ring.scale.set(scale, scale, 1)
        const rMat = ring.material as THREE.MeshBasicMaterial
        rMat.opacity = Math.max(0, 0.8 - (scale - 1) / 2.2)
      })

      // Animate destination pins toward their target visuals (hover, active, region filter)
      pinMap.forEach((pin) => {
        if (elapsed < pin.delay) return
        const born = ease01((elapsed - pin.delay) / 0.7)
        pin.cScale += (pin.tScale - pin.cScale) * kp
        pin.cEm += (pin.tEm - pin.cEm) * kp
        pin.cHalo += (pin.tHalo - pin.cHalo) * kp
        pin.cY += (pin.tY - pin.cY) * kp

        pin.group.scale.setScalar(Math.max(0.001, born))
        pin.mesh.scale.setScalar(Math.max(0.001, pin.cScale))

        const sMat = pin.mesh.material as THREE.MeshStandardMaterial
        sMat.emissive.lerp(pin.tEmColor, kp)
        sMat.emissiveIntensity = pin.cEm

        const hMat = pin.halo.material as THREE.MeshBasicMaterial
        hMat.color.lerp(pin.tHaloColor, kp)
        hMat.opacity = pin.cHalo

        pin.group.position.y = 2.12 + pin.cY
      })

      // Supply routes: draw in on load, ease highlight changes, photons sampled from LUT
      supplyRoutes.forEach((r, rIdx) => {
        const born = ease01((elapsed - r.delay) / 1.4)
        if (born < 1)
          r.line.geometry.setDrawRange(0, Math.max(2, Math.floor(37 * born)))
        else if (r.line.geometry.drawRange.count !== Infinity)
          r.line.geometry.setDrawRange(0, Infinity)

        r.cOpacity += (r.tOpacity - r.cOpacity) * kp
        r.cSize += (r.tSize - r.cSize) * kp
        r.cPOp += (r.tPOp - r.cPOp) * kp

        const lMat = r.line.material as THREE.LineBasicMaterial
        const pMat = r.particles.material as THREE.PointsMaterial
        lMat.color.lerp(r.tColor, kp)
        lMat.opacity = r.cOpacity * Math.min(1, born * 2)
        pMat.size = r.cSize
        pMat.opacity = r.cPOp
        r.particles.visible = born > 0.6

        if (r.particles.visible) {
          const pPositions = r.particles.geometry.attributes
            .position as THREE.BufferAttribute
          const arr = pPositions.array as Float32Array
          const count = pPositions.count
          for (let i = 0; i < count; i++) {
            const f =
              ((elapsed * 0.35 + rIdx * 0.1 + i / count) % 1) * LUT_STEPS
            const i0 = Math.floor(f)
            const fr = f - i0
            const a0 = i0 * 3
            const a1 = Math.min(i0 + 1, LUT_STEPS) * 3
            arr[i * 3] = r.lut[a0] + (r.lut[a1] - r.lut[a0]) * fr
            arr[i * 3 + 1] =
              r.lut[a0 + 1] + (r.lut[a1 + 1] - r.lut[a0 + 1]) * fr
            arr[i * 3 + 2] =
              r.lut[a0 + 2] + (r.lut[a1 + 2] - r.lut[a0 + 2]) * fr
          }
          pPositions.needsUpdate = true
        }
      })

      // Animate floating grain dust particles
      const dArr = dustGeom.attributes.position.array as Float32Array
      const vs = dt * 60
      for (let i = 0; i < dustCount; i++) {
        const o = i * 3
        let x = dArr[o] + dustVel[o] * vs
        let y = dArr[o + 1] + dustVel[o + 1] * vs
        let z = dArr[o + 2] + dustVel[o + 2] * vs
        if (y > 28) y = 1
        if (x > 45) x = -45
        else if (x < -45) x = 45
        if (z > 50) z = -50
        else if (z < -50) z = 50
        dArr[o] = x
        dArr[o + 1] = y
        dArr[o + 2] = z
      }
      dustGeom.attributes.position.needsUpdate = true

      // Throttled raycaster (runs on alternate frames when dirty or camera moving, ONLY if pointer is on canvas)
      const cameraMoving =
        controls.autoRotate ||
        camGoalRef.current !== null ||
        focusActiveRef.current
      const isPointerOverCanvas =
        mousePosRef.current.x >= -1 &&
        mousePosRef.current.x <= 1 &&
        mousePosRef.current.y >= -1 &&
        mousePosRef.current.y <= 1

      if (
        isPointerOverCanvas &&
        (rayDirtyRef.current || cameraMoving) &&
        (frameNo & 1) === 0
      ) {
        rayDirtyRef.current = false
        raycasterRef.current.setFromCamera(mousePosRef.current, camera)
        const intersects = raycasterRef.current.intersectObjects(
          hitCandidates,
          false,
        )
        if (intersects.length > 0) {
          const hubId = intersects[0].object.userData.hubId
          const found = SUPPLY_HUBS.find((h) => h.id === hubId) || null
          if (found !== hoveredHubRef.current) {
            hoveredHubRef.current = found
            setHoveredHub(found)
            container.style.cursor = "pointer"
          }
        } else if (hoveredHubRef.current !== null) {
          hoveredHubRef.current = null
          setHoveredHub(null)
          container.style.cursor = "default"
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    // 16. Event Handlers
    const ro = new ResizeObserver(applySize)
    ro.observe(container)

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      mousePosRef.current.set(
        (px / rect.width) * 2 - 1,
        -(py / rect.height) * 2 + 1,
      )
      pointerPxRef.current.x = px
      pointerPxRef.current.y = py
      rayDirtyRef.current = true

      // Update tooltip HUD directly via DOM styles for instant response
      const tt = tooltipRef.current
      if (tt) {
        tt.style.left = `${px}px`
        tt.style.top = `${py}px`
      }
    }

    const handlePointerLeave = () => {
      mousePosRef.current.set(-999, -999)
      rayDirtyRef.current = true
    }

    const handleClick = () => {
      if (hoveredHubRef.current) {
        onSelectRef.current(hoveredHubRef.current)
      }
    }

    const handleContextLost = (e: Event) => e.preventDefault()
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost)
    container.addEventListener("pointermove", handlePointerMove)
    container.addEventListener("pointerdown", handlePointerMove)
    container.addEventListener("pointerleave", handlePointerLeave)
    container.addEventListener("click", handleClick)

    // Cleanup: disconnect observers, cancel RAF, dispose geometries/materials/textures
    return () => {
      observer.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        handleContextLost,
      )
      container.removeEventListener("pointermove", handlePointerMove)
      container.removeEventListener("pointerdown", handlePointerMove)
      container.removeEventListener("pointerleave", handlePointerLeave)
      container.removeEventListener("click", handleClick)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      controls.dispose()
      const disposedGeoms = new Set<THREE.BufferGeometry>()
      const disposedMats = new Set<THREE.Material>()
      scene.traverse((o) => disposeObject(o, disposedGeoms, disposedMats))
      labelTextures.forEach((t) => t.dispose())
      scene.clear()
      renderer.dispose()
    }
  }, [nagpurHub, miryalagudaHub])

  // Eased target updates on hover/selection
  useEffect(() => {
    const curId = hoveredHub?.id || activeStateId

    statePinsRef.current.forEach((pin, id) => {
      const isActive = curId === id
      const hub = SUPPLY_HUBS.find((h) => h.id === id)
      const matchesRegion = hub ? isHubMatchingRegion(hub) : true

      if (isActive) {
        pin.tScale = 1.35
        pin.tEm = 1.6
        pin.tEmColor.setHex(0xffffff)
        pin.tHaloColor.setHex(0xffffff)
        pin.tHalo = 0.85
        pin.tY = 0.35
      } else if (matchesRegion) {
        pin.tScale = 1
        pin.tEm = 0.85
        pin.tEmColor.setHex(0xd7b264)
        pin.tHaloColor.setHex(0xd7b264)
        pin.tHalo = 0.5
        pin.tY = 0
      } else {
        pin.tScale = 0.85
        pin.tEm = 0.6
        pin.tEmColor.setHex(0xa07e3e)
        pin.tHaloColor.setHex(0xa07e3e)
        pin.tHalo = 0.35
        pin.tY = 0
      }
    })

    supplyCurvesRef.current.forEach((r) => {
      if (curId === r.destId) {
        r.tOpacity = 0.95
        r.tColor.setHex(0xffffff)
        r.tSize = 1.4
        r.tPOp = 1.0
      } else {
        r.tOpacity = 0.35
        r.tColor.setHex(0xd7b264)
        r.tSize = 0.9
        r.tPOp = 0.8
      }
    })
  }, [activeStateId, hoveredHub, isHubMatchingRegion])

  // Glide orbit target to selected hub smoothly
  useEffect(() => {
    if (!activeHub) return
    const pos = svgToWorld3D(activeHub.x * 6.1543, activeHub.y * 6.93, 2.5)
    focusTargetRef.current.set(pos.x * 0.6, 0, pos.z * 0.6)
    focusActiveRef.current = true
  }, [activeHub])

  // Smooth reset camera
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return
    focusTargetRef.current.set(0, 0, 0)
    focusActiveRef.current = true
    camGoalRef.current = new THREE.Vector3(0, 52, 60)
    controlsRef.current.autoRotate = true
    setIsAutoRotate(true)
  }, [])

  // Smooth zoom in / out
  const handleZoom = useCallback((direction: "in" | "out") => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    const factor = direction === "in" ? 0.82 : 1.2
    const offset = camera.position.clone().sub(controls.target)
    const len = Math.min(
      controls.maxDistance,
      Math.max(controls.minDistance, offset.length() * factor),
    )
    camGoalRef.current = controls.target.clone().add(offset.setLength(len))
  }, [])

  return (
    <div className="relative aspect-[100/105] sm:aspect-[100/98] w-full overflow-hidden border border-gold/20 bg-gradient-to-b from-[#140f0a]/95 via-[#0c0906]/98 to-[#050403] shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 h-36 w-3/4 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="h-full w-full select-none" />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/90 backdrop-blur-md">
          <div className="relative h-12 w-12">
            <span className="absolute inset-0 border-2 border-gold/30 border-t-gold animate-spin" />
            <span className="absolute inset-2 border border-gold/20 animate-ping" />
          </div>
          <span className="mt-4 font-mono text-xs tracking-widest uppercase text-gold">
            INITIALIZING 3D CARTOGRAPHY ENGINE...
          </span>
        </div>
      )}

      {/* Header HUD / Controls */}
      <div className="pointer-events-none absolute top-4 inset-x-4 flex items-center justify-between z-10">
        <div className="pointer-events-auto flex items-center gap-2 border border-gold/30 bg-coal/85 px-3 py-1 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping bg-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 bg-gold" />
          </span>
          <span className="eyebrow text-[10px] text-gold font-normal">
            3D WebGL Mesh · Real-Time Terrain
          </span>
        </div>

        {/* View Controls Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1 border border-gold/25 bg-coal/90 p-1 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={() => handleZoom("in")}
            title="Zoom In"
            className="flex h-7 w-7 items-center justify-center text-sand transition-colors hover:bg-gold/20 hover:text-gold"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleZoom("out")}
            title="Zoom Out"
            className="flex h-7 w-7 items-center justify-center text-sand transition-colors hover:bg-gold/20 hover:text-gold"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            title="Reset Perspective"
            className="flex h-7 w-7 items-center justify-center text-sand transition-colors hover:bg-gold/20 hover:text-gold"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (controlsRef.current) {
                controlsRef.current.autoRotate = !isAutoRotate
                setIsAutoRotate(!isAutoRotate)
              }
            }}
            title={isAutoRotate ? "Pause Orbit" : "Resume Orbit"}
            className={`flex h-7 w-7 items-center justify-center text-xs font-mono transition-colors ${
              isAutoRotate
                ? "bg-gold/20 text-gold"
                : "text-sand hover:text-ivory"
            }`}
          >
            {isAutoRotate ? (
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4l14 8-14 8V4z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Floating 3D Hover Tooltip HUD (Position updated via direct DOM writes for max FPS) */}
      {hoveredHub && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full pb-3 animate-fadeIn"
          style={{
            left: `${pointerPxRef.current.x}px`,
            top: `${pointerPxRef.current.y}px`,
          }}
        >
          <div className="border border-gold/40 bg-coal/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.92)] backdrop-blur-xl min-w-[220px]">
            <div className="flex items-center justify-between gap-2 border-b border-gold/15 pb-2">
              <div className="flex items-center gap-2">
                <span className="border border-gold/30 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gold">
                  {hoveredHub.code}
                </span>
                <span className="font-display italic text-base font-semibold text-ivory">
                  {hoveredHub.name}
                </span>
              </div>
              {hoveredHub.isOrigin && (
                <span className="border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-saffron">
                  Origin Citadel
                </span>
              )}
            </div>

            {/* Capital City Badge */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-sand">
              <span>Capital:</span>
              <span className="text-gold font-medium">
                {hoveredHub.capital}
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-sand border-t border-gold/10 pt-1.5">
              <span className="text-gold font-medium">
                {hoveredHub.dispatchTime} Transit
              </span>
              <span className="text-gold/40">·</span>
              <span className="text-ivory/90">
                {hoveredHub.partners}+ Partners
              </span>
            </div>

            <div className="mt-1 text-[10px] font-sans text-sand/70 truncate max-w-[210px]">
              {hoveredHub.primaryVarieties.slice(0, 2).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Legend */}
      <div className="pointer-events-none absolute bottom-3 inset-x-4 flex flex-wrap items-center justify-between gap-2 border-t border-gold/15 pt-2 text-[10px] sm:text-xs font-mono text-sand z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 border border-gold bg-white animate-pulse" />
            <span>Nagpur & Miryalaguda Citadels</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-gold" />
            <span>19 State Hubs</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-3 bg-gradient-to-r from-saffron to-gold" />
            <span>Active Conduits</span>
          </span>
        </div>
        <div className="hidden sm:block text-gold/80">
          Drag to orbit · Click any hub to inspect telemetry
        </div>
      </div>
    </div>
  )
}
