import type { Task } from '$lib/types';

// Session-local drafts are shared by the sidebar and immersive view. Only an
// explicit successful save promotes them to persisted task data.
let drafts = $state<Record<string, string>>({});
export function continuationDraft(task: Task): string {
  return drafts[task.id] ?? task.resumeNote ?? '';
}
export function setContinuationDraft(id: string, value: string): void {
  drafts[id] = value;
}
export function acknowledgeContinuationDraft(id: string, savedDraft: string): void {
  // A late write must not erase edits made in another view during that write.
  if (drafts[id] === savedDraft) delete drafts[id];
}
