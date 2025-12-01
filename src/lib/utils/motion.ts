/**
 * Motion configuration and animation utilities
 * Provides shared spring configs, durations, and easing curves for consistent animations
 */

import type { Task } from '$lib/types';

// Type definitions for svelte-dnd-action events
export interface DndConsiderDetail<T = Task> {
  items: T[];
  info: {
    trigger: string;
    id?: string;
    source?: string;
  };
}

export interface DndFinalizeDetail<T = Task> {
  items: T[];
  info: {
    trigger: string;
    id: string;
    source: string;
  };
}

export type DndConsiderEvent<T = Task> = CustomEvent<DndConsiderDetail<T>>;
export type DndFinalizeEvent<T = Task> = CustomEvent<DndFinalizeDetail<T>>;

// Spring configurations for different animation types
export const springs = {
  // Snappy - for quick interactions like buttons
  snappy: { stiffness: 400, damping: 30 },
  // Smooth - for general transitions
  smooth: { stiffness: 300, damping: 25 },
  // Bouncy - for playful animations like checkmarks
  bouncy: { stiffness: 500, damping: 20 },
  // Gentle - for subtle movements
  gentle: { stiffness: 200, damping: 20 },
  // Drag - optimized for drag operations
  drag: { stiffness: 350, damping: 35 }
} as const;

// Duration presets in milliseconds
export const durations = {
  instant: 100,
  fast: 150,
  normal: 200,
  slow: 350,
  slower: 500
} as const;

// Easing curves (CSS cubic-bezier)
export const easings = {
  // Standard material easing
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Decelerate - for entering elements
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  // Accelerate - for exiting elements
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  // Bouncy - overshoots slightly
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Smooth out - gentle deceleration
  smoothOut: 'cubic-bezier(0.16, 1, 0.3, 1)'
} as const;

// Svelte flip animation defaults
export const flipDefaults = {
  duration: 250,
  easing: easings.smoothOut
};

// DnD-specific configurations for svelte-dnd-action
export const dndConfig = {
  // Duration for the flip animation when items reorder
  flipDurationMs: 200,
  // Drop target animation duration
  dropTargetAnimationMs: 150,
  // Drag preview opacity
  dragPreviewOpacity: 0.9,
  // Drop zone highlight scale
  dropZoneHighlightScale: 1.02,
  // Center dragged item on cursor for better UX
  centreDraggedOnCursor: true,
  // Morphing duration for smoother transitions
  morphDisabled: false,
  // Enable transform drag to reduce layout thrashing
  transformDraggedElement: (el: HTMLElement | undefined) => {
    if (el) {
      el.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';
      el.style.transform = 'scale(1.02) rotate(1deg)';
      el.style.cursor = 'grabbing';
      el.style.zIndex = '9999';
    }
  }
} as const;

// CSS transition strings for common animations
export const transitions = {
  all: `all ${durations.normal}ms ${easings.standard}`,
  fast: `all ${durations.fast}ms ${easings.standard}`,
  opacity: `opacity ${durations.normal}ms ${easings.standard}`,
  transform: `transform ${durations.normal}ms ${easings.standard}`,
  background: `background ${durations.fast}ms ${easings.standard}`,
  border: `border-color ${durations.fast}ms ${easings.standard}`,
  shadow: `box-shadow ${durations.normal}ms ${easings.standard}`
} as const;

// Hover reveal animation config
export const hoverReveal = {
  // Default hidden state
  hidden: {
    opacity: 0,
    transform: 'translateY(4px)'
  },
  // Visible state on hover
  visible: {
    opacity: 1,
    transform: 'translateY(0)'
  },
  // Transition timing
  transition: `opacity ${durations.fast}ms ${easings.decelerate}, transform ${durations.fast}ms ${easings.decelerate}`
} as const;

// Focus mode dimming configuration
export const focusDimming = {
  // Dimmed state for non-active elements
  dimmed: {
    opacity: 0.3,
    filter: 'grayscale(0.4) blur(1px)',
    transform: 'scale(0.98)'
  },
  // Active state
  active: {
    opacity: 1,
    filter: 'none',
    transform: 'scale(1)'
  },
  // Transition for smooth dimming
  transition: `all ${durations.slow}ms ${easings.standard}`
} as const;

// Drop zone highlight animation
export const dropZoneHighlight = {
  idle: {
    borderStyle: 'dashed',
    borderColor: 'var(--border-color)',
    background: 'transparent',
    transform: 'scale(1)'
  },
  active: {
    borderStyle: 'solid',
    borderColor: 'var(--zone-color)',
    background: 'var(--zone-bg)',
    transform: 'scale(1.01)',
    boxShadow: '0 0 0 2px var(--zone-color)'
  }
} as const;

// Glassmorphism CSS values
export const glassmorphism = {
  // Light glass effect
  light: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  // Medium glass effect
  medium: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.12)'
  },
  // Strong glass effect for modals
  strong: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.15)'
  }
} as const;

// Helper function to create CSS transition string
export function createTransition(
  properties: string[],
  duration: keyof typeof durations = 'normal',
  easing: keyof typeof easings = 'standard'
): string {
  const durationMs = durations[duration];
  const easingValue = easings[easing];
  return properties.map(prop => `${prop} ${durationMs}ms ${easingValue}`).join(', ');
}

// Helper to generate staggered delay for list items
export function staggerDelay(index: number, baseDelay = 30): number {
  return index * baseDelay;
}

// Helper for shallow array comparison by ID and priority (for DnD optimization)
// Compares both ID and priority to ensure proper state sync after priority changes
export function areTaskArraysEqual(a: Task[], b: Task[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // Compare both id and priority to detect stale task objects
    if (a[i].id !== b[i].id || a[i].priority !== b[i].priority) return false;
  }
  return true;
}
