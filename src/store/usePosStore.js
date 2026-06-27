import { create } from 'zustand';

export const usePosStore = create((set, get) => ({
  // ─── STATE PENCARIAN & KATEGORI ───
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  selectedCategory: 'Favorit',
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  // ─── STATE KERANJANG & UI MODAL ───

  addToCart: (newItem) => set((state) => {
    // Cek apakah item sudah ada di cart
    const existingItem = state.cart.find(item => item.cartItemId === newItem.cartItemId);
    
    if (existingItem) {
      // Jika ada, tambah quantity
      return {
        cart: state.cart.map(item => 
          item.cartItemId === newItem.cartItemId 
            ? { ...item, qty: item.qty + 1 } 
            : item
        )
      };
    }}),
    
  cart: [],
  setCart: (newCart) => set({ 
    cart: typeof newCart === 'function' ? newCart(get().cart) : newCart 
  }),
  
  isCartOpen: false,
  setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),

  // ─── STATE VARIAN ───
  selectedMenuForVariant: null,
  setSelectedMenuForVariant: (menu) => set({ selectedMenuForVariant: menu }),
  
  variantSelectedOptions: {},
  setVariantSelectedOptions: (options) => set((state) => ({ 
    variantSelectedOptions: typeof options === 'function' 
      ? options(state.variantSelectedOptions) 
      : options 
  })),
  
  editingCartItemId: null,
  setEditingCartItemId: (id) => set({ editingCartItemId: id })
}));