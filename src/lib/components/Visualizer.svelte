<script lang="ts">
  import { onMount } from 'svelte';
  import { getAnalyser } from '$lib/audio.svelte';

  let {
    isPlaying
  }: {
    isPlaying: boolean;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let ctx: CanvasRenderingContext2D | null = null;
  let animationId: number = 0;

  function draw() {
    const analyser = getAnalyser();
    if (!canvas || !ctx || !analyser) {
      animationId = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    const barCount = 48;
    const gap = 2;
    const barWidth = (width - gap * (barCount - 1)) / barCount;
    const centerY = height;

    const style = getComputedStyle(canvas);
    const primaryColor = style.getPropertyValue('color').trim();

    for (let i = 0; i < barCount; i++) {
      const binIndex = Math.floor((i / barCount) * bufferLength * 0.8);
      const value = dataArray[binIndex] || 0;
      const normalizedHeight = (value / 255) * height * 0.9;
      const barHeight = Math.max(2, normalizedHeight);

      const x = i * (barWidth + gap);
      const y = centerY - barHeight;

      const opacity = 0.3 + (value / 255) * 0.7;

      ctx.fillStyle = primaryColor || `rgba(235, 188, 186, ${opacity})`;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    animationId = requestAnimationFrame(draw);
  }

  $effect(() => {
    if (isPlaying) {
      animationId = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(animationId);
    }
  });

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
    }
    return () => cancelAnimationFrame(animationId);
  });
</script>

<canvas
  bind:this={canvas}
  class="h-full w-full text-primary"
></canvas>
