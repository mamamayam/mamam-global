import { createContext, useContext, useState } from 'react';

// 1. Inisialisasi Context
export const AppContext = createContext();

// 2. Buat Provider Component untuk membungkus aplikasi
export const AppProvider = ({ children }) => {

    const [currentView, setCurrentView] = useState('pos');
    const [isAdminMode, setIsAdminMode] = useState(false);
    
    // State Pengaturan Toko
    const [storeSettings, setStoreSettings] = useState({
        taxRate: 10,
        serviceCharge: 0,
        autoPrint: false,
        paperSize: '58mm',
    });

    // State untuk data pelanggan dan voucher (agar CustomerView.jsx tidak error)
    const [customers, setCustomers] = useState([]);
    const [vouchers, setVouchers] = useState([]);
    const [claimsHistory, setClaimsHistory] = useState([]);

    // Fungsi Alert global
    const triggerAlert = (message) => {
        alert(message);
    };

    return (
        <AppContext.Provider
            value={{
                isAdminMode,
                setIsAdminMode,
                storeSettings,
                setStoreSettings,
                customers,
                setCustomers,
                vouchers,
                setVouchers,
                claimsHistory,
                setClaimsHistory,
                triggerAlert,
                currentView, setCurrentView
            }}>
            {children}
        </AppContext.Provider>
    );
};

// 3. Custom Hook untuk mempermudah pemanggilan context
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext harus digunakan di dalam AppProvider');
    }
    return context;
};