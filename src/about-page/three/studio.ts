import * as THREE from "three"

/** Dark softbox studio baked to a PMREM: warm key, cool strip, amber kicker. */
export function makeStudioEnv(renderer: THREE.WebGLRenderer) {
  const s = new THREE.Scene()
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 14, 24),
    new THREE.MeshBasicMaterial({ color: "#16110a", side: THREE.BackSide }),
  )
  s.add(room)
  const panel = (
    w: number,
    h: number,
    color: string,
    i: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(i),
        side: THREE.DoubleSide,
      }),
    )
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    s.add(m)
  }
  panel(9, 6, "#ffe2b0", 5, -7, 6, 6)
  panel(2.2, 11, "#bcd2ff", 3, 10, 1, -3)
  panel(8, 3, "#ff9a3c", 3.2, -5, -2, -9)
  panel(10, 2, "#fff4de", 2.2, 0, 6.8, 0)
  panel(5, 5, "#ffd9a0", 1.4, 2, 0, 10)
  const gl = renderer.getContext()
  if (gl && "pixelStorei" in gl) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  }
  const pm = new THREE.PMREMGenerator(renderer)
  const tex = pm.fromScene(s, 0.035).texture
  pm.dispose()
  s.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.material) (m.material as THREE.Material).dispose()
  })
  return tex
}
