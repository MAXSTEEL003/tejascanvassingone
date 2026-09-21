import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  image: string;
  supplier?: string;
  brand?: string;
  variety?: string;
  weight?: string | number;
  deliveryLocationId?: string;
  deliveryLocationName?: string;
  deliveryLocationAddress?: string;
  deliveryLocationType?: 'Shop' | 'Godown';
}

interface CartContextType {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem, openCart?: boolean) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  updateItemLocation: (id: string, locationId: string, meta?: { name?: string; address?: string; type?: 'Shop' | 'Godown' }) => void;
  updateAllLocations: (locationId: string, meta?: { name?: string; address?: string; type?: 'Shop' | 'Godown' }) => void;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('store_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('store_cart', JSON.stringify(items));
    } catch (e) {
      console.warn('Unable to write cart to localStorage:', e);
    }
  }, [items]);

  const total = items.reduce((acc, item) => acc + item.price * item.qty, 0);

  const addItem = (item: CartItem, openCart = false) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + item.qty } : i);
      }
      return [...prev, item];
    });
    if (openCart) {
      setIsOpen(true);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i).filter((i) => i.qty > 0));
  };

  const updateItemLocation = (id: string, locationId: string, meta?: { name?: string; address?: string; type?: 'Shop' | 'Godown' }) => {
    setItems((prev) => prev.map((i) => {
      if (i.id === id) {
        return {
          ...i,
          deliveryLocationId: locationId,
          deliveryLocationName: meta?.name || i.deliveryLocationName,
          deliveryLocationAddress: meta?.address || i.deliveryLocationAddress,
          deliveryLocationType: meta?.type || i.deliveryLocationType,
        };
      }
      return i;
    }));
  };

  const updateAllLocations = (locationId: string, meta?: { name?: string; address?: string; type?: 'Shop' | 'Godown' }) => {
    setItems((prev) => prev.map((i) => ({
      ...i,
      deliveryLocationId: locationId,
      deliveryLocationName: meta?.name || i.deliveryLocationName,
      deliveryLocationAddress: meta?.address || i.deliveryLocationAddress,
      deliveryLocationType: meta?.type || i.deliveryLocationType,
    })));
  };

  const clearCart = () => {
    setItems([]);
  };

  return (
    <CartContext.Provider value={{ 
      items, 
      total, 
      addItem, 
      removeItem, 
      updateQty, 
      updateItemLocation,
      updateAllLocations,
      clearCart, 
      isOpen, 
      setIsOpen 
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
