export const loadData = (key, defaultData) => {
  try {
    // Menggunakan satu prefix seragam untuk seluruh aplikasi
    const item = localStorage.getItem(`mamam_kasir_${key}`);
    
    if (item) {
      const parsed = JSON.parse(item);
      
      // Gabungan semua key dari HR dan Kasir yang butuh konversi field 'date'
      const dateKeys = [
        'expenses', 
        'employeeDailyRecords', 
        'salesHistory', 
        'savedBills', 
        'incomes', 
        'hppLibrary', 
        'claimsHistory'
      ];

      if (dateKeys.includes(key)) {
        return parsed.map(p => ({ ...p, date: new Date(p.date) }));
      }
      
      // Penanganan khusus untuk data Shift
      if (key === 'currentShift' && parsed) {
         return { ...parsed, startTime: new Date(parsed.startTime) };
      }
      
      if (key === 'shiftHistory') {
         return parsed.map(s => ({ 
           ...s, 
           startTime: new Date(s.startTime), 
           endTime: new Date(s.endTime) 
         }));
      }
      
      return parsed;
    }
  } catch (error) {
    console.error(`Error membaca ${key}:`, error);
  }
  return defaultData;
};

export const saveData = (key, data) => {
  // Pastikan prefix di sini sama dengan yang ada di loadData
  localStorage.setItem(`mamam_kasir_${key}`, JSON.stringify(data));
};