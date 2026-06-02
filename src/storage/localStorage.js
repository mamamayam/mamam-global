export const loadData = (key, defaultData) => {
  try {
    const item = localStorage.getItem(`mamam_kasir_${key}`);
    if (item) {
      const parsed = JSON.parse(item);
      if (['salesHistory', 'expenses', 'incomes', 'hppLibrary', 'savedBills', 'claimsHistory'].includes(key)) {
        return parsed.map(p => ({ ...p, date: new Date(p.date) }));
      }
      if (key === 'currentShift' && parsed) {
         return { ...parsed, startTime: new Date(parsed.startTime) };
      }
      if (key === 'shiftHistory') {
         return parsed.map(s => ({ ...s, startTime: new Date(s.startTime), endTime: new Date(s.endTime) }));
      }
      return parsed;
    }
  } catch (error) {
    console.error(`Error membaca ${key}:`, error);
  }
  return defaultData;
};

export const saveData = (key, data) => {
  localStorage.setItem(`mamam_kasir_${key}`, JSON.stringify(data));
};