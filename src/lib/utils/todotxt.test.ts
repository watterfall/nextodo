import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseLine,
  serializeItem,
  markLineComplete,
  addContextToLine,
  removeContextFromLine,
  taskFromTodoTxt,
  todoTxtFromTask,
  findSourceLine,
  splitLines,
} from './todotxt';
import { createEmptyTask, countOrigins, taskOrigin, withOrigin } from '$lib/types';
import type { Task } from '$lib/types';

// Fixed "today" so speaking dates (due:tomorrow) are deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 7, 12, 0, 0)); // Wednesday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseLine — header', () => {
  it('reads a bare body', () => {
    const item = parseLine('measure space for shelving');
    expect(item.complete).toBe(false);
    expect(item.priority).toBeNull();
    expect(item.createdDate).toBeNull();
    expect(item.completedDate).toBeNull();
    expect(item.body).toBe('measure space for shelving');
  });

  it('reads a priority', () => {
    expect(parseLine('(A) call mom').priority).toBe('A');
    expect(parseLine('(A) call mom').body).toBe('call mom');
  });

  it('treats a single date as the creation date', () => {
    const item = parseLine('2026-01-05 call mom');
    expect(item.createdDate).toBe('2026-01-05');
    expect(item.completedDate).toBeNull();
    expect(item.body).toBe('call mom');
  });

  it('treats a date pair as completed-then-created', () => {
    const item = parseLine('x 2026-01-07 2026-01-05 call mom');
    expect(item.complete).toBe(true);
    expect(item.completedDate).toBe('2026-01-07');
    expect(item.createdDate).toBe('2026-01-05');
    expect(item.body).toBe('call mom');
  });

  it('only accepts x as a completion marker at the start, followed by a space', () => {
    expect(parseLine('x call mom').complete).toBe(true);
    expect(parseLine('xylophone practice').complete).toBe(false);
    expect(parseLine('practice x').complete).toBe(false);
    // A bare "x" with nothing after it is a body, not a marker.
    expect(parseLine('x').complete).toBe(false);
  });

  it('only accepts a single uppercase letter as a priority', () => {
    expect(parseLine('(a) call mom').priority).toBeNull();
    expect(parseLine('(AB) call mom').priority).toBeNull();
    expect(parseLine('(1) call mom').priority).toBeNull();
    // ...and the unmatched text stays in the body rather than disappearing.
    expect(parseLine('(a) call mom').body).toBe('(a) call mom');
  });

  it('collapses sleek’s in-todo line-break placeholder', () => {
    const withBreak = `note${String.fromCharCode(16)}second line`;
    expect(parseLine(withBreak).body).toBe('note second line');
  });
});

describe('parseLine — body tags', () => {
  it('classifies projects, contexts and extensions', () => {
    const item = parseLine('(B) 2026-01-05 rewrite exporter +work @office due:2026-01-20 pm:8');
    expect(item.projects).toEqual(['work']);
    expect(item.contexts).toEqual(['office']);
    expect(item.extensions).toEqual([
      { key: 'due', value: '2026-01-20' },
      { key: 'pm', value: '8' },
    ]);
  });

  it('requires a whitespace boundary before a tag', () => {
    // This is the rule FocusFlow's own parser was missing: without it an email
    // address parses as a context and gets deleted from the task text.
    const item = parseLine('mail bob@example.com about c++ and issue#42');
    expect(item.contexts).toEqual([]);
    expect(item.projects).toEqual([]);
    expect(item.extensions).toEqual([]);
  });

  it('reproduces jstodotxt’s classification of @a:b as a context', () => {
    // The extension alternative is tried first, so the whole `@a:b` matches;
    // it is then classified by its first character. Odd, but it is what sleek
    // does, and disagreeing would mean the two apps see different tags.
    const item = parseLine('thing @a:b');
    expect(item.contexts).toEqual(['a:b']);
    expect(item.extensions).toEqual([]);
  });

  it('stops an extension value at the second colon', () => {
    // Neither key nor value may contain a colon, so a:b:c is the extension
    // a=b with `:c` left as plain text. This is why no FocusFlow field may be
    // encoded as a timestamp — 10:30:00 would be truncated.
    const item = parseLine('thing a:b:c');
    expect(item.extensions).toEqual([{ key: 'a', value: 'b' }]);
  });

  it('does not treat #tag as a todo.txt tag', () => {
    const item = parseLine('thing #urgent');
    expect(item.extensions).toEqual([]);
    expect(item.contexts).toEqual([]);
    expect(item.body).toContain('#urgent');
  });
});

describe('serializeItem', () => {
  const CORPUS = [
    'measure space for shelving',
    '(A) call mom',
    '2026-01-05 call mom +family @phone',
    'x 2026-01-07 2026-01-05 call mom +family @phone',
    'pay the rent due:2026-01-15 rec:+1m pm:1',
    'water plants rec:d t:2026-02-01 h:1',
    'x 2026-01-07 2026-01-05 finish report pri:B +work',
    'weird a:b:c @x:y +proj #tag unknown:ext',
  ];

  it('round-trips every corpus line unchanged', () => {
    for (const line of CORPUS) {
      expect(serializeItem(parseLine(line)), line).toBe(line);
    }
  });

  it('never emits a completion date without a creation date', () => {
    // A reader would take that single date as the creation date, silently
    // losing the completion date.
    const line = serializeItem({
      complete: true,
      priority: null,
      completedDate: '2026-01-07',
      createdDate: null,
      body: 'thing',
      contexts: [],
      projects: [],
      extensions: [],
    });
    expect(parseLine(line).completedDate).toBe('2026-01-07');
    expect(parseLine(line).complete).toBe(true);
  });
});

describe('markLineComplete', () => {
  it('marks an open line complete', () => {
    expect(markLineComplete('2026-01-05 call mom', '2026-01-07')).toBe(
      'x 2026-01-07 2026-01-05 call mom'
    );
  });

  it('parks the priority in pri: the way sleek does', () => {
    // sleek's RestorePreviousPriority reads it back when a todo is reopened.
    // Writing a different shape would leave the file with two styles of
    // completed line depending on which app ticked the box.
    const done = markLineComplete('(B) 2026-01-05 finish report +work', '2026-01-07');
    expect(done).toBe('x 2026-01-07 2026-01-05 finish report +work pri:B');
    expect(parseLine(done).priority).toBeNull();
  });

  it('supplies a creation date when the source line had none', () => {
    const done = markLineComplete('call mom', '2026-01-07');
    expect(done).toBe('x 2026-01-07 2026-01-07 call mom');
  });

  it('is idempotent', () => {
    const once = markLineComplete('(B) 2026-01-05 finish report', '2026-01-07');
    expect(markLineComplete(once, '2026-01-08')).toBe(once);
  });

  it('leaves every other tag on the line untouched', () => {
    const done = markLineComplete('2026-01-05 thing +p @c due:2026-02-01 rec:1w unknown:x', '2026-01-07');
    expect(done).toContain('+p');
    expect(done).toContain('@c');
    expect(done).toContain('due:2026-02-01');
    expect(done).toContain('rec:1w');
    expect(done).toContain('unknown:x');
  });
});

describe('addContextToLine / removeContextFromLine', () => {
  it('appends a context once', () => {
    expect(addContextToLine('2026-01-05 thing', '主')).toBe('2026-01-05 thing @主');
    expect(addContextToLine('2026-01-05 thing @主', '主')).toBe('2026-01-05 thing @主');
  });

  it('removes a context and is a no-op when absent', () => {
    expect(removeContextFromLine('2026-01-05 thing @主 +p', '主')).toBe('2026-01-05 thing +p');
    expect(removeContextFromLine('2026-01-05 thing +p', '主')).toBe('2026-01-05 thing +p');
  });

  it('does not match a context that is a prefix of another', () => {
    expect(removeContextFromLine('thing @home @homework', 'home')).toBe('thing @homework');
  });
});

describe('taskFromTodoTxt', () => {
  it('maps every field it understands', () => {
    const { task, hidden, raw } = taskFromTodoTxt(
      '(B) 2026-01-05 rewrite exporter +work @office #urgent due:2026-01-20 t:2026-01-10 rec:+1m pm:8'
    );
    expect(task.content).toBe('rewrite exporter');
    expect(task.priority).toBe('B');
    expect(task.projects).toEqual(['work']);
    expect(task.contexts).toEqual(['office']);
    expect(task.customTags).toEqual(['urgent']);
    expect(task.dueDate).toBe('2026-01-20');
    expect(task.thresholdDate).toBe('2026-01-10');
    expect(task.recurrence).toEqual({ n: 1, unit: 'm', strict: true, nextDue: null });
    expect(task.pomodoros.estimated).toBe(8);
    expect(hidden).toBe(false);
    expect(raw).toContain('rewrite exporter');
  });

  it('resolves a speaking due date', () => {
    // sleek writes these into the file verbatim and only resolves them on read.
    expect(taskFromTodoTxt('thing due:tomorrow').task.dueDate).toBe('2026-01-08');
    expect(taskFromTodoTxt('thing t:+7d').task.thresholdDate).toBe('2026-01-14');
  });

  it('keeps an unresolvable date token in the content rather than dropping it', () => {
    const { task } = taskFromTodoTxt('thing due:next Tuesday');
    expect(task.dueDate).toBeNull();
    // "next" is consumed as the due operand and "Tuesday" stays; either way the
    // user can still see that something date-shaped was there.
    expect(task.content).toContain('Tuesday');
  });

  it('reports h:1 as hidden', () => {
    expect(taskFromTodoTxt('someday idea h:1').hidden).toBe(true);
    expect(taskFromTodoTxt('someday idea h:0').hidden).toBe(false);
  });

  it('imports a completed line with its stashed priority', () => {
    const { task } = taskFromTodoTxt('x 2026-01-07 2026-01-05 finish report pri:B +work');
    expect(task.completed).toBe(true);
    expect(task.priority).toBe('G');
    expect(task.originalPriority).toBe('B');
    expect(task.content).toBe('finish report');
  });

  it('falls back for a priority letter this app has no tier for', () => {
    expect(taskFromTodoTxt('(Z) thing', 'C').task.priority).toBe('C');
    // G and H are this app's completed/cancelled markers, not importable tiers —
    // a literal `(G)` line is a coincidence of lettering, not a completed task.
    expect(taskFromTodoTxt('(G) thing', 'C').task.priority).toBe('C');
    expect(taskFromTodoTxt('(G) thing', 'C').task.completed).toBe(false);
  });

  it('leaves an extension it does not own in the content', () => {
    // Another tool may own `foo:bar`; deleting it would destroy information the
    // user cannot get back.
    expect(taskFromTodoTxt('thing foo:bar due:2026-01-20').task.content).toBe('thing foo:bar');
  });

  it('anchors imported dates on the local calendar day', () => {
    const { task } = taskFromTodoTxt('x 2026-01-07 2026-01-05 thing');
    expect(new Date(task.createdAt).getDate()).toBe(5);
    expect(new Date(task.completedAt!).getDate()).toBe(7);
  });
});

describe('todoTxtFromTask', () => {
  function task(overrides: Partial<Task> = {}): Task {
    return { ...createEmptyTask('C'), createdAt: new Date(2026, 0, 5).toISOString(), ...overrides };
  }

  it('renders an open task', () => {
    const line = todoTxtFromTask(
      task({
        content: 'rewrite exporter',
        priority: 'B',
        projects: ['work'],
        contexts: ['office'],
        customTags: ['urgent'],
        dueDate: '2026-01-20',
        pomodoros: { estimated: 8, completed: 3 },
      })
    );
    expect(line).toBe('(B) 2026-01-05 rewrite exporter +work @office #urgent due:2026-01-20 pm:8');
  });

  it('round-trips back into an equivalent task', () => {
    const original = task({
      content: 'rewrite exporter',
      priority: 'B',
      projects: ['work'],
      contexts: ['office'],
      customTags: ['urgent'],
      dueDate: '2026-01-20',
      thresholdDate: '2026-01-10',
      recurrence: { n: 2, unit: 'w', strict: true, nextDue: null },
      pomodoros: { estimated: 8, completed: 3 },
    });
    const { task: reimported } = taskFromTodoTxt(todoTxtFromTask(original));

    expect(reimported.content).toBe(original.content);
    expect(reimported.priority).toBe(original.priority);
    expect(reimported.projects).toEqual(original.projects);
    expect(reimported.contexts).toEqual(original.contexts);
    expect(reimported.customTags).toEqual(original.customTags);
    expect(reimported.dueDate).toBe(original.dueDate);
    expect(reimported.thresholdDate).toBe(original.thresholdDate);
    expect(reimported.recurrence).toEqual(original.recurrence);
    expect(reimported.pomodoros.estimated).toBe(8);
  });

  it('omits a recurrence todo.txt cannot express', () => {
    // Writing `rec:mon,wed,fri` would produce a value sleek reads as garbage.
    const line = todoTxtFromTask(
      task({ content: 'gym', recurrence: { n: 1, unit: 'w', strict: false, customPattern: 'mon,wed,fri', nextDue: null } })
    );
    expect(line).not.toContain('rec:');
  });

  it('drops a tag containing whitespace instead of splitting it in two', () => {
    const line = todoTxtFromTask(task({ content: 'thing', projects: ['two words', 'ok'] }));
    expect(line).toContain('+ok');
    expect(line).not.toContain('two');
  });

  it('renders a completed task the way sleek does', () => {
    const line = todoTxtFromTask(
      task({
        content: 'finish report',
        priority: 'G',
        completed: true,
        originalPriority: 'B',
        completedAt: new Date(2026, 0, 7).toISOString(),
      })
    );
    expect(line).toBe('x 2026-01-07 2026-01-05 finish report pri:B');
  });
});

describe('origin marker (@主 / @被)', () => {
  it('round-trips through a todo.txt line as an ordinary context', () => {
    // The whole reason it is a context and not a field: it survives the file
    // for free, and sleek counts and filters it with no configuration.
    const task = { ...createEmptyTask('C'), content: 'write the report', contexts: withOrigin([], 'assigned') };
    const line = todoTxtFromTask(task);
    expect(line).toContain('@被');

    const { task: back } = taskFromTodoTxt(line);
    expect(taskOrigin(back)).toBe('assigned');
  });

  it('reads back as null when the line carries no marker', () => {
    expect(taskOrigin(taskFromTodoTxt('plain line @office').task)).toBeNull();
  });

  it('replaces rather than accumulates when the user changes their mind', () => {
    const contexts = withOrigin(withOrigin(['office'], 'self'), 'assigned');
    expect(contexts).toEqual(['office', '被']);
  });

  it('clears the marker when given null', () => {
    expect(withOrigin(['office', '主'], null)).toEqual(['office']);
  });

  it('counts unmarked tasks separately from either side', () => {
    // Folding "forgot to mark it" into proactive would inflate exactly the
    // number the marker exists to measure.
    const tasks = [
      { ...createEmptyTask('C'), contexts: withOrigin([], 'self') },
      { ...createEmptyTask('C'), contexts: withOrigin([], 'assigned') },
      { ...createEmptyTask('C'), contexts: withOrigin([], 'assigned') },
      { ...createEmptyTask('C'), contexts: ['office'] },
    ];
    expect(countOrigins(tasks)).toEqual({ self: 1, assigned: 2, unmarked: 1 });
    expect(countOrigins([])).toEqual({ self: 0, assigned: 0, unmarked: 0 });
  });

  it('survives a completion write-back untouched', () => {
    // markLineComplete only prepends `x` and moves the priority; every other
    // token on the line has to come through unchanged.
    const line = '(B) 2026-01-05 write the report +work @被';
    const done = markLineComplete(line, '2026-01-07');
    expect(done).toBe('x 2026-01-07 2026-01-05 write the report +work @被 pri:B');
    expect(taskOrigin(taskFromTodoTxt(done).task)).toBe('assigned');
  });
});

describe('findSourceLine', () => {
  const LINES = [
    '(A) 2026-01-05 rewrite exporter +work',
    '2026-01-05 write weekly report',
    'x 2026-01-06 2026-01-01 old thing',
  ];

  it('finds a verbatim line', () => {
    expect(findSourceLine(LINES, LINES[1])).toEqual({ index: 1, fuzzy: false, ambiguous: false });
  });

  it('falls back to content when the line was edited in sleek', () => {
    // The user changed the priority and added a due date on the other side.
    const pulled = '(A) 2026-01-05 rewrite exporter +work';
    const edited = ['(C) 2026-01-05 rewrite exporter +work due:2026-02-01', ...LINES.slice(1)];
    expect(findSourceLine(edited, pulled)).toEqual({ index: 0, fuzzy: true, ambiguous: false });
  });

  it('prefers an open duplicate over a completed one and flags the ambiguity', () => {
    const dupes = ['x 2026-01-06 2026-01-01 standup', '2026-01-05 standup'];
    expect(findSourceLine(dupes, '2026-01-05 standup')).toEqual({
      index: 1,
      fuzzy: false,
      ambiguous: false,
    });
    // Same content, neither verbatim-equal to what was pulled.
    expect(findSourceLine(dupes, '(B) standup')).toEqual({ index: 1, fuzzy: true, ambiguous: true });
  });

  it('returns -1 rather than guessing when nothing matches', () => {
    // Writing to the wrong line silently rewrites a different task, which is
    // worse than not writing back at all.
    expect(findSourceLine(LINES, '2026-01-05 something else entirely').index).toBe(-1);
    expect(findSourceLine(LINES, '').index).toBe(-1);
  });
});

describe('splitLines', () => {
  it('drops blank lines so indices line up with what sleek shows', () => {
    expect(splitLines('a\n\nb\r\n\r\n  \nc')).toEqual(['a', 'b', 'c']);
    expect(splitLines('')).toEqual([]);
  });
});
