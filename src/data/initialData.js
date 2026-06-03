export const INITIAL_VARIANT_GROUPS = [
    {
        id: 'vg1', name: 'Pilihan Suhu', isRequired: true, maxSelection: 1,
        options: [{ id: 'opt1', name: 'Dingin (Es)', extraPrice: 2000 }, { id: 'opt2', name: 'Panas', extraPrice: 0 }]
    },
    {
        id: 'vg2', name: 'Level Pedas', isRequired: false, maxSelection: 1,
        options: [{ id: 'opt3', name: 'Sedang', extraPrice: 0 }, { id: 'opt4', name: 'Mampus', extraPrice: 3000 }]
    },
    {
        id: 'vg3', name: 'Topping Tambahan', isRequired: false, maxSelection: 2,
        options: [{ id: 'opt5', name: 'Keju Mozarella', extraPrice: 5000 }, { id: 'opt6', name: 'Sosis', extraPrice: 4000 }, { id: 'opt7', name: 'Telur', extraPrice: 3000 }]
    }
];

export const INITIAL_MENUS = [
    { id: 'm1', name: 'Ayam Geprek Mamam', price: 20000, hpp: 14000, category: 'Makanan', variantGroupIds: ['vg2', 'vg3'] },
    { id: 'm2', name: 'Kopi Susu Gula Aren', price: 18000, hpp: 8000, category: 'Minuman', variantGroupIds: ['vg1'] },
    { id: 'm3', name: 'Nasi Goreng Spesial', price: 25000, hpp: 16000, category: 'Makanan', variantGroupIds: ['vg2', 'vg3'] },
    { id: 'm4', name: 'Kentang Goreng', price: 15000, hpp: 7000, category: 'Cemilan', variantGroupIds: ['vg3'] },
    { id: 'm5', name: 'Es Teh Manis', price: 5000, hpp: 2000, category: 'Minuman', variantGroupIds: [] },
];

export const INITIAL_RAW_MATERIALS = [
  { id: 'rm1', name: 'Ayam Potong', unit: 'Ekor', price: 35000, lastUpdated: new Date() },
  { id: 'rm2', name: 'Beras Premium', unit: 'Kg', price: 16000, lastUpdated: new Date() },
  { id: 'rm3', name: 'Minyak Goreng', unit: 'Liter', price: 18000, lastUpdated: new Date() },
  { id: 'rm4', name: 'Gula Aren', unit: 'Kg', price: 22000, lastUpdated: new Date() },
  { id: 'rm5', name: 'Kopi Susu Blend', unit: 'Gram', price: 150, lastUpdated: new Date() },
];

export const INITIAL_CATEGORIES = ['Makanan', 'Minuman', 'Cemilan', 'Lainnya'];