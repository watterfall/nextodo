<script lang="ts">
  import { getSettingsStore } from '$lib/stores/settings.svelte';

  interface Props {
    selectedTags: string[];
    onSelect: (tag: string) => void;
    onDeselect: (tag: string) => void;
  }

  let { selectedTags, onSelect, onDeselect }: Props = $props();

  const settings = getSettingsStore();

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onDeselect(tag);
    } else {
      onSelect(tag);
    }
  }
</script>

<div class="tag-picker">
  {#each Object.entries(settings.customTagGroups) as [groupName, tags]}
    <div class="tag-group">
      <span class="group-name">{groupName}</span>
      <div class="group-tags">
        {#each tags as tag}
          <button
            class="tag-btn"
            class:selected={selectedTags.includes(tag)}
            onclick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .tag-picker {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tag-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .group-name {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .group-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s ease;
  }

  .tag-btn:hover {
    background: var(--hover-bg);
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .tag-btn.selected {
    background: var(--primary-bg);
    border-color: var(--primary);
    color: var(--primary);
  }
</style>
