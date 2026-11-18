import * as THREE from "three"
import { KOLAM_GRAIN_GLB_B64 } from "./kolamGrainData"

/**
 * Enhanced 3D Rice Grain Model:
 * Loaded directly from the authentic procedural GLB model (Kolam_Rice_Grain_Enhanced.html).
 * - Real anatomical features: natural notched embryo detachment tip, blunt rounded apical dome,
 *   arched dorsal spine, and ventral groove.
 * - Authentic PBR maps: high-resolution diffuse albedo with chalky starchy core and milling striations,
 *   normal map for Sortex stone micro-ridges, and metallicRoughness map for silky waxy sheen.
 * - Normalized coordinate system: length along +X (1.0 unit), thickness along +Y (1.0 unit),
 *   width along Z (1.0 unit), exactly preserving seed millimeter dimensions when scaled.
 */

function b64bytes(s: string): Uint8Array {
  const b = atob(s)
  const u = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i)
  return u
}

function toB64(u: Uint8Array): string {
  let s = ""
  for (let i = 0; i < u.length; i += 8192) {
    s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 8192)))
  }
  return btoa(s)
}

type ParsedGLB = {
  js: {
    meshes: Array<{
      primitives: Array<{
        attributes: { POSITION: number; NORMAL: number; TEXCOORD_0: number }
        indices: number
        material: number
      }>
    }>
    accessors: Array<{
      bufferView: number
      byteOffset?: number
      type: "SCALAR" | "VEC2" | "VEC3"
      count: number
    }>
    bufferViews: Array<{
      byteOffset: number
      byteLength: number
    }>
    textures: Array<{
      source: number
    }>
    images: Array<{
      bufferView: number
      mimeType: string
    }>
    materials: Array<{
      pbrMetallicRoughness: {
        baseColorTexture: { index: number }
        metallicRoughnessTexture: { index: number }
      }
      normalTexture: { index: number }
    }>
  }
  bin: Uint8Array
}

function parseGLB(u: Uint8Array): ParsedGLB {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength)
  const jl = dv.getUint32(12, true)
  const js = JSON.parse(new TextDecoder().decode(u.subarray(20, 20 + jl)))
  const bo = 20 + jl + 8
  const bl = dv.getUint32(20 + jl, true)
  return { js, bin: u.slice(bo, bo + bl) }
}

function accessor<T extends Float32Array | Uint16Array>(
  g: ParsedGLB,
  i: number,
  TypeCtor: new (buffer: ArrayBuffer, byteOffset: number, length: number) => T,
): T {
  const a = g.js.accessors[i]
  const v = g.js.bufferViews[a.bufferView]
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
  const off = v.byteOffset + (a.byteOffset || 0)
  const bytes = g.bin.buffer.slice(
    g.bin.byteOffset + off,
    g.bin.byteOffset +
      off +
      a.count *
        n *
        (TypeCtor as unknown as { BYTES_PER_ELEMENT: number })
          .BYTES_PER_ELEMENT,
  )
  return new TypeCtor(bytes as ArrayBuffer, 0, a.count * n)
}

let cachedGLB: ParsedGLB | null = null
function getParsedGLB(): ParsedGLB {
  if (!cachedGLB) {
    cachedGLB = parseGLB(b64bytes(KOLAM_GRAIN_GLB_B64))
  }
  return cachedGLB
}

// Extract and cache enhanced textures from the GLB
export type EnhancedRiceTextures = {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

let cachedTextures: EnhancedRiceTextures | null = null

export function getEnhancedTextures(): EnhancedRiceTextures {
  if (cachedTextures) return cachedTextures

  const g = getParsedGLB()
  const tx = g.js.textures
  const mat0 = g.js.materials[0]
  const pbr = mat0.pbrMetallicRoughness

  const loadTex = (imgIndex: number, isSrgb: boolean): THREE.Texture => {
    const v = g.js.bufferViews[g.js.images[imgIndex].bufferView]
    const bytes = g.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength)
    const im = new Image()
    const t = new THREE.Texture(im)
    t.flipY = false
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (isSrgb) {
      t.colorSpace = THREE.SRGBColorSpace
    }
    im.onload = () => {
      t.needsUpdate = true
    }
    im.src = "data:image/png;base64," + toB64(bytes)
    return t
  }

  const map = loadTex(tx[pbr.baseColorTexture.index].source, true)
  const normalMap = loadTex(tx[mat0.normalTexture.index].source, false)
  const roughnessMap = loadTex(
    tx[pbr.metallicRoughnessTexture.index].source,
    false,
  )

  cachedTextures = { map, normalMap, roughnessMap }
  return cachedTextures
}

// Fallback compatibility with existing map helpers
export function getRiceGrainMaps() {
  const { map, normalMap, roughnessMap } = getEnhancedTextures()
  return { diffuseMap: map, bumpMap: normalMap, roughnessMap }
}

export function makeRiceGrainMaps() {
  return getRiceGrainMaps()
}

/**
 * Normalization scale factors:
 * Raw GLB procedural generator units are in metres:
 * length_mm: 5.1 -> range [-0.00255, +0.00255] (length = 0.0051)
 * thickness_mm: 1.4 -> range [-0.0007, +0.0007] (thickness = 0.0014)
 * width_mm: 1.4 -> range [-0.0007, +0.0007] (width = 0.0014)
 *
 * Normalizing to 1.0 unit along all three principal axes ensures that
 * when scaled by (L, Th, W) in the webapp, the seed dimensions and aspect ratios
 * are preserved with 100% precision.
 */
const SCALE_X = 1 / 0.0051
const SCALE_Y = 1 / 0.0014
const SCALE_Z = 1 / 0.0014

let cachedFullGeo: THREE.BufferGeometry | null = null
let cachedLodGeo: THREE.BufferGeometry | null = null

function buildFullGeometry(): THREE.BufferGeometry {
  const g = getParsedGLB()
  const prim = g.js.meshes[0].primitives[0]
  const at = prim.attributes

  const rawPos = accessor(g, at.POSITION, Float32Array)
  const rawNor = accessor(g, at.NORMAL, Float32Array)
  const rawUv = accessor(g, at.TEXCOORD_0, Float32Array)
  const rawIdx = accessor(g, prim.indices, Uint16Array)

  const pos = new Float32Array(rawPos.length)
  for (let i = 0; i < rawPos.length; i += 3) {
    pos[i] = rawPos[i] * SCALE_X
    pos[i + 1] = rawPos[i + 1] * SCALE_Y
    pos[i + 2] = rawPos[i + 2] * SCALE_Z
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  geo.setAttribute("normal", new THREE.BufferAttribute(rawNor.slice(), 3))
  geo.setAttribute("uv", new THREE.BufferAttribute(rawUv.slice(), 2))
  geo.setIndex(new THREE.BufferAttribute(rawIdx.slice(), 1))
  geo.computeBoundingBox()
  return geo
}

function buildLodGeometry(stepR = 4, stepS = 3): THREE.BufferGeometry {
  const g = getParsedGLB()
  const prim = g.js.meshes[0].primitives[0]
  const at = prim.attributes

  const rawPos = accessor(g, at.POSITION, Float32Array)
  const rawNor = accessor(g, at.NORMAL, Float32Array)
  const rawUv = accessor(g, at.TEXCOORD_0, Float32Array)

  // Subsample regular parametric UV grid (80 rings x 48 slices)
  const rings: number[] = []
  for (let r = 0; r < 80; r += stepR) rings.push(r)
  if (rings[rings.length - 1] !== 79) rings.push(79)

  const slices: number[] = []
  for (let s = 0; s < 48; s += stepS) slices.push(s)
  slices.push(48) // include seam vertex

  const numRings = rings.length
  const numSlices = slices.length

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // Pole 0 (vertex 0 at basal tip, X = -0.00255)
  positions.push(rawPos[0] * SCALE_X, rawPos[1] * SCALE_Y, rawPos[2] * SCALE_Z)
  normals.push(rawNor[0], rawNor[1], rawNor[2])
  uvs.push(rawUv[0], rawUv[1])
  const pole0Idx = 0

  // Grid rings
  for (let ri = 0; ri < numRings; ri++) {
    const r = rings[ri]
    for (let si = 0; si < numSlices; si++) {
      const s = slices[si]
      const origIdx = 1 + r * 49 + s
      positions.push(
        rawPos[origIdx * 3] * SCALE_X,
        rawPos[origIdx * 3 + 1] * SCALE_Y,
        rawPos[origIdx * 3 + 2] * SCALE_Z,
      )
      normals.push(
        rawNor[origIdx * 3],
        rawNor[origIdx * 3 + 1],
        rawNor[origIdx * 3 + 2],
      )
      uvs.push(rawUv[origIdx * 2], rawUv[origIdx * 2 + 1])
    }
  }

  // Pole 1 (vertex 3921 at apical tip, X = +0.00255)
  const lastIdx = 3921
  const pole1Idx = 1 + numRings * numSlices
  positions.push(
    rawPos[lastIdx * 3] * SCALE_X,
    rawPos[lastIdx * 3 + 1] * SCALE_Y,
    rawPos[lastIdx * 3 + 2] * SCALE_Z,
  )
  normals.push(
    rawNor[lastIdx * 3],
    rawNor[lastIdx * 3 + 1],
    rawNor[lastIdx * 3 + 2],
  )
  uvs.push(rawUv[lastIdx * 2], rawUv[lastIdx * 2 + 1])

  // Connect Pole 0 to first ring with outward winding
  for (let si = 0; si < numSlices - 1; si++) {
    indices.push(pole0Idx, 1 + (si + 1), 1 + si)
  }

  // Connect quads between consecutive rings
  for (let ri = 0; ri < numRings - 1; ri++) {
    const rCurrBase = 1 + ri * numSlices
    const rNextBase = 1 + (ri + 1) * numSlices
    for (let si = 0; si < numSlices - 1; si++) {
      const c1 = rCurrBase + si
      const c2 = rCurrBase + si + 1
      const n1 = rNextBase + si
      const n2 = rNextBase + si + 1
      indices.push(c1, c2, n2)
      indices.push(c1, n2, n1)
    }
  }

  // Connect last ring to Pole 1 with outward winding
  const rLastBase = 1 + (numRings - 1) * numSlices
  for (let si = 0; si < numSlices - 1; si++) {
    indices.push(pole1Idx, rLastBase + si, rLastBase + (si + 1))
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  )
  geo.setAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array(normals), 3),
  )
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2))
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1))
  geo.computeBoundingBox()
  return geo
}

/**
 * Creates anatomically accurate enhanced 3D rice grain geometry:
 * - When nLathe < 60: returns optimized LOD geometry for high-volume instancing (FinalScene)
 * - When nLathe >= 60: returns full high-definition geometry for single grain viewing (GrainViewer)
 */
export function makeGrainGeometry(
  isInnerCore = false,
  nLathe = 128,
  _nRad = 80,
): THREE.BufferGeometry {
  const isLod = nLathe < 60
  if (isLod) {
    if (!cachedLodGeo) {
      cachedLodGeo = buildLodGeometry(4, 3)
    }
    return cachedLodGeo.clone()
  }

  if (!cachedFullGeo) {
    cachedFullGeo = buildFullGeometry()
  }
  const geo = cachedFullGeo.clone()
  if (isInnerCore) {
    geo.scale(0.96, 0.94, 0.94)
  }
  return geo
}

export type GrainMaterialOptions = {
  color?: string | THREE.Color
  transmission?: number
  roughness?: number
  thickness?: number
  ior?: number
  opacity?: number
  transparent?: boolean
  useMap?: boolean
  normalScale?: number
}

/**
 * Creates authentic translucent MeshPhysicalMaterial matching Kolam_Rice_Grain_Enhanced.html:
 * - High-resolution albedo map with internal starchy core, milling striations, and germ notch
 * - Micro-relief normal map with subtle milling stone grooves
 * - Silky waxy sheen with roughnessMap
 * - Translucent volume with sheen highlights
 */
export function makeGrainMaterial(
  options: string | GrainMaterialOptions = "#fbf7ee",
): THREE.MeshPhysicalMaterial {
  const opt: GrainMaterialOptions =
    typeof options === "string" ? { color: options } : options
  const baseColor = opt.color
    ? new THREE.Color(opt.color)
    : new THREE.Color("#fbf7ee")
  const { map, normalMap, roughnessMap } = getEnhancedTextures()

  const ns = opt.normalScale ?? 0.45
  const isTransparent = opt.transparent ?? true
  const mat = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    map: opt.useMap === false ? null : map,
    normalMap: opt.useMap === false ? null : normalMap,
    normalScale: new THREE.Vector2(ns, ns),
    roughnessMap: opt.useMap === false ? null : roughnessMap,
    roughness: opt.roughness ?? 0.86,
    metalness: 0.0,
    sheen: 0.85,
    sheenColor: new THREE.Color(0.22, 0.2, 0.16),
    sheenRoughness: 0.55,
    envMapIntensity: 1.25,
    ior: opt.ior ?? 1.46,
    transparent: isTransparent,
    opacity: opt.opacity ?? 0.88,
    depthWrite: isTransparent ? false : true,
  })

  if (opt.transmission !== undefined) {
    mat.transmission = opt.transmission
  }
  if (opt.thickness !== undefined) {
    mat.thickness = opt.thickness
  }

  return mat
}

/**
 * Dedicated internal chalky core material (gives internal depth inside the translucent shell)
 */
export function makeGrainCoreMaterial(
  color = "#fffdf7",
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.65,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
  })
}
