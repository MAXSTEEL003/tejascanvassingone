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

export function getDefaultDeliveryLocations(): DeliveryLocation[] {
  const userAddress = localStorage.getItem('userAddress') || 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022';
  const userPhone = localStorage.getItem('userPhone') || '';
  const userName = localStorage.getItem('userName') || 'Merchant Store';
  const userGstin = localStorage.getItem('userGstin') || '';

  return [
    {
      id: 'loc-primary-shop',
      name: `${userName} - Main Shop`,
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
      return parsed;
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
