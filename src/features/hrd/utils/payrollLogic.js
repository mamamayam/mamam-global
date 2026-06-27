export const WORK_START_MINUTES = 9 * 60;
export const WORK_END_MINUTES = 19 * 60;
export const EARLY_OVERTIME_THRESHOLD_MINUTES = WORK_START_MINUTES - 30;
export const OVERTIME_THRESHOLD_MINUTES = WORK_END_MINUTES + 30;
export const OVERTIME_RATE_PER_30MIN = 5000;

export const LEMBUR_CATEGORY_KEYWORD = 'lembur';
export const KASBON_CATEGORY_KEYWORD = 'kasbon';

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif', badgeVariant: 'success' },
  { value: 'freelance', label: 'Freelance', badgeVariant: 'info' },
  { value: 'cuti', label: 'Cuti', badgeVariant: 'warning' },
  { value: 'resign', label: 'Resign', badgeVariant: 'neutral' },
];

export function getEmployeeStatus(emp) {
  return emp?.status || 'aktif';
}

export function getEmployeeStatusInfo(status) {
  return EMPLOYEE_STATUS_OPTIONS.find(s => s.value === status) || EMPLOYEE_STATUS_OPTIONS[0];
}

export function calculateHoursFromTimes(clockInStr, clockOutStr) {
  const [inHours, inMinutes] = clockInStr.split(':').map(Number);
  const [outHours, outMinutes] = clockOutStr.split(':').map(Number);

  const totalInMinutes = (inHours * 60) + inMinutes;
  let totalOutMinutes = (outHours * 60) + outMinutes;

  if (totalOutMinutes < totalInMinutes) {
    totalOutMinutes += 24 * 60;
  }

  const diffMinutes = totalOutMinutes - totalInMinutes;
  return Number((diffMinutes / 60).toFixed(2));
}

export function formatTimeFromDate(isoStr) {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeStrToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
}

export function getClockOutMinutesContinuous(clockInStr, clockOutStr) {
  const inTotal = timeStrToMinutes(clockInStr);
  let outTotal = timeStrToMinutes(clockOutStr);
  if (outTotal < inTotal) outTotal += 24 * 60;
  return outTotal;
}

export function calculateBolongMinutes(sortedLogs, fallbackEndDate = null) {
  let totalMinutes = 0;
  for (let i = 0; i < sortedLogs.length; i++) {
    if (sortedLogs[i].type === 'bolong') {
      const nextLog = sortedLogs[i + 1];
      const gapEndDate = nextLog ? new Date(nextLog.date) : fallbackEndDate;
      if (!gapEndDate) continue; 
      const gapStart = new Date(sortedLogs[i].date).getTime();
      const gapEnd = gapEndDate.getTime();
      totalMinutes += Math.max(0, (gapEnd - gapStart) / 60000);
    }
  }
  return totalMinutes;
}