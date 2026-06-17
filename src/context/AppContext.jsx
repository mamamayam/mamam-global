import { createContext, useContext, useState } from 'react';
import { INITIAL_VARIANT_GROUPS } from '../data/initialData';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [variantCategories, setVariantCategories] = useState(INITIAL_VARIANT_GROUPS || []); 
    return (
        <AppContext.Provider value={{ 
            isAdminMode, setIsAdminMode,
            variantCategories, setVariantCategories 
            }}>
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