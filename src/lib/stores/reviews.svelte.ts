import type { UnitReview, Priority, Task } from '$lib/types';
import { getUnitForDate, formatDateISO } from '$lib/utils/unitCalc';

// Reviews state
let reviews = $state<UnitReview[]>([]);

// Initialize reviews from app data
export function initReviews(existingReviews: UnitReview[]): void {
  reviews = existingReviews;
}

// Create a new review for a unit
export function createReview(
  tasks: Task[],
  unitStart: string,
  unitEnd: string,
  reflection: string,
  nextUnitFocus: string
): UnitReview {
  // Calculate stats for the unit
  const unitTasks = tasks.filter(t => {
    const taskDate = new Date(t.unitStart);
    const start = new Date(unitStart);
    const end = new Date(unitEnd);
    return taskDate >= start && taskDate <= end;
  });

  const planned: Record<Priority, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const completed: Record<Priority, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let pomodorosTotal = 0;

  for (const task of unitTasks) {
    planned[task.priority]++;
    if (task.completed) {
      completed[task.priority]++;
    }
    pomodorosTotal += task.pomodoros.completed;
  }

  const review: UnitReview = {
    id: crypto.randomUUID(),
    unitStart,
    unitEnd,
    createdAt: new Date().toISOString(),
    stats: {
      planned,
      completed,
      pomodorosTotal
    },
    reflection,
    nextUnitFocus
  };

  reviews = [...reviews, review];

  return review;
}

// Get review for a specific unit
export function getReviewForUnit(unitStart: string): UnitReview | null {
  return reviews.find(r => r.unitStart === unitStart) || null;
}

// Update an existing review
export function updateReview(reviewId: string, updates: Partial<UnitReview>): void {
  reviews = reviews.map(r => {
    if (r.id === reviewId) {
      return { ...r, ...updates };
    }
    return r;
  });
}

// Delete a review
export function deleteReview(reviewId: string): void {
  reviews = reviews.filter(r => r.id !== reviewId);
}

// Get completion rate for a unit
export function getCompletionRate(review: UnitReview): number {
  const totalPlanned = Object.values(review.stats.planned).reduce((a, b) => a + b, 0);
  const totalCompleted = Object.values(review.stats.completed).reduce((a, b) => a + b, 0);

  if (totalPlanned === 0) return 0;
  return Math.round((totalCompleted / totalPlanned) * 100);
}

// Get priority completion rates
export function getPriorityRates(review: UnitReview): Record<Priority, number> {
  const rates: Record<Priority, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const priority of ['A', 'B', 'C', 'D', 'E'] as Priority[]) {
    const planned = review.stats.planned[priority];
    const completed = review.stats.completed[priority];

    if (planned > 0) {
      rates[priority] = Math.round((completed / planned) * 100);
    }
  }

  return rates;
}

// Get recent reviews
function getRecentReviews(count: number = 5): UnitReview[] {
  return [...reviews]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, count);
}

// Get weekly summary
function getWeeklySummary(weekStart: Date): {
  totalPlanned: number;
  totalCompleted: number;
  totalPomodoros: number;
  completionRate: number;
} {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekReviews = reviews.filter(r => {
    const reviewDate = new Date(r.unitStart);
    return reviewDate >= weekStart && reviewDate <= weekEnd;
  });

  let totalPlanned = 0;
  let totalCompleted = 0;
  let totalPomodoros = 0;

  for (const review of weekReviews) {
    totalPlanned += Object.values(review.stats.planned).reduce((a, b) => a + b, 0);
    totalCompleted += Object.values(review.stats.completed).reduce((a, b) => a + b, 0);
    totalPomodoros += review.stats.pomodorosTotal;
  }

  return {
    totalPlanned,
    totalCompleted,
    totalPomodoros,
    completionRate: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0
  };
}

// Export store interface
export function getReviewsStore() {
  return {
    get reviews() { return reviews; },
    get recentReviews() { return getRecentReviews(); }
  };
}
