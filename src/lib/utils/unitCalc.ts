import type { UnitInfo } from '$lib/types';

/**
 * Calculate which bi-daily unit a date belongs to
 * Unit 1: Sunday + Monday
 * Unit 2: Tuesday + Wednesday
 * Unit 3: Thursday + Friday
 * Saturday: Review day
 */
export function getUnitForDate(date: Date): UnitInfo {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Clone date to avoid mutation
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (dayOfWeek === 6) {
    // Saturday - Review day
    return {
      unitNumber: 0,
      startDate: d,
      endDate: d,
      isReviewDay: true,
      label: '周复盘'
    };
  }

  let unitNumber: number;
  let startDate: Date;
  let endDate: Date;

  if (dayOfWeek === 0 || dayOfWeek === 1) {
    // Sunday (0) or Monday (1) -> Unit 1
    unitNumber = 1;
    startDate = new Date(d);
    startDate.setDate(d.getDate() - (dayOfWeek === 0 ? 0 : 1));
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
  } else if (dayOfWeek === 2 || dayOfWeek === 3) {
    // Tuesday (2) or Wednesday (3) -> Unit 2
    unitNumber = 2;
    startDate = new Date(d);
    startDate.setDate(d.getDate() - (dayOfWeek === 2 ? 0 : 1));
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
  } else {
    // Thursday (4) or Friday (5) -> Unit 3
    unitNumber = 3;
    startDate = new Date(d);
    startDate.setDate(d.getDate() - (dayOfWeek === 4 ? 0 : 1));
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
  }

  return {
    unitNumber,
    startDate,
    endDate,
    isReviewDay: false,
    label: `Unit ${unitNumber}: ${formatDateShort(startDate)}-${formatDateShort(endDate)}`
  };
}

/**
 * Get the current unit
 */
export function getCurrentUnit(): UnitInfo {
  return getUnitForDate(new Date());
}

/**
 * Get the unit start date as ISO string
 */
export function getUnitStartString(date: Date = new Date()): string {
  const unit = getUnitForDate(date);
  return unit.startDate.toISOString().split('T')[0];
}

/**
 * Navigate to adjacent unit
 */
export function navigateUnit(currentUnit: UnitInfo, direction: 'prev' | 'next'): UnitInfo {
  const offset = direction === 'next' ? 2 : -2;
  const newDate = new Date(currentUnit.startDate);

  if (currentUnit.isReviewDay) {
    // From Saturday, go to Friday (prev) or Sunday (next)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
  } else {
    newDate.setDate(newDate.getDate() + offset);
  }

  return getUnitForDate(newDate);
}

/**
 * Get all units in a week
 */
export function getWeekUnits(weekStart: Date): UnitInfo[] {
  const units: UnitInfo[] = [];
  const d = new Date(weekStart);

  // Find Sunday of this week
  d.setDate(d.getDate() - d.getDay());

  // Unit 1 (Sun-Mon)
  units.push(getUnitForDate(d));

  // Unit 2 (Tue-Wed)
  d.setDate(d.getDate() + 2);
  units.push(getUnitForDate(d));

  // Unit 3 (Thu-Fri)
  d.setDate(d.getDate() + 2);
  units.push(getUnitForDate(d));

  // Review day (Sat)
  d.setDate(d.getDate() + 2);
  units.push(getUnitForDate(d));

  return units;
}

/**
 * Check if a date is within a unit
 */
export function isDateInUnit(date: Date, unit: UnitInfo): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (unit.isReviewDay) {
    return d.getTime() === unit.startDate.getTime();
  }

  return d >= unit.startDate && d <= unit.endDate;
}

/**
 * Format date as MM/DD
 */
export function formatDateShort(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse ISO date string to Date
 */
export function parseISODate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Get relative day label with friendly text
 * Uses soft/friendly labels like "tomorrow", "day after tomorrow", "this week"
 */
export function getRelativeDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Past dates
  if (diffDays < 0) {
    if (diffDays === -1) return '昨天';
    if (diffDays === -2) return '前天';
    if (diffDays >= -7) return `${Math.abs(diffDays)}天前`;
    return formatDateShort(date);
  }

  // Future dates - use friendly labels
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === 2) return '后天';

  // Within current cycle (2 days) - very subtle
  // Days 3-7: show "this week" style
  if (diffDays <= 7) {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayOfWeek = target.getDay();
    return `本${dayNames[dayOfWeek]}`;
  }

  // Next week
  if (diffDays <= 14) {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dayOfWeek = target.getDay();
    return `下${dayNames[dayOfWeek]}`;
  }

  // Beyond 2 weeks - show date
  return formatDateShort(date);
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISODate(date) : date;
  const today = new Date();

  return d.getFullYear() === today.getFullYear() &&
         d.getMonth() === today.getMonth() &&
         d.getDate() === today.getDate();
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;

  const date = parseISODate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
}

/**
 * Check if a date is within this week
 */
export function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;

  const date = parseISODate(dateStr);
  const today = new Date();

  // Get Sunday of this week
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);

  // Get Saturday of this week
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return date >= sunday && date <= saturday;
}
