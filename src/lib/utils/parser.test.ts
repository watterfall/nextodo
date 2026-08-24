import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseTaskInput,
  createTaskFromInput,
  formatTaskDisplay,
  calculateNextDue,
  parseRecurrence,
  highlightSyntax,
} from './parser';
import { createEmptyTask, DEFAULT_PRIORITY } from '$lib/types';
import type { Task } from '$lib/types';

// Fixed "today" for relative-date parsing: Sunday 2026-01-04, noon.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 4, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseTaskInput — basics', () => {
  it('defaults to the standard tier with plain text', () => {
    const r = parseTaskInput('Buy milk');
    expect(r.content).toBe('Buy milk');
    expect(r.priority).toBe(DEFAULT_PRIORITY);
    expect(r.projects).toEqual([]);
    expect(r.contexts).toEqual([]);
    expect(r.customTags).toEqual([]);
    expect(r.dueDate).toBeNull();
    expect(r.thresholdDate).toBeNull();
    expect(r.estimatedPomodoros).toBe(0);
    expect(r.recurrence).toBeNull();
  });

  it('handles empty input', () => {
    const r = parseTaskInput('');
    expect(r.content).toBe('');
    expect(r.priority).toBe(DEFAULT_PRIORITY);
  });

  it('parses priority at the end', () => {
    const r = parseTaskInput('Write report !A');
    expect(r.priority).toBe('A');
    expect(r.content).toBe('Write report');
  });

  it('parses priority at the start', () => {
    const r = parseTaskInput('!B Fix bug');
    expect(r.priority).toBe('B');
    expect(r.content).toBe('Fix bug');
  });

  it('leaves a letter that is no longer a tier in the content', () => {
    // F, N and S were tiers once. They are not any more, so !F must behave like
    // any other unknown letter rather than silently landing somewhere.
    for (const letter of ['F', 'N', 'S']) {
      const r = parseTaskInput(`plan !${letter}`);
      expect(r.priority, letter).toBe(DEFAULT_PRIORITY);
      expect(r.content, letter).toContain(`!${letter}`);
    }
  });

  it('parses full-width bracket priority 【A】', () => {
    const r = parseTaskInput('【A】 do it');
    expect(r.priority).toBe('A');
    expect(r.content).toBe('do it');
  });

  it('ignores an invalid priority letter (kept in content)', () => {
    const r = parseTaskInput('!Z task');
    expect(r.priority).toBe(DEFAULT_PRIORITY);
    expect(r.content).toContain('!Z');
  });

  it('does not treat a letter-followed !A as priority (lookahead)', () => {
    const r = parseTaskInput('go to !Aberdeen');
    expect(r.priority).toBe(DEFAULT_PRIORITY);
    expect(r.content).toContain('!Aberdeen');
  });

  it('takes the first priority but strips all priority markers', () => {
    const r = parseTaskInput('x !A !B');
    expect(r.priority).toBe('A');
    expect(r.content).toBe('x');
  });
});

describe('parseTaskInput — tags', () => {
  it('extracts projects, contexts and custom tags', () => {
    const r = parseTaskInput('Task +work +home @office #urgent');
    expect(r.projects).toEqual(['work', 'home']);
    expect(r.contexts).toEqual(['office']);
    expect(r.customTags).toEqual(['urgent']);
    expect(r.content).toBe('Task');
  });

  it('captures an in-range emoji tag (💻编码)', () => {
    const r = parseTaskInput('code 💻编码');
    expect(r.customTags).toContain('💻编码');
    expect(r.content).toBe('code');
  });
});

describe('parseTaskInput — pomodoros', () => {
  it('parses 🍅N estimate', () => {
    const r = parseTaskInput('Task 🍅3');
    expect(r.estimatedPomodoros).toBe(3);
    expect(r.content).toBe('Task');
  });

  it('parses pN estimate', () => {
    const r = parseTaskInput('Read book p4');
    expect(r.estimatedPomodoros).toBe(4);
    expect(r.content).toBe('Read book');
  });

  it('does not match a "p<digit>" inside a word', () => {
    const r = parseTaskInput('step2 done');
    expect(r.estimatedPomodoros).toBe(0);
    expect(r.content).toBe('step2 done');
  });

  it('parses a standalone estimate at the start of the input', () => {
    expect(parseTaskInput('p3 write it').estimatedPomodoros).toBe(3);
    expect(parseTaskInput('p3 write it').content).toBe('write it');
  });
});

describe('parseTaskInput — dates', () => {
  it('parses ISO due date', () => {
    expect(parseTaskInput('Do thing ~2026-01-15').dueDate).toBe('2026-01-15');
  });

  it('parses ~today / ~tomorrow relative to fixed now', () => {
    expect(parseTaskInput('x ~today').dueDate).toBe('2026-01-04');
    expect(parseTaskInput('x ~tomorrow').dueDate).toBe('2026-01-05');
  });

  it('parses the plain ~Nd relative form', () => {
    expect(parseTaskInput('x ~3d').dueDate).toBe('2026-01-07');
  });

  it('parses the +prefixed ~+Nd form without leaking it into projects', () => {
    const r = parseTaskInput('x ~+3d');
    expect(r.dueDate).toBe('2026-01-07');
    expect(r.projects).toEqual([]);
  });

  it('parses threshold date thr:ISO and both relative forms', () => {
    expect(parseTaskInput('x thr:2026-01-10').thresholdDate).toBe('2026-01-10');
    expect(parseTaskInput('x thr:7d').thresholdDate).toBe('2026-01-11');
    const plus = parseTaskInput('x thr:+7d');
    expect(plus.thresholdDate).toBe('2026-01-11');
    expect(plus.projects).toEqual([]);
  });
});

describe('parseTaskInput — tag boundaries', () => {
  // Regression: these matched mid-word and the matched run was then DELETED
  // from the content, so this input became "mail bob about c and issue" with
  // a bogus context, project and tag. The boundary rule is todo.txt's, so
  // typed input and imported lines now agree.
  it('does not mistake an email, c++ or issue#42 for tags', () => {
    const r = parseTaskInput('mail bob@example.com about c++ and issue#42');
    expect(r.content).toBe('mail bob@example.com about c++ and issue#42');
    expect(r.contexts).toEqual([]);
    expect(r.projects).toEqual([]);
    expect(r.customTags).toEqual([]);
  });

  it('still extracts standalone tags', () => {
    const r = parseTaskInput('thing +proj @ctx #tag');
    expect(r.content).toBe('thing');
    expect(r.projects).toEqual(['proj']);
    expect(r.contexts).toEqual(['ctx']);
    expect(r.customTags).toEqual(['tag']);
  });

  it('highlights only what it will actually extract', () => {
    const html = highlightSyntax('mail bob@example.com +proj');
    expect(html).toContain('<span class="syntax-project">+proj</span>');
    expect(html).not.toContain('syntax-context');
  });
});

describe('parseTaskInput — recurrence', () => {
  it('parses a standard weekly pattern', () => {
    const r = parseTaskInput('standup rec:1w');
    expect(r.recurrence).toEqual({ n: 1, unit: 'w', strict: false, nextDue: null });
  });

  it('accepts the todo.txt forms so sleek syntax works verbatim', () => {
    expect(parseTaskInput('standup rec:d').recurrence).toEqual({ n: 1, unit: 'd', strict: false, nextDue: null });
    expect(parseTaskInput('rent rec:+1m').recurrence).toEqual({ n: 1, unit: 'm', strict: true, nextDue: null });
    expect(parseTaskInput('report rec:b').recurrence).toEqual({ n: 1, unit: 'b', strict: false, nextDue: null });
  });

  it('parses a weekday-list custom pattern', () => {
    const r = parseTaskInput('gym rec:mon,wed,fri');
    expect(r.recurrence?.customPattern).toBe('mon,wed,fri');
  });

  it('keeps the @day part of rec:1m@15 instead of leaking it into contexts', () => {
    const r = parseTaskInput('rent rec:1m@15');
    expect(r.recurrence?.unit).toBe('m');
    expect(r.recurrence?.customPattern).toBe('1m@15');
    expect(r.contexts).toEqual([]);
  });

  it('keeps the @last selector of rec:1m@last', () => {
    const r = parseTaskInput('rent rec:1m@last');
    expect(r.recurrence?.customPattern).toBe('1m@last');
    expect(r.contexts).toEqual([]);
  });
});

describe('parseTaskInput — combined', () => {
  it('parses every field in one input', () => {
    const r = parseTaskInput(
      'Deep work !A +proj @ctx #tag 🍅5 ~2026-01-20 thr:2026-01-10 rec:1w'
    );
    expect(r.content).toBe('Deep work');
    expect(r.priority).toBe('A');
    expect(r.projects).toEqual(['proj']);
    expect(r.contexts).toEqual(['ctx']);
    expect(r.customTags).toEqual(['tag']);
    expect(r.estimatedPomodoros).toBe(5);
    expect(r.dueDate).toBe('2026-01-20');
    expect(r.thresholdDate).toBe('2026-01-10');
    expect(r.recurrence).toEqual({ n: 1, unit: 'w', strict: false, nextDue: null });
  });
});

describe('createTaskFromInput', () => {
  it('produces a well-formed Task', () => {
    const task = createTaskFromInput('Ship it !B +release 🍅2');
    expect(typeof task.id).toBe('string');
    expect(task.completed).toBe(false);
    expect(task.content).toBe('Ship it');
    expect(task.priority).toBe('B');
    expect(task.projects).toEqual(['release']);
    expect(task.pomodoros.estimated).toBe(2);
    expect(task.pomodoros.completed).toBe(0);
  });
});

describe('formatTaskDisplay', () => {
  it('renders content plus tag metadata', () => {
    const task: Task = {
      ...createEmptyTask('C'),
      content: 'Task',
      projects: ['work'],
      contexts: ['home'],
      customTags: ['urgent'],
    };
    expect(formatTaskDisplay(task)).toBe('Task +work @home #urgent');
  });

  it('renders only content when there is no metadata', () => {
    const task: Task = { ...createEmptyTask('C'), content: 'Just text' };
    expect(formatTaskDisplay(task)).toBe('Just text');
  });
});

describe('re-exported recurrence engine', () => {
  // The engine itself is covered in recurrence.test.ts. All this needs to check
  // is that `from './parser'` still reaches it, since callers import it from
  // both places and a broken re-export would be silent at runtime.
  it('exposes the same calculateNextDue as ./recurrence', () => {
    expect(calculateNextDue(parseRecurrence('1d'), new Date(2026, 0, 4))).toBe('2026-01-05');
    expect(parseRecurrence('+3m')).toEqual({ n: 3, unit: 'm', strict: true, nextDue: null });
  });
});
