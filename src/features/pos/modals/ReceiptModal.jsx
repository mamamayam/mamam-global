import React from "react";
import { useAppContext } from "../../../context/AppContext";
import { Printer, Share2 } from "lucide-react";
import { isNativePlatform, printNativeBluetooth } from '../../../library/printer.js';
import { toPng, toBlob } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const ReceiptModal = () => {
    const { receiptModal, setReceiptModal, storeSettings, formatRupiah, printReceipt } = useAppContext();
    if (!receiptModal.isOpen || !receiptModal.data) return null;
    const { data, kembalian } = receiptModal;

    const handleShareImage = async () => {
        const receiptElement = document.getElementById('receipt-content');
        if (!receiptElement) {
            alert('Error: Elemen HTML struk tidak ditemukan.');
            return;
        }

        try {
            if (Capacitor.isNativePlatform()) {
                const dataUrl = await toPng(receiptElement, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 3,
                    skipAutoScale: true,
                    style: { width: '300px' }
                });

                const base64Data = dataUrl.split(',')[1];
                const fileName = `struk-${data.id}-${Date.now()}.png`;

                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache
                });

                await Share.share({
                    title: 'Struk Pesanan',
                    text: `Terima kasih! Berikut adalah struk pesanan Anda (ID: ${data.id})`,
                    url: savedFile.uri,
                    dialogTitle: 'Bagikan Struk via'
                });
            } else {
                const blob = await toBlob(receiptElement, {
                    backgroundColor: '#ffffff',
                    pixelRatio: 2,
                    skipAutoScale: true,
                    style: { width: '300px' }
                });

                if (!blob) return;
                const file = new File([blob], `struk-${data.id}.png`, { type: 'image/png' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `struk-${data.id}.png`;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Log Error Asli:', error);
            if (error.name !== 'AbortError') alert(`GAGAL SHARE!\n\nPesan Error: ${error.message || JSON.stringify(error)}`);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto py-10 transition-opacity duration-300 print:bg-white print:p-0">
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-wrapper, #receipt-wrapper * { visibility: visible; }
          #receipt-wrapper { position: absolute; left: 0; top: 0; width: ${storeSettings.paperSize === '80mm' ? '80mm' : '58mm'}; margin: 0; padding: 0; box-shadow: none; }
          .no-print { display: none !important; }
          @page { margin: 0; }
        }
      `}} />

            <div id="receipt-wrapper" className="bg-white rounded-xl w-full max-w-[300px] shadow-2xl relative font-mono text-sm animate-in zoom-in-95 duration-300 ease-out flex flex-col shrink-0 print:shadow-none print:w-[58mm] print:rounded-none">

                {/* --- KONTEN STRUK ALA ALFAMART --- */}
                <div id="receipt-content" className="w-[300px] bg-white p-4 font-mono text-[11px] leading-tight text-black mx-auto">
                    
                    {/* Header */}
                    <div className="text-center mb-3">
                        <div className="font-bold text-lg uppercase tracking-wide">
                            {storeSettings?.storeName || "Mamam Ayam"}
                        </div>
                        {storeSettings?.storeAddress && <div className="text-[10px] mt-1">{storeSettings.storeAddress}</div>}
                        {storeSettings?.storePhone && <div className="text-[10px]">WA: {storeSettings.storePhone}</div>}
                    </div>

                    <div className="border-b border-dashed border-gray-500 mb-2"></div>

                    {/* Info Transaksi */}
                    <div className="flex justify-between mb-1">
                        <span>{new Date(data.date).toLocaleString("id-ID", { dateStyle: 'short', timeStyle: 'short' }).replace(',', '')}</span>
                        <span>Kasir: Admin</span>
                    </div>
                    <div className="flex justify-between mb-1">
                        <span>No: {data.id}</span>
                        <span>{data.orderType}</span>
                    </div>
                    {data.customerName && (
                        <div className="flex justify-between mb-1">
                            <span>Pelanggan:</span>
                            <span>{data.customerName}</span>
                        </div>
                    )}

                    <div className="border-b border-dashed border-gray-500 my-2"></div>

                    {/* Daftar Item */}
                    <div className="mb-2">
                        {data.items.map((item, idx) => (
                            <div key={idx} className="mb-2">
                                <div className="font-bold">{item.name}</div>
                                {item.variantName && <div className="pl-2 text-[10px] text-gray-700">- {item.variantName}</div>}
                                {item.note && <div className="pl-2 text-[10px] text-gray-700">* {item.note}</div>}
                                <div className="flex justify-between pl-2 mt-0.5">
                                    <span>{item.qty} x {formatRupiah(item.price)}</span>
                                    <span>{formatRupiah(item.price * item.qty)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-b border-dashed border-gray-500 my-2"></div>

                    {/* Perhitungan Total */}
                    <div className="flex flex-col gap-1 mb-2">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatRupiah(data.subtotal)}</span>
                        </div>
                        {data.discount > 0 && (
                            <div className="flex justify-between">
                                <span>Diskon Vcr</span>
                                <span>-{formatRupiah(data.discount)}</span>
                            </div>
                        )}
                        {data.pointDiscount > 0 && (
                            <div className="flex justify-between">
                                <span>Potong Poin</span>
                                <span>-{formatRupiah(data.pointDiscount)}</span>
                            </div>
                        )}
                        {data.manualDiscountAmount > 0 && (
                            <div className="flex justify-between">
                                <span>Diskon Man</span>
                                <span>-{formatRupiah(data.manualDiscountAmount)}</span>
                            </div>
                        )}
                        {data.taxAmount > 0 && (
                            <div className="flex justify-between">
                                <span>Pajak</span>
                                <span>{formatRupiah(data.taxAmount)}</span>
                            </div>
                        )}
                        {data.serviceAmount > 0 && (
                            <div className="flex justify-between">
                                <span>Service</span>
                                <span>{formatRupiah(data.serviceAmount)}</span>
                            </div>
                        )}
                        {data.deliveryFee > 0 && (
                            <div className="flex justify-between">
                                <span>Ongkir</span>
                                <span>{formatRupiah(data.deliveryFee)}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-b border-dashed border-gray-500 my-2"></div>

                    {/* Pembayaran */}
                    <div className="flex flex-col gap-1 mb-3">
                        <div className="flex justify-between font-bold text-[13px]">
                            <span>TOTAL</span>
                            <span>{formatRupiah(data.total)}</span>
                        </div>

                        {data.paymentMethod === "Split Payment" ? (
                            data.splitDetails.map((p, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>Bayar ({p.method})</span>
                                    <span>{formatRupiah(p.amount)}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex justify-between">
                                <span>Bayar ({data.paymentMethod})</span>
                                <span>{formatRupiah(data.total + (kembalian || 0))}</span>
                            </div>
                        )}

                        {kembalian > 0 && (
                            <div className="flex justify-between">
                                <span>Kembalian</span>
                                <span>{formatRupiah(kembalian)}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-b border-dashed border-gray-500 mb-3"></div>

                    {/* Footer */}
                    <div className="text-center text-[10px]">
                        <div className="font-bold">{storeSettings?.receiptFooter || "Terima Kasih"}</div>
                    </div>
                </div>

                {/* --- AREA TOMBOL --- */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-xl flex flex-col gap-2 no-print">
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                if (isNativePlatform()) {
                                    await printNativeBluetooth(data, storeSettings, kembalian);
                                } else {
                                    printReceipt();
                                }
                            }}
                            className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold shadow-sm hover:bg-slate-900 text-sm flex justify-center items-center gap-2 transition-colors"
                        >
                            <Printer className="w-4 h-4" /> Cetak
                        </button>
                        <button onClick={handleShareImage} className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold shadow-sm hover:bg-green-700 text-sm flex justify-center items-center gap-2 transition-colors">
                            <Share2 className="w-4 h-4" /> Bagikan
                        </button>
                    </div>
                    <button onClick={() => setReceiptModal({ isOpen: false, data: null })} className="w-full py-3 rounded-lg bg-white text-slate-800 font-bold shadow-sm hover:bg-slate-100 text-sm transition-colors border border-slate-200">
                        Tutup Selesai
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;