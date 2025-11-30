<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    active?: boolean;
    particleCount?: number;
  }

  let { active = false, particleCount = 50 }: Props = $props();

  let particles = $state<Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
    color: string;
    size: number;
    delay: number;
  }>>([]);

  const colors = ['#a855f7', '#f97316', '#10b981', '#3b82f6', '#f43f5e', '#eab308'];

  function createParticles() {
    particles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      rotation: Math.random() * 360,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
      delay: Math.random() * 0.5
    }));
  }

  $effect(() => {
    if (active) {
      createParticles();
      setTimeout(() => {
        particles = [];
      }, 3000);
    }
  });
</script>

{#if particles.length > 0}
  <div class="confetti-container">
    {#each particles as particle (particle.id)}
      <div
        class="confetti-particle"
        style:left="{particle.x}%"
        style:background={particle.color}
        style:width="{particle.size}px"
        style:height="{particle.size}px"
        style:animation-delay="{particle.delay}s"
        style:--rotation="{particle.rotation}deg"
      ></div>
    {/each}
  </div>
{/if}

<style>
  .confetti-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 9999;
  }

  .confetti-particle {
    position: absolute;
    border-radius: 2px;
    animation: confetti-fall 3s ease-out forwards;
  }

  @keyframes confetti-fall {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(var(--rotation, 720deg));
      opacity: 0;
    }
  }
</style>
