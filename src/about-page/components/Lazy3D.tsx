import { lazy, Suspense, type ComponentProps } from "react"
import { gpuTier } from "../lib/perf"
import Grain from "./Grain"
import { KESHAR_KALI_BAG_IMAGE } from "../three/kesharKaliBagData"

const GV = lazy(() => import("../three/GrainViewer"))
const FS = lazy(() => import("../three/FinalScene"))

type GVProps = ComponentProps<typeof GV>
type FSProps = ComponentProps<typeof FS>

function GrainFallback() {
  return (
    <div className="grid h-full w-full place-items-center" aria-hidden="true">
      <div className="float">
        <Grain w={260} id="fb" />
      </div>
    </div>
  )
}

export function GrainViewer3D(props: GVProps) {
  if (gpuTier() === "none") return <GrainFallback />
  return (
    <Suspense fallback={<GrainFallback />}>
      <GV {...props} />
    </Suspense>
  )
}

export function FinalScene3D(props: FSProps) {
  const still = (
    <div
      className="absolute inset-0 grid place-items-center"
      aria-hidden="true"
    >
      <img
        src={KESHAR_KALI_BAG_IMAGE}
        alt=""
        className="max-h-[70%] object-contain opacity-90"
      />
    </div>
  )
  if (gpuTier() === "none") return still
  return (
    <Suspense fallback={still}>
      <FS {...props} />
    </Suspense>
  )
}
