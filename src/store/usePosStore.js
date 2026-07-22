import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Key localStorage — ganti versi (v2, v3, dst.) kalau mau wipe draft lama
const DRAFT_KEY = 'mamam-pos-draft-v1';

export const usePosStore = create(
  persist(
    (set, get) => ({

      // ─── UI STATE — tidak dipersist ────────────────────────────────────────
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      selectedCategory: 'Favorit',
      setSelectedCategory: (category) => set({ selectedCategory: category }),

      isCartOpen: false,
      setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),

      selectedMenuForVariant: null,
      setSelectedMenuForVariant: (menu) => set({ selectedMenuForVariant: menu }),

      variantSelectedOptions: {},
      setVariantSelectedOptions: (options) => set((state) => ({
        variantSelectedOptions: typeof options === 'function'
          ? options(state.variantSelectedOptions)
          : options,
      })),

      editingCartItemId: null,
      setEditingCartItemId: (id) => set({ editingCartItemId: id }),

      isCategoryModalOpen: false,
      setIsCategoryModalOpen: (isOpen) => set({ isCategoryModalOpen: isOpen }),

      // paymentModal: proses pembayaran aktif satu transaksi (bukan draft
      // jangka panjang) — sengaja gak dipersist, sama kayak searchQuery dkk
      // di atas. Kalau app ke-kill di tengah proses bayar, harusnya emang
      // reset bersih, bukan lanjut dari state payment yang nyangkut.
      // Pindah dari AppContext biar ketikan di amountPaid gak lagi
      // nge-trigger re-render context besar yang nyebar ke seluruh app
      // (root cause "semua layar kedap-kedip pas ngetik angka").
      paymentModal: {
        isOpen: false,
        isSplitMode: false,
        splitPayments: [],
        method: 'Tunai',
        amountPaid: '',
        status: 'pending',
        ojolName: '',
        orderNumber: '',
      },
      setPaymentModal: (update) => set((state) => ({
        paymentModal: typeof update === 'function' ? update(state.paymentModal) : update,
      })),


      // ─── DRAFT TRANSAKSI — dipersist ke localStorage ───────────────────────
      // Semua state di bawah ini survive app restart / batre habis / telepon masuk.

      cart: [],
      customerName: '',
      // Sumber kebenaran tunggal untuk atribusi poin — HANYA diisi lewat
      // CustomerPickerModal (pilih existing / tambah baru), gak pernah dari
      // ketikan bebas. null = guest/tanpa pelanggan terdaftar.
      selectedCustomerId: null,
      orderType: 'Takeaway',
      deliveryFee: 0,
      customDeliveryFee: '',
      // Khusus orderType 'Delivery': siapa yang antar, dan apakah customer
      // bayar cash langsung ke kurir (COD) atau sudah lunas di kasir.
      // 'kasir' = uang masuk laci kasir seperti biasa (default, gak ada
      // perubahan perilaku). 'kurir' = uang dipegang kurir, ditandai
      // cashHolder di record order-nya — lihat utils/cashHolders.js
      deliveryCourierId: '',
      deliveryPaidTo: 'kasir',
      manualDiscount: { type: 'fixed', value: 0 },
      pointsToRedeem: 0,


      // ─── CART ACTIONS ──────────────────────────────────────────────────────

      /**
       * addToCart(menu, variantSelectedOptions?, variantGroups?)
       * - Hitung cartItemId unik dari menuId + optionIds
       * - Kalau sudah ada → tambah qty
       * - Kalau baru → push item baru
       */
      addToCart: (menu, variantSelectedOptions = {}, variantGroups = []) => set((state) => {
        let extraPriceTotal = 0;
        const variantNames = [];
        const selectedVariantDetails = [];

        Object.entries(variantSelectedOptions).forEach(([groupId, optionIds]) => {
          const group = variantGroups.find(g => g.id === groupId);
          if (!group) return;
          optionIds.forEach(optId => {
            const opt = group.options.find(o => o.id === optId);
            if (!opt) return;
            extraPriceTotal += opt.extraPrice || 0;
            variantNames.push(opt.name);
            selectedVariantDetails.push({ optionId: opt.id });
          });
        });

        const optionKeys = selectedVariantDetails.map(v => v.optionId).sort().join('-');
        const cartItemId = optionKeys ? `${menu.id}-${optionKeys}` : menu.id;
        const variantName = variantNames.join(', ');

        const existingItem = state.cart.find(i => i.cartItemId === cartItemId);

        if (existingItem) {
          return {
            cart: state.cart.map(i =>
              i.cartItemId === cartItemId
                ? { ...i, qty: i.qty + 1 }
                : i
            ),
          };
        }

        const newItem = {
          menuId: menu.id,
          cartItemId,
          name: menu.name,
          price: (menu.price || 0) + extraPriceTotal,
          hpp: menu.hpp || 0,
          qty: 1,
          note: '',
          variantName,
          variantSelectedOptions,
          category: menu.category || '',
        };

        return { cart: [...state.cart, newItem] };
      }),

      /**
       * setCart — untuk reset, load saved bill, atau functional update
       * Mendukung: setCart([]) atau setCart(prev => [...prev])
       */
      setCart: (newCart) => set({
        cart: typeof newCart === 'function' ? newCart(get().cart) : newCart,
      }),


      // ─── DRAFT CHECKOUT ACTIONS ────────────────────────────────────────────

      setCustomerName: (name) => set({ customerName: name }),
      setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
      setOrderType: (type) => set({ orderType: type }),
      setDeliveryFee: (fee) => set({ deliveryFee: fee }),
      setCustomDeliveryFee: (fee) => set({ customDeliveryFee: fee }),
      setDeliveryCourierId: (id) => set({ deliveryCourierId: id }),
      setDeliveryPaidTo: (paidTo) => set({ deliveryPaidTo: paidTo }),
      setManualDiscount: (discount) => set({ manualDiscount: discount }),
      setPointsToRedeem: (points) => set({ pointsToRedeem: points }),

      /**
       * resetDraft — panggil setelah checkout berhasil atau saat mau wipe manual.
       * Ini yang menghapus data dari localStorage juga (karena state-nya di-reset).
       */
      resetDraft: () => set({
        cart: [],
        customerName: '',
        selectedCustomerId: null,
        orderType: 'Takeaway',
        deliveryFee: 0,
        customDeliveryFee: '',
        deliveryCourierId: '',
        deliveryPaidTo: 'kasir',
        manualDiscount: { type: 'fixed', value: 0 },
        pointsToRedeem: 0,
      }),

    }),

    {
      name: DRAFT_KEY,

      // Hanya state draft yang dipersist — UI state sengaja dikecualikan
      partialize: (state) => ({
        cart: state.cart,
        customerName: state.customerName,
        selectedCustomerId: state.selectedCustomerId,
        orderType: state.orderType,
        deliveryFee: state.deliveryFee,
        customDeliveryFee: state.customDeliveryFee,
        deliveryCourierId: state.deliveryCourierId,
        deliveryPaidTo: state.deliveryPaidTo,
        manualDiscount: state.manualDiscount,
        pointsToRedeem: state.pointsToRedeem,
      }),
    }
  )
);