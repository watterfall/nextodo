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

// Reference calendar (all local; the suite runs in two zones, see vitest.config):
//   2026-01-04 Sun                   -> previous week's review day
//   2026-01-05 Mon   2026-01-06 Tue  -> Unit 1
//   2026-01-07 Wed   2026-01-08 Thu  -> Unit 2
//   2026-01-09 Fri   2026-01-10 Sat  -> Unit 3
//   2026-01-11 Sun                   -> Review day
//
// "Now" is parked mid-week rather than on a boundary so that the week-spanning
// helpers are exercised with days on both sides of it.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 7, 12, 0, 0)); // Wednesday noon
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getUnitForDate', () => {
  it('maps Monday and Tuesday to Unit 1 sharing a start date', () => {
    const mon = getUnitForDate(new Date(2026, 0, 5));
    const tue = getUnitForDate(new Date(2026, 0, 6));
    expect(mon.unitNumber).toBe(1);
    expect(mon.isReviewDay).toBe(false);
    expect(tue.unitNumber).toBe(1);
    expect(tue.startDate.getTime()).toBe(mon.startDate.getTime());
    expect(mon.startDate.getDate()).toBe(5);
    expect(mon.endDate.getDate()).toBe(6);
  });

  it('maps Wednesday/Thursday to Unit 2 and Friday/Saturday to Unit 3', () => {
    expect(getUnitForDate(new Date(2026, 0, 7)).unitNumber).toBe(2);
    expect(getUnitForDate(new Date(2026, 0, 8)).unitNumber).toBe(2);
    expect(getUnitForDate(new Date(2026, 0, 9)).unitNumber).toBe(3);
    expect(getUnitForDate(new Date(2026, 0, 10)).unitNumber).toBe(3);
  });

  it('flags Sunday as the review day (unit 0)', () => {
    const sun = getUnitForDate(new Date(2026, 0, 11));
    expect(sun.isReviewDay).toBe(true);
    expect(sun.unitNumber).toBe(0);
    // A review day is a unit of one: it starts and ends on the same date.
    expect(sun.startDate.getTime()).toBe(sun.endDate.getTime());
  });

  it('covers every weekday exactly once across the three units plus review', () => {
    // Guards the arithmetic that replaced the three hand-written branches.
    const byUnit = new Map<number, number[]>();
    for (let day = 5; day <= 11; day++) {
      const unit = getUnitForDate(new Date(2026, 0, day));
      byUnit.set(unit.unitNumber, [...(byUnit.get(unit.unitNumber) ?? []), day]);
    }
    expect(byUnit.get(1)).toEqual([5, 6]);
    expect(byUnit.get(2)).toEqual([7, 8]);
    expect(byUnit.get(3)).toEqual([9, 10]);
    expect(byUnit.get(0)).toEqual([11]);
  });
});

describe('getCurrentUnit / currentUnitStartLocal', () => {
  it('uses the mocked now for the current unit', () => {
    expect(getCurrentUnit().unitNumber).toBe(2); // Wednesday
  });

  it('returns the local YYYY-MM-DD start of the unit', () => {
    expect(currentUnitStartLocal(new Date(2026, 0, 6))).toBe('2026-01-05'); // Tue → Unit 1 start Mon
    expect(currentUnitStartLocal(new Date(2026, 0, 7))).toBe('2026-01-07'); // Wed → Unit 2 start
  });
});

describe('navigateUnit', () => {
  it('steps between adjacent work units', () => {
    const u1 = getUnitForDate(new Date(2026, 0, 5));
    expect(navigateUnit(u1, 'next').unitNumber).toBe(2);
    // Backwards from Unit 1 is the prior week's Sunday review, not Unit 3 —
    // a fixed -2 step used to jump over it, making past reviews unreachable.
    expect(navigateUnit(u1, 'prev').isReviewDay).toBe(true);
  });

  it('steps on and off the review day', () => {
    const sun = getUnitForDate(new Date(2026, 0, 11));
    expect(navigateUnit(sun, 'next').unitNumber).toBe(1); // next Monday
    expect(navigateUnit(sun, 'prev').unitNumber).toBe(3); // previous Fri-Sat
  });

  it('prev and next are exact inverses across the whole week', () => {
    for (const day of [5, 6, 7, 8, 9, 10, 11]) {
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

  it('anchors the week on Monday, so Sunday closes it rather than opening it', () => {
    // Called with the Sunday itself, the week must be the one that just ended —
    // otherwise the review day lands in a different week from the units it reviews.
    const fromSunday = getWeekUnits(new Date(2026, 0, 11));
    expect(fromSunday[0].startDate.getDate()).toBe(5); // Monday Jan 5
    expect(fromSunday[3].startDate.getDate()).toBe(11); // the Sunday itself

    const fromMonday = getWeekUnits(new Date(2026, 0, 5));
    expect(fromMonday.map((u) => u.startDate.getTime())).toEqual(
      fromSunday.map((u) => u.startDate.getTime())
    );
  });
});

describe('isSameUnit / isDateInUnit', () => {
  it('groups the two days of a work unit together', () => {
    expect(isSameUnit(new Date(2026, 0, 5), new Date(2026, 0, 6))).toBe(true);
    expect(isSameUnit(new Date(2026, 0, 5), new Date(2026, 0, 7))).toBe(false);
  });

  it('checks membership within a work unit', () => {
    const u1 = getUnitForDate(new Date(2026, 0, 5));
    expect(isDateInUnit(new Date(2026, 0, 6), u1)).toBe(true);
    expect(isDateInUnit(new Date(2026, 0, 7), u1)).toBe(false);
  });

  it('checks membership on a review day (exact date only)', () => {
    const sun = getUnitForDate(new Date(2026, 0, 11));
    expect(isDateInUnit(new Date(2026, 0, 11), sun)).toBe(true);
    expect(isDateInUnit(new Date(2026, 0, 10), sun)).toBe(false);
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
    expect(isToday(new Date(2026, 0, 7))).toBe(true);
    expect(isToday('2026-01-07')).toBe(true);
    expect(isToday(new Date(2026, 0, 8))).toBe(false);
  });

  it('isOverdue flags strictly-past dates only', () => {
    expect(isOverdue('2026-01-06')).toBe(true);
    expect(isOverdue('2026-01-07')).toBe(false);
    expect(isOverdue('2026-01-10')).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });

  it('isThisWeek spans Monday..Sunday of the current week', () => {
    expect(isThisWeek('2026-01-05')).toBe(true); // Monday, first day
    expect(isThisWeek('2026-01-11')).toBe(true); // Sunday, last day
    expect(isThisWeek('2026-01-04')).toBe(false); // previous week's Sunday
    expect(isThisWeek('2026-01-12')).toBe(false); // next Monday
    expect(isThisWeek(null)).toBe(false);
  });
});

describe('getFlexibleDueDateStatus', () => {
  it('classifies statuses across the 12h flex window', () => {
    vi.setSystemTime(new Date(2026, 0, 7, 6, 0, 0)); // Jan 7, 06:00
    expect(getFlexibleDueDateStatus(null).status).toBe('ok');
    expect(getFlexibleDueDateStatus(null).hoursRemaining).toBe(Infinity);
    expect(getFlexibleDueDateStatus('2026-01-20').status).toBe('ok');
    expect(getFlexibleDueDateStatus('2026-01-06').status).toBe('flexible'); // ~6h past deadline
    expect(getFlexibleDueDateStatus('2026-01-04').status).toBe('overdue'); // well past flex
  });

  it('marks a deadline within flex hours as approaching', () => {
    vi.setSystemTime(new Date(2026, 0, 7, 18, 0, 0)); // ~6h before end of today
    expect(getFlexibleDueDateStatus('2026-01-07').status).toBe('approaching');
  });
});
