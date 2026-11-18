export type Variety = {
  name: string
  subname: string
  tone: [string, string, string]
  tint: string
  length: number
  len: string
  mm: number
  width: number
  thickness: number
  texture: string
  aroma: string
  aged: string
  bagWeight: string
  packaging: string
  note: string
  meters: [string, number][]
  pins: string[]
  best: string
  specs: {
    length: string
    width: string
    thickness: string
    ratio: string
    varietyType: string
    origin: string
    packaging: string
  }
}

export const VARIETIES: Variety[] = [
  {
    name: "Keshar Kali",
    subname: "Kolam Raw · Premium Wada Kolam",
    tone: ["#fffdf7", "#f6edd9", "#d2b47e"],
    tint: "#f8f2e2",
    length: 5.1 / 8.4,
    len: "5.1 mm",
    mm: 5.1,
    width: 1.4,
    thickness: 1.3,
    texture: 'Soft, tender, fluffy & separate ("Khila Khila Dana")',
    aroma: "Delicate floral aroma, subtly sweet",
    aged: "Aged 12 months in aerated silos",
    bagWeight: "30 kg",
    packaging: "30 kg Signature High-Barrier Sack",
    note: "Authentic Maharashtra Wada Kolam (Kolam Raw): signature 5.1 mm slender grains with natural notched germ tip and blunt apex. Cooks up light, fluffy, and separate.",
    meters: [
      ["Fluffiness", 96],
      ["Fragrance", 84],
      ["Grain Separation", 94],
      ["Softness & Bite", 92],
    ],
    pins: [
      "5.1 mm length × 1.4 mm width × 1.3 mm thickness",
      "Distinct oblique notched tip (embryo bevel)",
      "Blunt, smoothly rounded apical apex",
      "Pack: Signature 30 kg high-barrier laminated sack",
    ],
    best: "Daily meals & Festive Biryani",
    specs: {
      length: "5.1 mm",
      width: "1.4 mm",
      thickness: "1.3 mm",
      ratio: "3.64 : 1 (Slender Medium)",
      varietyType: "Kolam Raw (Wada Kolam)",
      origin: "Wada, Maharashtra, India",
      packaging: "30 kg High-Barrier Laminated Sack",
    },
  },
  {
    name: "HMT Raw",
    subname: "Aromatic Short Slender",
    tone: ["#fefcf3", "#f0e6cd", "#cbb382"],
    tint: "#f3eedf",
    length: 5.3 / 8.4,
    len: "5.3 mm",
    mm: 5.3,
    width: 1.5,
    thickness: 1.4,
    texture: "Tender bite, non-sticky and soft",
    aroma: "Subtle sweet grain fragrance",
    aged: "Aged 8 months in silos",
    bagWeight: "26 kg",
    packaging: "26 kg Standard Export Sack",
    note: "A celebrated short-slender aromatic grain bred in Maharashtra. Tender texture with subtle sweet aroma, widely favored for everyday balanced meals.",
    meters: [
      ["Fluffiness", 82],
      ["Fragrance", 76],
      ["Grain Separation", 80],
      ["Softness & Bite", 88],
    ],
    pins: [
      "5.3 mm length × 1.5 mm width × 1.4 mm thickness",
      "Compact curved profile with soft apex",
      "Quick cooking with excellent moisture retention",
      "Pack: Standard 26 kg export laminated sack",
    ],
    best: "Everyday meals & Khichdi",
    specs: {
      length: "5.3 mm",
      width: "1.5 mm",
      thickness: "1.4 mm",
      ratio: "3.53 : 1 (Short Slender)",
      varietyType: "HMT Raw Grain",
      origin: "Chandrapur, Maharashtra, India",
      packaging: "26 kg High-Barrier Export Sack",
    },
  },
  {
    name: "Sona Masoori",
    subname: "Medium Slender Daily Rice",
    tone: ["#ffffff", "#f4eddc", "#cfc19f"],
    tint: "#f4f0e4",
    length: 5.5 / 8.4,
    len: "5.5 mm",
    mm: 5.5,
    width: 1.6,
    thickness: 1.5,
    texture: "Light, fluffy, very low starch",
    aroma: "Clean, neutral and light",
    aged: "Aged 6 months",
    bagWeight: "26 kg",
    packaging: "26 kg Standard Export Sack",
    note: "Lightweight and easy to digest, a southern kitchen staple. Naturally low in starch, it cooks into separate, bouncy grains ideal for daily consumption.",
    meters: [
      ["Fluffiness", 88],
      ["Fragrance", 52],
      ["Grain Separation", 86],
      ["Softness & Bite", 78],
    ],
    pins: [
      "5.5 mm length × 1.6 mm width × 1.5 mm thickness",
      "Rounded compact tip with translucent body",
      "Low glycemic response, everyday digestibility",
      "Pack: Standard 26 kg export laminated sack",
    ],
    best: "Daily meals & South Indian fare",
    specs: {
      length: "5.5 mm",
      width: "1.6 mm",
      thickness: "1.5 mm",
      ratio: "3.44 : 1 (Medium Slender)",
      varietyType: "Sona Masoori Raw",
      origin: "Andhra Pradesh / Karnataka, India",
      packaging: "26 kg High-Barrier Export Sack",
    },
  },
  {
    name: "KNM Raw",
    subname: "Volume Kitchen Staple",
    tone: ["#fdfaf0", "#ede1c4", "#c2ad7a"],
    tint: "#ece6d4",
    length: 6.2 / 8.4,
    len: "6.2 mm",
    mm: 6.2,
    width: 1.8,
    thickness: 1.6,
    texture: "Firm, high yield, separate",
    aroma: "Classic neutral cereal aroma",
    aged: "Aged 8 months",
    bagWeight: "26 kg",
    packaging: "26 kg Standard Export Sack",
    note: "Dependable, high-resilience grain developed by agricultural research for volume hospitality. Consistent kernel integrity through bulk steaming.",
    meters: [
      ["Fluffiness", 74],
      ["Fragrance", 40],
      ["Grain Separation", 90],
      ["Softness & Bite", 84],
    ],
    pins: [
      "6.2 mm length × 1.8 mm width × 1.6 mm thickness",
      "Sturdy blunt tip with dense endosperm",
      "Exceptional expansion and steam tolerance",
      "Pack: Standard 26 kg export laminated sack",
    ],
    best: "Volume kitchens & Catering",
    specs: {
      length: "6.2 mm",
      width: "1.8 mm",
      thickness: "1.6 mm",
      ratio: "3.44 : 1 (Medium Long)",
      varietyType: "KNM Raw Grain",
      origin: "Telangana, India",
      packaging: "26 kg High-Barrier Export Sack",
    },
  },
  {
    name: "1121 Basmati",
    subname: "Extra Long Slender Royal Grain",
    tone: ["#fffdf5", "#f1e6c9", "#c4ad7c"],
    tint: "#efe4c8",
    length: 8.4 / 8.4,
    len: "8.4 mm",
    mm: 8.4,
    width: 1.25,
    thickness: 1.15,
    texture: "Regal, dry, elongates up to 2.5x",
    aroma: "Rich floral, nutty 2-AP aroma",
    aged: "Aged 24 months in wooden silos",
    bagWeight: "26 kg",
    packaging: "26 kg Royal Export Sack",
    note: "The global benchmark for royal biryanis and banquets. Renowned for supreme length, needle-fine tips, and up to 2.5x post-cooking elongation without bursting.",
    meters: [
      ["Fluffiness", 94],
      ["Fragrance", 96],
      ["Grain Separation", 98],
      ["Softness & Bite", 64],
    ],
    pins: [
      "8.4 mm length × 1.25 mm width × 1.15 mm thickness",
      "Tapered needle apex with longitudinal dorsal groove",
      "Pearl-white vitreous endosperm aged 24 months",
      "Pack: Royal 26 kg export laminated sack",
    ],
    best: "Royal Biryani & Banquets",
    specs: {
      length: "8.4 mm",
      width: "1.25 mm",
      thickness: "1.15 mm",
      ratio: "6.72 : 1 (Extra Long Needle Slender)",
      varietyType: "Pusa 1121 Basmati",
      origin: "Karnal, Haryana, India",
      packaging: "26 kg High-Barrier Export Sack",
    },
  },
]

export const MAX_MM = 8.4
