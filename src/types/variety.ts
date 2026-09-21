export interface RiceVariety {
  id: string;
  name: string;
  category: 'Extra Long' | 'Long' | 'Medium' | 'Short' | 'Specialty';
  origin: string;
  lengthMm: number;
  elongationRatio: number;
  moisturePercent: number;
  purityPercent: number;
  aromaProfile: string;
  chalkiness: 'None' | '< 2%' | '< 5%' | string;
  texture: 'Fluffy & Separate' | 'Soft & Clumping' | 'Firm & Chewy' | string;
  shaderParams: {
    baseColor: string;
    subsurfaceColor: string;
    roughness: number;
    transmission: number;
    ior: number;
    translucencyDepth: number;
  };
  packagingDetails: {
    accentColor: string;
    badgeText: string;
  };
}

export const RICE_VARIETIES: RiceVariety[] = [
  {
    id: '1121-basmati',
    name: '1121 Basmati',
    category: 'Extra Long',
    origin: 'Haryana / Punjab Belt',
    lengthMm: 8.35,
    elongationRatio: 2.2,
    moisturePercent: 11.5,
    purityPercent: 99.2,
    aromaProfile: 'Aged 2-acetyl-1-pyrroline intense floral nutty',
    chalkiness: 'None',
    texture: 'Fluffy & Separate',
    shaderParams: {
      baseColor: '#FDFBF7',
      subsurfaceColor: '#F4ECD8',
      roughness: 0.28,
      transmission: 0.35,
      ior: 1.46,
      translucencyDepth: 1.2
    },
    packagingDetails: {
      accentColor: '#D4AF37',
      badgeText: 'Aged 2 Years'
    }
  },
  {
    id: 'sona-masoori',
    name: 'Sona Masoori',
    category: 'Medium',
    origin: 'Andhra Pradesh / Karnataka (Tungabhadra)',
    lengthMm: 5.2,
    elongationRatio: 1.5,
    moisturePercent: 12.0,
    purityPercent: 98.5,
    aromaProfile: 'Delicate, sweet herbal aroma',
    chalkiness: '< 2%',
    texture: 'Light, soft, easy to digest',
    shaderParams: {
      baseColor: '#F7F5EE',
      subsurfaceColor: '#ECE7D5',
      roughness: 0.38,
      transmission: 0.22,
      ior: 1.44,
      translucencyDepth: 0.8
    },
    packagingDetails: {
      accentColor: '#4A6B53',
      badgeText: 'Low Starch'
    }
  },
  {
    id: 'jasmine-hom-mali',
    name: 'Jasmine Hom Mali',
    category: 'Long',
    origin: 'Plateau Wetland Highlands',
    lengthMm: 7.1,
    elongationRatio: 1.8,
    moisturePercent: 12.2,
    purityPercent: 98.8,
    aromaProfile: 'Pandan leaf & fresh sweet floral',
    chalkiness: '< 2%',
    texture: 'Soft, tender, slightly clingy',
    shaderParams: {
      baseColor: '#FCFAF4',
      subsurfaceColor: '#EFEADE',
      roughness: 0.22,
      transmission: 0.42,
      ior: 1.47,
      translucencyDepth: 1.4
    },
    packagingDetails: {
      accentColor: '#C49A45',
      badgeText: 'Prime Harvest'
    }
  },
  {
    id: 'hmt-kolam',
    name: 'HMT Kolam',
    category: 'Short',
    origin: 'Maharashtra Valley',
    lengthMm: 4.8,
    elongationRatio: 1.4,
    moisturePercent: 12.5,
    purityPercent: 98.0,
    aromaProfile: 'Mild buttery cereal fragrance',
    chalkiness: '< 5%',
    texture: 'Silky, tender grain',
    shaderParams: {
      baseColor: '#FAF7EE',
      subsurfaceColor: '#EDE5CB',
      roughness: 0.42,
      transmission: 0.18,
      ior: 1.43,
      translucencyDepth: 0.6
    },
    packagingDetails: {
      accentColor: '#8C6D46',
      badgeText: 'Daily Gourmet'
    }
  },
  {
    id: 'ir64-parboiled',
    name: 'IR-64 Parboiled',
    category: 'Long',
    origin: 'Chhattisgarh Plains',
    lengthMm: 6.2,
    elongationRatio: 1.6,
    moisturePercent: 11.8,
    purityPercent: 99.0,
    aromaProfile: 'Neutral, clean, mineral rice essence',
    chalkiness: 'None',
    texture: 'Firm, highly durable grain',
    shaderParams: {
      baseColor: '#F5EED6',
      subsurfaceColor: '#DFCFA0',
      roughness: 0.25,
      transmission: 0.45,
      ior: 1.48,
      translucencyDepth: 1.8
    },
    packagingDetails: {
      accentColor: '#344A39',
      badgeText: 'Commercial Grade'
    }
  },
  {
    id: 'gobindobhog',
    name: 'Gobindobhog',
    category: 'Short',
    origin: 'West Bengal Heritage Belt',
    lengthMm: 4.1,
    elongationRatio: 1.3,
    moisturePercent: 12.8,
    purityPercent: 99.4,
    aromaProfile: 'Warm pure clarified butter & vanilla note',
    chalkiness: '< 5%',
    texture: 'Buttery, rich, melt-in-mouth',
    shaderParams: {
      baseColor: '#FFFDF5',
      subsurfaceColor: '#F2E8CE',
      roughness: 0.35,
      transmission: 0.25,
      ior: 1.45,
      translucencyDepth: 0.9
    },
    packagingDetails: {
      accentColor: '#BFA15F',
      badgeText: 'Heritage GI Tag'
    }
  }
];
