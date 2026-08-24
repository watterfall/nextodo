import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUnitForDate,
  getCurrentUnit,
  currentUnitStartLocal,
  navigateUnit,
  getWeekUnits,
  isSameUnit,
  isDateInUnit,
  getFlexibleDueDateStatus,
  formatDateShort,
  parseISODate,
  isToday,
  isOverdue,
  isThisWeek,
} from './unitCalc';

// Reference calendar (all local, TZ pinned to UTC in vitest.config):
//   2026-01-04 Sun   2026-01-05 Mon  -> Unit 1
//   2026-01-06 Tue   2026-01-07 Wed  -> Unit 2
//   2026-01-08 Thu   2026-01-09 Fri  -> Unit 3
//   2026-01-10 Sat                   -> Review day
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 4, 12, 0, 0)); // Sunday noon
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getUnitForDate', () => {
  it('maps Sunday and Monday to Unit 1 sharing a start date', () => {
    const sun = getUnitForDate(new Date(2026, 0, 4));
    const mon = getUnitForDate(new Date(2026, 0, 5));
    expect(sun.unitNumber).toBe(1);
    expect(sun.isReviewDay).toBe(false);
    expect(mon.unitNumber).toBe(1);
    expect(mon.startDate.getTime()).toBe(sun.startDate.getTime());
  });

  it('maps Tuesday/Wednesday to Unit 2 and Thursday/Friday to Unit 3', () => {
    expect(getUnitForDate(new Date(2026, 0, 6)).unitNumber).toBe(2);
    expect(getUnitForDate(new Date(2026, 0, 7)).unitNumber).toBe(2);
    expect(getUnitForDate(new Date(2026, 0, 8)).unitNumber).toBe(3);
    expect(getUnitForDate(new Date(2026, 0, 9)).unitNumber).toBe(3);
  });

  it('flags Saturday as the review day (unit 0)', () => {
    const sat = getUnitForDate(new Date(2026, 0, 10));
    expect(sat.isReviewDay).toBe(true);
    expect(sat.unitNumber).toBe(0);
  });
});

describe('getCurrentUnit / currentUnitStartLocal', () => {
  it('uses the mocked now for the current unit', () => {
    expect(getCurrentUnit().unitNumber).toBe(1);
  });

  it('returns the local YYYY-MM-DD start of the unit', () => {
    expect(currentUnitStartLocal(new Date(2026, 0, 5))).toBe('2026-01-04'); // Mon → Unit 1 start Sun
    expect(currentUnitStartLocal(new Date(2026, 0, 6))).toBe('2026-01-06'); // Tue → Unit 2 start
  });
});

describe('navigateUnit', () => {
  it('steps between adjacent work units', () => {
    const u1 = getUnitForDate(new Date(2026, 0, 4));
    expect(navigateUnit(u1, 'next').unitNumber).toBe(2);
    // Backwards from Unit 1 is the prior week's Saturday review, not Unit 3 —
    // a fixed -2 step used to jump over it, making past reviews unreachable.
    expect(navigateUnit(u1, 'prev').isReviewDay).toBe(true);
  });

  it('steps on and off the review day', () => {
    const sat = getUnitForDate(new Date(2026, 0, 10));
    expect(navigateUnit(sat, 'next').unitNumber).toBe(1); // next Sunday
    expect(navigateUnit(sat, 'prev').unitNumber).toBe(3); // previous Thu-Fri
  });

  it('prev and next are exact inverses across the whole week', () => {
    for (const day of [4, 5, 6, 7, 8, 9, 10]) {
      const unit = getUnitForDate(new Date(2026, 0, day));
      const roundTrip = navigateUnit(navigateUnit(unit, 'next'), 'prev');
      expect(roundTrip.startDate.getTime()).toBe(unit.startDate.getTime());
    }
  });
});

describe('getWeekUnits', () => {
  it('returns the three work units plus the review day', () => {
    const units = getWeekUnits(new Date(2026, 0, 7)); // any day of the week
    expect(units).toHaveLength(4);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 0]);
    expect(units[3].isReviewDay).toBe(true);
  });
});

describe('isSameUnit / isDateInUnit', () => {
  it('groups the two days of a work unit together', () => {
    expect(isSameUnit(new Date(2026, 0, 4), new Date(2026, 0, 5))).toBe(true);
    expect(isSameUnit(new Date(2026, 0, 4), new Date(2026, 0, 6))).toBe(false);
  });

  it('checks membership within a work unit', () => {
    const u1 = getUnitForDate(new Date(2026, 0, 4));
    expect(isDateInUnit(new Date(2026, 0, 5), u1)).toBe(true);
    expect(isDateInUnit(new Date(2026, 0, 6), u1)).toBe(false);
  });

  it('checks membership on a review day (exact date only)', () => {
    const sat = getUnitForDate(new Date(2026, 0, 10));
    expect(isDateInUnit(new Date(2026, 0, 10), sat)).toBe(true);
    expect(isDateInUnit(new Date(2026, 0, 9), sat)).toBe(false);
  });
});

describe('date helpers', () => {
  it('formatDateShort renders MM/DD', () => {
    expect(formatDateShort(new Date(2026, 0, 4))).toBe('01/04');
    expect(formatDateShort(new Date(2026, 11, 25))).toBe('12/25');
  });

  it('parseISODate builds a local date at midnight', () => {
    const d = parseISODate('2026-03-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });

  it('isToday compares against the mocked now', () => {
    expect(isToday(new Date(2026, 0, 4))).toBe(true);
    expect(isToday('2026-01-04')).toBe(true);
    expect(isToday(new Date(2026, 0, 5))).toBe(false);
  });

  it('isOverdue flags strictly-past dates only', () => {
    expect(isOverdue('2026-01-03')).toBe(true);
    expect(isOverdue('2026-01-04')).toBe(false);
    expect(isOverdue('2026-01-10')).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });

  it('isThisWeek spans Sunday..Saturday of the current week', () => {
    expect(isThisWeek('2026-01-07')).toBe(true);
    expect(isThisWeek('2026-01-11')).toBe(false);
    expect(isThisWeek(null)).toBe(false);
  });
});

describe('getFlexibleDueDateStatus', () => {
  it('classifies statuses across the 12h flex window', () => {
    vi.setSystemTime(new Date(2026, 0, 4, 6, 0, 0)); // Jan 4, 06:00
    expect(getFlexibleDueDateStatus(null).status).toBe('ok');
    expect(getFlexibleDueDateStatus(null).hoursRemaining).toBe(Infinity);
    expect(getFlexibleDueDateStatus('2026-01-20').status).toBe('ok');
    expect(getFlexibleDueDateStatus('2026-01-03').status).toBe('flexible'); // ~6h past deadline
    expect(getFlexibleDueDateStatus('2026-01-01').status).toBe('overdue'); // well past flex
  });

  it('marks a deadline within flex hours as approaching', () => {
    vi.setSystemTime(new Date(2026, 0, 4, 18, 0, 0)); // ~6h before end of today
    expect(getFlexibleDueDateStatus('2026-01-04').status).toBe('approaching');
  });
});
