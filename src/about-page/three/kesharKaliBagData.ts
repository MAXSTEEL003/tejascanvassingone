// The bag cut-out lives in src/assets as a real file.
// Vite hashes it, applies `base`, and the browser caches / decodes it off the main thread.
import bagUrl from "../assets/keshar-kali-bag.webp"

export const KESHAR_KALI_BAG_IMAGE: string = bagUrl

// Central registry for variety bag images.
// When other bag images are provided in the future, simply map them here!
export const VARIETY_BAG_IMAGES: Record<string, string> = {
  "Keshar Kali": bagUrl,
  // 'HMT Raw': hmtBagUrl,
  // 'Sona Masoori': sonaMasooriBagUrl,
  // 'KNM Raw': knmBagUrl,
  // '1121 Basmati': basmatiBagUrl,
}
