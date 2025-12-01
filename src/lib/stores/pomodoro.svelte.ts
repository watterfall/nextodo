import type { PomodoroState, PomodoroSession, Task } from '$lib/types';

// Pomodoro state
let state = $state<PomodoroState>('idle');
let timeRemaining = $state(25 * 60); // in seconds
let activeTaskId = $state<string | null>(null);
let activeTask = $state<Task | null>(null);
let sessionCount = $state(0);
let isRunning = $state(false);
let interruptionCount = $state(0); // Current session interruption counter
let currentInterruptionReasons = $state<string[]>([]); // Current session reasons

// Settings (will be synced from main store)
let workDuration = $state(25);
let shortBreakDuration = $state(5);
let longBreakDuration = $state(20);

// History
let sessions = $state<PomodoroSession[]>([]);

// Timer interval
let timerInterval: ReturnType<typeof setInterval> | null = null;

// Audio for notifications
let tickSound: HTMLAudioElement | null = null;
let completeSound: HTMLAudioElement | null = null;

function initAudio() {
  if (typeof window !== 'undefined') {
    // Create audio context for sounds
    tickSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2IlJiZmZmXkYd+dG5maGdscXZ9goaIiIeGhIN/e3d0cXBxc3Z6fYGEhoaGhIKAfnpycHBxc3d7gISGiIiGhIOAfnp4d3Z2eHt+gYSGh4eFg4F+e3l3dnZ3eXx/goSFhYSCgH57eXd2dnd5fH+BgwMCAQACAYGDhIaIhoSDgX98enh3d3h6fX+BgoODgoB+fHp5eHh4eXt9f4GCgoKBf316eHd2d3h5e32AgYKCgYB+fHp4d3d4eXt9gIGCgoGAf317eXh3d3h5e32AgYKCgYB+fHp4d3d4eXt9gIGCgoGAf317eXh3d3h5e32AgYKCgYB+');
  }
}

// Initialize
export function initPomodoro(settings: {
  work: number;
  shortBreak: number;
  longBreak: number;
}): void {
  workDuration = settings.work;
  shortBreakDuration = settings.shortBreak;
  longBreakDuration = settings.longBreak;
  timeRemaining = workDuration * 60;
  initAudio();
}

// Start pomodoro for a task
export function startPomodoro(task: Task): void {
  activeTaskId = task.id;
  activeTask = task;
  state = 'work';
  timeRemaining = workDuration * 60;
  isRunning = true;
  interruptionCount = 0; // Reset interruption counter for new session
  currentInterruptionReasons = [];
  startTimer();
}

// Pause timer
export function pausePomodoro(): void {
  isRunning = false;
  stopTimer();
}

// Resume timer
export function resumePomodoro(): void {
  if (state !== 'idle') {
    isRunning = true;
    startTimer();
  }
}

// Toggle pause/resume (for Space key shortcut)
export function togglePomodoro(): void {
  if (state === 'idle') {
    return; // Can't toggle if no session is active
  }
  if (isRunning) {
    pausePomodoro();
  } else {
    resumePomodoro();
  }
}

// Record an interruption during work session
export function recordInterruption(reason?: string): void {
  if (state === 'work') {
    interruptionCount++;
    if (reason) {
      currentInterruptionReasons = [...currentInterruptionReasons, reason];
    }
    console.log('Interruption recorded:', interruptionCount, reason);
  }
}

// Stop and reset
export function stopPomodoro(): void {
  isRunning = false;
  stopTimer();
  state = 'idle';
  timeRemaining = workDuration * 60;
  activeTaskId = null;
  activeTask = null;
}

// Skip current session
export function skipSession(): void {
  stopTimer();
  handleSessionComplete();
}

// Internal timer functions
function startTimer(): void {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    if (timeRemaining > 0) {
      timeRemaining--;

      // Play tick sound for last 5 seconds
      if (timeRemaining <= 5 && timeRemaining > 0 && tickSound) {
        tickSound.play().catch(() => {});
      }
    } else {
      handleSessionComplete();
    }
  }, 1000);
}

function stopTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function handleSessionComplete(): void {
  stopTimer();

  // Record session if it was a work session
  if (state === 'work' && activeTaskId) {
    const session: PomodoroSession = {
      id: crypto.randomUUID(),
      taskId: activeTaskId,
      startedAt: new Date(Date.now() - workDuration * 60 * 1000).toISOString(),
      duration: workDuration,
      completed: true,
      interruptions: interruptionCount,
      interruptionReasons: currentInterruptionReasons
    };
    sessions = [...sessions, session];
    sessionCount++;
    interruptionCount = 0; // Reset for next session
    currentInterruptionReasons = [];

    // Dispatch event for task store to increment pomodoro count
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pomodoro-complete', {
        detail: { taskId: activeTaskId }
      }));
    }
  }

  // Notify user
  notifySessionComplete();

  // Transition to next state
  if (state === 'work') {
    if (sessionCount % 4 === 0) {
      state = 'longBreak';
      timeRemaining = longBreakDuration * 60;
    } else {
      state = 'shortBreak';
      timeRemaining = shortBreakDuration * 60;
    }
    isRunning = true;
    startTimer();
  } else {
    // Break complete, ready for next work session
    state = 'idle';
    timeRemaining = workDuration * 60;
    isRunning = false;
  }
}

async function notifySessionComplete(): Promise<void> {
  // Play completion sound
  if (completeSound) {
    completeSound.play().catch(() => {});
  }

  // Try to send system notification
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      const title = state === 'work' ? '专注完成!' : '休息结束!';
      const body = state === 'work'
        ? `完成了一个番茄钟，休息一下吧`
        : '休息结束，准备开始下一个番茄钟';

      await sendNotification({ title, body });
    } catch {
      // Notification not available
    }
  }
}

// Format time for display
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get progress percentage
function getProgress(): number {
  let total: number;

  switch (state) {
    case 'work':
      total = workDuration * 60;
      break;
    case 'shortBreak':
      total = shortBreakDuration * 60;
      break;
    case 'longBreak':
      total = longBreakDuration * 60;
      break;
    default:
      return 0;
  }

  return ((total - timeRemaining) / total) * 100;
}

// Get state label
function getStateLabel(): string {
  switch (state) {
    case 'work':
      return '专注中';
    case 'shortBreak':
      return '短休息';
    case 'longBreak':
      return '长休息';
    default:
      return '就绪';
  }
}

// Get today's sessions
function getTodaySessions(): PomodoroSession[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return sessions.filter(s => {
    const sessionDate = new Date(s.startedAt);
    return sessionDate >= today;
  });
}

// Export store interface
export function getPomodoroStore() {
  return {
    get state() { return state; },
    get timeRemaining() { return timeRemaining; },
    get formattedTime() { return formatTime(timeRemaining); },
    get activeTaskId() { return activeTaskId; },
    get activeTask() { return activeTask; },
    get sessionCount() { return sessionCount; },
    get isRunning() { return isRunning; },
    get progress() { return getProgress(); },
    get stateLabel() { return getStateLabel(); },
    get sessions() { return sessions; },
    get todaySessions() { return getTodaySessions(); },
    get todayCount() { return getTodaySessions().length; },
    get interruptionCount() { return interruptionCount; },
    get currentInterruptionReasons() { return currentInterruptionReasons; }
  };
}
