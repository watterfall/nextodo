<script lang="ts">
  import { t } from '$lib/i18n';
  import { getTasksStore, archiveCompleted } from '$lib/stores/tasks.svelte';
  import { fade, scale } from 'svelte/transition';

  const tasks = getTasksStore();
  
  let { onClose }: { onClose: () => void } = $props();

  // Tasks older than 30 days that are not A priority and not recurring
  const staleTasks = $derived(tasks.tasks.filter(t => {
    if (t.completed || t.priority === 'A' || t.recurrence) return false;
    
    const created = new Date(t.createdAt);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
    
    return diffDays > 30;
  }));

  const staleCount = $derived(staleTasks.length);

  async function handleArchiveStale() {
    // This would need a new store method to archive specific tasks
    // For now, we simulate by "completing" them then archiving
    // In a real impl, we'd add 'archiveTasks(ids)' to tasks store
    
    // Placeholder logic:
    // 1. Mark stale as completed
    // 2. Archive completed
    // 3. (Optional) Tag them as 'stale-archived'
    
    // For this prototype, just close
    onClose();
  }

  function handleDismiss() {
    onClose();
  }
</script>

{#if staleCount > 5}
  <div class="fresh-start-modal" transition:fade>
    <div class="modal-content glass-medium" transition:scale={{ start: 0.9 }}>
      <div class="illustration">🌱</div>
      <h3>新的开始</h3>
      <p>
        我们注意到你有 <strong>{staleCount}</strong> 个任务已经超过 30 天未处理。
        <br>
        过去已经过去。要将它们移入冷冻柜(归档)，重新开始吗？
      </p>
      
      <div class="actions">
        <button class="btn-primary" onclick={handleArchiveStale}>
          是的，帮我清理
        </button>
        <button class="btn-secondary" onclick={handleDismiss}>
          不，我还记得它们
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .fresh-start-modal {
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 1000;
    max-width: 360px;
    filter: drop-shadow(0 10px 30px rgba(0,0,0,0.2));
  }

  .modal-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .illustration {
    font-size: 40px;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .actions {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  button {
    flex: 1;
    padding: 10px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }
</style>

