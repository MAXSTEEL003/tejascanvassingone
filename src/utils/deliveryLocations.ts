export interface DeliveryLocation {
  id: string;
  name: string;
  type: 'Shop' | 'Godown';
  address: string;
  contactPerson?: string;
  phone?: string;
  isDefault?: boolean;
  gstin?: string;
}

const STORAGE_KEY = 'merchant_delivery_locations';
const SELECTED_KEY = 'selected_delivery_location_id';

export function cleanLocationName(raw: string): string {
  if (!raw) return 'Main Shop';
  let s = raw.trim();
  // Strip email domains
  if (s.includes('@')) {
    s = s.replace(/@[^\s-]+/gi, '').trim();
    // If it was just an email prefix with 10 digits
    if (/^\d{10,}$/.test(s)) {
      s = `Shop (+91 ${s.slice(-10)})`;
    }
  }
  // Strip raw phone prefix if present
  s = s.replace(/^\d{10,}\s*-\s*/, '').trim();
  s = s.replace(/\s*-\s*Main Shop$/i, '').trim();
  if (!s || s.toLowerCase() === 'trade buyer' || s.toLowerCase() === 'merchant store') {
    return 'Main Shop';
  }
  if (!s.toLowerCase().includes('shop') && !s.toLowerCase().includes('godown') && !s.toLowerCase().includes('store') && !s.toLowerCase().includes('traders')) {
    return `${s} - Shop`;
  }
  return s;
}

export function getDefaultDeliveryLocations(): DeliveryLocation[] {
  const userAddress = localStorage.getItem('userAddress') || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022';
  const userPhone = localStorage.getItem('userPhone') || '9342380981';
  const rawName = localStorage.getItem('userName') || 'Trade Buyer';
  const userName = (rawName.includes('V.K') || rawName.includes('VK FOODS')) ? 'Trade Buyer' : rawName;
  const userGstin = localStorage.getItem('userGstin') || '29AAGCV7712M1ZP';

  const cleanedShopName = cleanLocationName(userName);

  return [
    {
      id: 'loc-primary-shop',
      name: cleanedShopName === 'Main Shop' ? 'Main Shop (APMC Yard)' : cleanedShopName,
      type: 'Shop',
      address: userAddress,
      phone: userPhone,
      gstin: userGstin,
      isDefault: true,
    },
    {
      id: 'loc-godown-1',
      name: 'APMC Yard Godown #4',
      type: 'Godown',
      address: 'Shed No. 4B, APMC Warehouse Complex, Yeshwanthpur, Bangalore - 560022',
      phone: userPhone,
      gstin: userGstin,
      isDefault: false,
    },
  ];
}

export function getDeliveryLocations(): DeliveryLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultDeliveryLocations();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let changed = false;
      const sanitized = parsed.map((loc: DeliveryLocation) => {
        const cleaned = cleanLocationName(loc.name);
        const resolvedName = (cleaned === 'Main Shop' && loc.type === 'Shop') ? 'Main Shop (APMC Yard)' : cleaned;
        if (resolvedName !== loc.name) {
          changed = true;
          return { ...loc, name: resolvedName };
        }
        return loc;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    const defaults = getDefaultDeliveryLocations();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch (err) {
    console.error('Failed to parse delivery locations', err);
    return getDefaultDeliveryLocations();
  }
}

export function saveDeliveryLocations(locations: DeliveryLocation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
    window.dispatchEvent(new CustomEvent('delivery_locations_updated', { detail: locations }));
  } catch (err) {
    console.error('Failed to save delivery locations', err);
  }
}

export function getSelectedDeliveryLocationId(): string {
  try {
    const selected = localStorage.getItem(SELECTED_KEY);
    if (selected) return selected;
    const locations = getDeliveryLocations();
    const def = locations.find(l => l.isDefault) || locations[0];
    if (def) {
      localStorage.setItem(SELECTED_KEY, def.id);
      return def.id;
    }
  } catch {
    // fallback
  }
  return 'loc-primary-shop';
}

export function setSelectedDeliveryLocationId(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id);
    window.dispatchEvent(new CustomEvent('selected_delivery_location_changed', { detail: id }));
  } catch (err) {
    console.error('Failed to save selected delivery location id', err);
  }
}

export function getSelectedDeliveryLocation(): DeliveryLocation {
  const locations = getDeliveryLocations();
  const selectedId = getSelectedDeliveryLocationId();
  const found = locations.find(l => l.id === selectedId);
  return found || locations[0] || getDefaultDeliveryLocations()[0];
}

export function addDeliveryLocation(newLoc: Omit<DeliveryLocation, 'id'>): DeliveryLocation {
  const locations = getDeliveryLocations();
  const created: DeliveryLocation = {
    ...newLoc,
    id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  };
  const updated = [...locations, created];
  saveDeliveryLocations(updated);
  return created;
}

export function removeDeliveryLocation(id: string): void {
  const locations = getDeliveryLocations();
  if (locations.length <= 1) return; // keep at least one
  const updated = locations.filter(l => l.id !== id);
  saveDeliveryLocations(updated);
  if (getSelectedDeliveryLocationId() === id) {
    setSelectedDeliveryLocationId(updated[0].id);
  }
}
