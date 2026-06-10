import React, { createContext, useContext, useState, useMemo } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  // Fungsi tambah item ke keranjang
  const addToCart = (item) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.id === item.id);
      if (existing) {
        return prevCart.map((i) => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  // Fungsi ubah jumlah (plus/minus)
  const updateQuantity = (id, amount) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + amount } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  // Bersihkan keranjang setelah bayar
  const clearCart = () => setCart([]);

  // Optimasi memory dengan useMemo
  const value = useMemo(() => ({
    cart,
    setCart, // Diexport buat jaga-jaga kalau ada komponen lama yang butuh setCart langsung
    addToCart,
    updateQuantity,
    clearCart
  }), [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Hook untuk dipakai di komponen lain (tinggal panggil const { cart } = useCart() )
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart harus dipakai di dalam CartProvider');
  return context;
}