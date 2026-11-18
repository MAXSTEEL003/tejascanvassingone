import * as THREE from "three"

export function makeDust(
  count: number,
  spread: [number, number, number],
  size = 0.06,
  color = "#ffd98a",
  opacity = 0.8,
) {
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread[0]
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1]
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2]
    seed[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  const cv = document.createElement("canvas")
  cv.width = cv.height = 64
  const g = cv.getContext("2d")!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.25, "rgba(255,255,255,.55)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const map = new THREE.CanvasTexture(cv)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      map: { value: map },
      color: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      size: { value: size },
      focus: { value: 6 },
      range: { value: 7 },
      scale: { value: 600 },
    },
    vertexShader: `
      uniform float size, focus, range, scale; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        float blur = clamp(abs(d - focus) / range, 0.0, 1.0);
        gl_PointSize = size * scale / max(d, 0.1) * (1.0 + blur * 2.2);
        vA = mix(1.0, 0.28, blur);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 color; uniform float opacity; varying float vA;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * opacity * vA); }`,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  const update = (now: number, dt: number, speed = 1) => {
    const a = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      let y = a.getY(i) + (0.004 + seed[i] * 0.01) * dt * speed
      if (y > spread[1] / 2) y = -spread[1] / 2
      a.setY(i, y)
      a.setX(i, a.getX(i) + Math.sin(now * 0.0005 + seed[i] * 40) * 0.003 * dt)
    }
    a.needsUpdate = true
  }
  const setFocus = (f: number, scale = 600) => {
    mat.uniforms.focus.value = f
    mat.uniforms.scale.value = scale
  }
  const dispose = () => {
    geo.dispose()
    mat.dispose()
    map.dispose()
  }
  return { pts, update, dispose, setFocus }
}
