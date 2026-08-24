import type { UnitInfo } from '$lib/types';

/**
 * Calculate which bi-daily unit a date belongs to.
 *
 *   Unit 1: Monday + Tuesday
 *   Unit 2: Wednesday + Thursday
 *   Unit 3: Friday + Saturday
 *   Sunday: review day
 *
 * The week therefore runs Monday-to-Sunday, so `getWeekUnits` and `isThisWeek`
 * anchor on Monday too — anchoring one of them on Sunday would put the review
 * day in a different week from the units it reviews.
 */
export function getUnitForDate(date: Date): UnitInfo {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

  // Clone date to avoid mutation
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (dayOfWeek === 0) {
    // Sunday — review day, a unit of one
    return {
      unitNumber: 0,
      startDate: d,
      endDate: d,
      isReviewDay: true
    };
  }

  // Mon/Tue -> 1, Wed/Thu -> 2, Fri/Sat -> 3; the second day of each pair steps
  // back one to reach its unit's start.
  const unitNumber = Math.ceil(dayOfWeek / 2);
  const startDate = new Date(d);
  startDate.setDate(d.getDate() - ((dayOfWeek - 1) % 2));
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 1);

  return {
    unitNumber,
    startDate,
    endDate,
    isReviewDay: false
  };
}

/**
 * Get the current unit
 */
export function getCurrentUnit(): UnitInfo {
  return getUnitForDate(new Date());
}

/**
 * Unit start as a LOCAL YYYY-MM-DD (uses local date parts, not toISOString, so it
 * doesn't shift a day across the UTC boundary). This is the canonical `unitStart`
 * value for tasks — they belong to the unit's start, not their creation day.
 */
export function currentUnitStartLocal(date: Date = new Date()): string {
  const d = getUnitForDate(date).startDate;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Navigate to adjacent unit
 */
export function navigateUnit(currentUnit: UnitInfo, direction: 'prev' | 'next'): UnitInfo {
  // Step to the day just outside this unit's boundary: one day before its start,
  // or one day after its end. That day always belongs to the adjacent unit, so
  // prev and next are exact inverses and neither skips Sunday's review day —
  // a fixed ±2 offset stepped over it going backwards, making past reviews
  // unreachable from the unit navigator.
  const newDate = new Date(direction === 'next' ? currentUnit.endDate : currentUnit.startDate);
  newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));

  return getUnitForDate(newDate);
}

/** Move a date back to the Monday that starts its week. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay() is Sunday-based; (day + 6) % 7 is how many days back Monday is,
  // which for Sunday is 6 — Sunday closes its week here, it does not open one.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Get all units in a week: three 2-day work units, then Sunday's review day.
 */
export function getWeekUnits(weekStart: Date): UnitInfo[] {
  const d = startOfWeek(weekStart);

  const units: UnitInfo[] = [];
  for (const offset of [0, 2, 4, 6]) {
    const day = new Date(d);
    day.setDate(d.getDate() + offset);
    units.push(getUnitForDate(day));
  }
  return units;
}

/**
 * Check if two dates fall in the same 2-day unit (by unit start date).
 * Sunday (review day) only matches another Sunday of the same date.
 */
export function isSameUnit(a: Date, b: Date): boolean {
  const ua = getUnitForDate(a);
  const ub = getUnitForDate(b);
  return ua.startDate.getTime() === ub.startDate.getTime();
}

/**
 * Whether a completion timestamp still belongs to the current active 2-day unit.
 * Completed tasks stay struck-through until the unit they were completed in ends;
 * once the current unit advances past it, the task is hidden.
 */
export function isCompletedInCurrentUnit(completedAtIso: string, now: Date = new Date()): boolean {
  return isSameUnit(new Date(completedAtIso), now);
}

/**
 * Remaining time until the end of the unit a completion belongs to (end of its
 * last day). Returns null once that unit has already ended.
 */
export function getUnitRetentionRemaining(completedAtIso: string): { hours: number; minutes: number } | null {
  const unit = getUnitForDate(new Date(completedAtIso));
  const end = new Date(unit.endDate);
  end.setHours(23, 59, 59, 999);
  const remainingMs = end.getTime() - Date.now();
  if (remainingMs <= 0) return null;
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return { hours, minutes };
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
 * Check if a date is within a unit with flexible boundaries
 * @param date - The date to check
 * @param unit - The unit to check against
 * @param flexHours - Hours of flexibility (extends unit end, allows early start)
 */
export function isDateInUnitFlexible(date: Date, unit: UnitInfo, flexHours: number = 12): boolean {
  const d = new Date(date);

  if (unit.isReviewDay) {
    // For review day, allow flex hours before and after
    const flexMs = flexHours * 60 * 60 * 1000;
    const flexStart = new Date(unit.startDate.getTime() - flexMs);
    const flexEnd = new Date(unit.startDate.getTime() + 24 * 60 * 60 * 1000 + flexMs);
    return d >= flexStart && d < flexEnd;
  }

  // Calculate flexible boundaries
  const flexMs = flexHours * 60 * 60 * 1000;

  // Extend end date by flex hours
  const flexibleEnd = new Date(unit.endDate);
  flexibleEnd.setHours(23, 59, 59, 999);
  flexibleEnd.setTime(flexibleEnd.getTime() + flexMs);

  // Allow start earlier by flex hours
  const flexibleStart = new Date(unit.startDate);
  flexibleStart.setTime(flexibleStart.getTime() - flexMs);

  return d >= flexibleStart && d <= flexibleEnd;
}

/**
 * Get a softened due date label with flexibility indicator
 * When a task is near the boundary (within flex hours), show a softer message
 */
export function getFlexibleDueDateStatus(dueDate: string | null, flexHours: number = 12): {
  status: 'ok' | 'approaching' | 'flexible' | 'overdue';
  hoursRemaining: number;
} {
  if (!dueDate) return { status: 'ok', hoursRemaining: Infinity };

  const due = parseISODate(dueDate);
  due.setHours(23, 59, 59, 999); // End of due date

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const hoursRemaining = diffMs / (60 * 60 * 1000);

  if (hoursRemaining < -flexHours) {
    // Truly overdue (past flexible boundary)
    return { status: 'overdue', hoursRemaining };
  } else if (hoursRemaining < 0) {
    // Within flexible extension period
    return { status: 'flexible', hoursRemaining };
  } else if (hoursRemaining < flexHours) {
    // Approaching deadline
    return { status: 'approaching', hoursRemaining };
  } else {
    return { status: 'ok', hoursRemaining };
  }
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
 * Format date as YYYY-MM-DD, using the local calendar date.
 *
 * Must NOT go through toISOString(): callers build Dates with local-midnight
 * constructors (see parseISODate), so a UTC conversion shifts the day backwards
 * for every zone east of UTC — which silently froze daily recurrences.
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse ISO date string to Date
 */
export function parseISODate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
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
 * Check if a date is within this week (Monday through Sunday).
 */
export function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;

  const date = parseISODate(dateStr);

  const monday = startOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return date >= monday && date <= sunday;
}
