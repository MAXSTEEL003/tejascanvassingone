import * as THREE from "three"

export interface MapCoordsConfig {
  scale: number
  centerX: number
  centerZ: number
}

export const DEFAULT_MAP_CONFIG: MapCoordsConfig = {
  scale: 0.12,
  centerX: 307.7,
  centerZ: 346.5,
}

/**
 * Converts 2D SVG coordinates (0..615.43, 0..693) into Three.js 3D world coordinates.
 * In 3D:
 * - X is West (-) to East (+)
 * - Y is Altitude / Elevation (Up)
 * - Z is North (-) to South (+)
 */
export function svgToWorld3D(
  svgX: number,
  svgY: number,
  elevation = 0,
  config: MapCoordsConfig = DEFAULT_MAP_CONFIG,
): THREE.Vector3 {
  const x = (svgX - config.centerX) * config.scale
  const z = (svgY - config.centerZ) * config.scale
  return new THREE.Vector3(x, elevation, z)
}

/**
 * Evaluates a cubic Bezier curve at parameter t in [0, 1]
 */
function cubicBezierPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  const x = mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0]
  const y = mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1]
  return [x, y]
}

/**
 * Parses SVG path string into a THREE.Shape (used for ExtrudeGeometry or ShapeGeometry)
 */
export function parseSvgPathToShape(pathData: string): THREE.Shape {
  const shape = new THREE.Shape()
  const tokens = pathData.match(/[a-zA-Z]|[-+]?[0-9]*\.?[0-9]+/g)
  if (!tokens) return shape

  let i = 0
  let currentCmd = ""

  while (i < tokens.length) {
    const token = tokens[i]
    if (/^[a-zA-Z]$/.test(token)) {
      currentCmd = token
      i++
    }

    if (currentCmd === "M") {
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      shape.moveTo(x, y)
    } else if (currentCmd === "L") {
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      shape.lineTo(x, y)
    } else if (currentCmd === "C") {
      const cp1x = parseFloat(tokens[i++])
      const cp1y = parseFloat(tokens[i++])
      const cp2x = parseFloat(tokens[i++])
      const cp2y = parseFloat(tokens[i++])
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
    } else if (currentCmd === "Z" || currentCmd === "z") {
      shape.closePath()
    } else {
      i++
    }
  }

  return shape
}

/**
 * Parses SVG path into continuous 3D polylines for state border lines
 */
export function parseSvgPathToLines(
  pathData: string,
  elevation = 0.2,
  config: MapCoordsConfig = DEFAULT_MAP_CONFIG,
): THREE.Vector3[][] {
  const polylines: THREE.Vector3[][] = []
  let currentLine: THREE.Vector3[] = []
  let currentPt: [number, number] = [0, 0]

  const tokens = pathData.match(/[a-zA-Z]|[-+]?[0-9]*\.?[0-9]+/g)
  if (!tokens) return polylines

  let i = 0
  let currentCmd = ""

  while (i < tokens.length) {
    const token = tokens[i]
    if (/^[a-zA-Z]$/.test(token)) {
      currentCmd = token
      i++
    }

    if (currentCmd === "M") {
      if (currentLine.length > 1) {
        polylines.push(currentLine)
      }
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      currentPt = [x, y]
      currentLine = [svgToWorld3D(x, y, elevation, config)]
    } else if (currentCmd === "L") {
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      currentPt = [x, y]
      currentLine.push(svgToWorld3D(x, y, elevation, config))
    } else if (currentCmd === "C") {
      const cp1x = parseFloat(tokens[i++])
      const cp1y = parseFloat(tokens[i++])
      const cp2x = parseFloat(tokens[i++])
      const cp2y = parseFloat(tokens[i++])
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])

      const steps = 6
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const [bx, by] = cubicBezierPoint(
          currentPt,
          [cp1x, cp1y],
          [cp2x, cp2y],
          [x, y],
          t,
        )
        currentLine.push(svgToWorld3D(bx, by, elevation, config))
      }
      currentPt = [x, y]
    } else if (currentCmd === "Z" || currentCmd === "z") {
      if (currentLine.length > 0) {
        currentLine.push(currentLine[0].clone())
      }
    } else {
      i++
    }
  }

  if (currentLine.length > 1) {
    polylines.push(currentLine)
  }

  return polylines
}

/**
 * Parses SVG path string with potential multiple 'M' commands into an array of THREE.Shape[]
 * Each 'M' segment creates a discrete, clean, non-self-intersecting shape.
 */
export function parseSvgPathToShapesArray(pathData: string): THREE.Shape[] {
  const shapes: THREE.Shape[] = []
  let currentShape: THREE.Shape | null = null
  let hasPoints = false

  const tokens = pathData.match(/[a-zA-Z]|[-+]?[0-9]*\.?[0-9]+/g)
  if (!tokens) return shapes

  let i = 0
  let currentCmd = ""

  while (i < tokens.length) {
    const token = tokens[i]
    if (/^[a-zA-Z]$/.test(token)) {
      currentCmd = token
      i++
    }

    if (currentCmd === "M") {
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      if (currentShape && hasPoints) {
        shapes.push(currentShape)
      }
      currentShape = new THREE.Shape()
      currentShape.moveTo(x, y)
      hasPoints = false
    } else if (currentCmd === "L") {
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      if (currentShape) {
        currentShape.lineTo(x, y)
        hasPoints = true
      }
    } else if (currentCmd === "C") {
      const cp1x = parseFloat(tokens[i++])
      const cp1y = parseFloat(tokens[i++])
      const cp2x = parseFloat(tokens[i++])
      const cp2y = parseFloat(tokens[i++])
      const x = parseFloat(tokens[i++])
      const y = parseFloat(tokens[i++])
      if (currentShape) {
        currentShape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
        hasPoints = true
      }
    } else if (currentCmd === "Z" || currentCmd === "z") {
      if (currentShape) {
        currentShape.closePath()
      }
    } else {
      i++
    }
  }

  if (currentShape && hasPoints) {
    shapes.push(currentShape)
  }

  return shapes
}

/**
 * Efficiently converts one or more SVG paths into a single merged THREE.BufferGeometry
 * suitable for a single THREE.LineSegments draw call.
 * This combines hundreds of line segments across borders into 1 single WebGL draw call.
 */
export function parseSvgPathsToLineSegmentsGeometry(
  paths: string | string[],
  elevation = 2.05,
  config: MapCoordsConfig = DEFAULT_MAP_CONFIG,
): THREE.BufferGeometry {
  const pathList = Array.isArray(paths) ? paths : [paths]
  const segmentPairs: THREE.Vector3[] = []
  const seenEdges = new Set<string>()

  // Quantize coordinates to avoid duplicate shared boundaries between adjacent states
  const q = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
  const edgeKey = (a: THREE.Vector3, b: THREE.Vector3) => {
    const ka = `${q(a.x)},${q(a.z)}`
    const kb = `${q(b.x)},${q(b.z)}`
    return ka < kb ? `${ka}_${kb}` : `${kb}_${ka}`
  }

  pathList.forEach((pathData) => {
    const polylines = parseSvgPathToLines(pathData, elevation, config)
    polylines.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i]
        const p2 = line[i + 1]
        const key = edgeKey(p1, p2)
        if (!seenEdges.has(key)) {
          seenEdges.add(key)
          segmentPairs.push(p1, p2)
        }
      }
    })
  })

  return new THREE.BufferGeometry().setFromPoints(segmentPairs)
}

/**
 * Creates 3D arched flight curve for supply routes between two 3D points
 */
export function createArchedSupplyCurve(
  origin: THREE.Vector3,
  dest: THREE.Vector3,
  apexHeight = 6.0,
): THREE.QuadraticBezierCurve3 {
  // Compute distance in horizontal X-Z plane
  const dx = dest.x - origin.x
  const dz = dest.z - origin.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  // Height proportional to distance, with minimum arch
  const height = Math.max(3.5, Math.min(10.0, apexHeight * (dist / 30)))

  // Midpoint elevated in Y
  const mid = new THREE.Vector3(
    (origin.x + dest.x) * 0.5,
    Math.max(origin.y, dest.y) + height,
    (origin.z + dest.z) * 0.5,
  )

  return new THREE.QuadraticBezierCurve3(origin, mid, dest)
}

/**
 * Safe WebGL check
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    )
  } catch {
    return false
  }
}
