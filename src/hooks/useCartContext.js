/**
 * Custom hook untuk CartDrawer
 * Hanya menselect values yang diperlukan
 * Mengurangi re-render saat context lain berubah
 */
import { useAppContext } from '../context/AppContext';
import { useMemo } from 'react';

export const useCartContext = () => {
  const context = useAppContext();
  
  // Selektif ambil hanya yang diperlukan CartDrawer
  return useMemo(() => ({
    // Cart management
    isCartOpen: context.isCartOpen,
    setIsCartOpen: context.setIsCartOpen,
    cart: context.cart,
    setCart: context.setCart,
    
    // Customer
    activeCustomer: context.activeCustomer,
    customerName: context.customerName,
    setCustomerName: context.setCustomerName,
    customers: context.customers,
    setCustomers: context.setCustomers,
    
    // Order type & delivery
    orderType: context.orderType,
    setOrderType: context.setOrderType,
    deliveryFee: context.deliveryFee,
    setDeliveryFee: context.setDeliveryFee,
    customDeliveryFee: context.customDeliveryFee,
    setCustomDeliveryFee: context.setCustomDeliveryFee,
    
    // Cart operations
    updateCartQty: context.updateCartQty,
    updateCartItemNote: context.updateCartItemNote,
    
    // Vouchers & discounts
    voucherInputCode: context.voucherInputCode,
    setVoucherInputCode: context.setVoucherInputCode,
    vouchers: context.vouchers,
    appliedVoucher: context.appliedVoucher,
    setAppliedVoucher: context.setAppliedVoucher,
    
    // Points
    pointsToRedeem: context.pointsToRedeem,
    setPointsToRedeem: context.setPointsToRedeem,
    
    // Manual discount
    manualDiscount: context.manualDiscount,
    setManualDiscount: context.setManualDiscount,
    
    // Calculations (memoized functions)
    getSubtotal: context.getSubtotal,
    getDiscount: context.getDiscount,
    getTaxAmount: context.getTaxAmount,
    getServiceChargeAmount: context.getServiceChargeAmount,
    getTotal: context.getTotal,
    getPointDiscount: context.getPointDiscount,
    getManualDiscountAmount: context.getManualDiscountAmount,
    
    // Settings & utilities
    storeSettings: context.storeSettings,
    formatRupiah: context.formatRupiah,
    
    // Dialogs & callbacks
    savedBills: context.savedBills,
    triggerConfirm: context.triggerConfirm,
    triggerAlert: context.triggerAlert,
    handleOpenBill: context.handleOpenBill,
    setPaymentModal: context.setPaymentModal,
    loadSavedBill: context.loadSavedBill,
    setCurrentView: context.setCurrentView,
  }), [context]);
};
