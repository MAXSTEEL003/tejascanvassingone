import IndiaMapExperience from "./IndiaMapExperience"
import { StateHub } from "../data/networkData"

interface Props {
  activeStateId: string | null
  onSelectState: (state: StateHub | null) => void
  selectedRegion?: string
}

/**
 * Backward-compatible wrapper pointing to the upgraded IndiaMapExperience
 * Powered by Three.js 3D WebGL Engine & Figma Vector Cartography
 */
export default function IndiaDottedMap(props: Props) {
  return <IndiaMapExperience {...props} />
}
