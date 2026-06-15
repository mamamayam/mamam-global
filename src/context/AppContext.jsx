import { createContext, useContext, useState } from 'react';

// ⚠️ CATATAN ARSITEKTUR:
// AppContext di sini di-provide DUA KALI:
//   1. Di sini (lewat AppProvider, dibungkus di main.jsx) — provider LUAR.
//   2. Di app/App.jsx (lewat <AppContext.Provider value={contextValue}>) — provider DALAM.
//
// Provider DALAM (App.jsx) berisi SEMUA state bisnis yang sebenarnya
// (menus, salesHistory, customers, storeSettings, dst) dan menang untuk
// semua komponen di bawah App.jsx (React context "nearest provider wins").
//
// Provider LUAR ini HANYA dipakai untuk satu hal: `isAdminMode` /
// `setIsAdminMode`. App.jsx membaca state ini dari provider LUAR (karena
// App.jsx memanggil useAppContext() SEBELUM provider DALAM-nya sendiri ada),
// lalu meneruskannya ke provider DALAM — jadi semua komponen tetap
// mendapat nilai isAdminMode yang sama & konsisten.
//
// Jangan tambah state lain di sini — taruh di App.jsx, karena state di sini
// TIDAK akan terlihat oleh komponen manapun (akan ke-shadow oleh provider DALAM).

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [isAdminMode, setIsAdminMode] = useState(false);

    return (
        <AppContext.Provider value={{ isAdminMode, setIsAdminMode }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext harus digunakan di dalam AppProvider');
    }
    return context;
};