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

  function superellipse(t: number, size: number, n: number): [number, number] {
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = Math.sign(cos) * size * Math.pow(Math.abs(cos), 2 / n);
    const y = Math.sign(sin) * size * Math.pow(Math.abs(sin), 2 / n);
    return [x, y];
  }

  // Average frequency bins into bands (low → high)
  function getBands(freqData: Uint8Array, count: number, bufferLength: number): number[] {
    const bands: number[] = [];
    const usable = Math.floor(bufferLength * 0.65);
    const binsPerBand = Math.floor(usable / count);
    for (let b = 0; b < count; b++) {
      let sum = 0;
      const start = b * binsPerBand;
      for (let j = start; j < start + binsPerBand; j++) {
        sum += freqData[j] || 0;
      }
      bands.push(sum / binsPerBand / 255);
    }
    return bands;
  }

  // Rosé Pine palette for rings (inner → outer: bass → treble)
  const ringColors = [
    { r: 0.82, c: 0.07, h: 25 },   // Rose
    { r: 0.76, c: 0.10, h: 305 },   // Iris
    { r: 0.84, c: 0.12, h: 70 },    // Gold
    { r: 0.82, c: 0.06, h: 190 },   // Foam
    { r: 0.55, c: 0.08, h: 215 },   // Pine
    { r: 0.82, c: 0.07, h: 25 },    // Rose
    { r: 0.76, c: 0.10, h: 305 },   // Iris
    { r: 0.84, c: 0.12, h: 70 },    // Gold
  ];

  const ringCount = 8;
  const points = 160;

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
    const centerX = width / 2;
    const centerY = height / 2;

    // Fixed to match album art size (w-72 = 288px, half = 144px)
    const baseSize = 144;
    const squircleN = 5;
    const ringSpacing = baseSize * 0.035;

    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqData);

    const bands = getBands(freqData, ringCount, bufferLength);

    // Overall energy for glow
    let totalSum = 0;
    for (let i = 0; i < bufferLength; i++) totalSum += freqData[i];
    const energy = totalSum / bufferLength / 255;

    ctx.clearRect(0, 0, width, height);

    // Core glow behind album art — extends well past edges
    const coreSize = baseSize * (1.4 + energy * 0.3);
    const coreGradient = ctx.createRadialGradient(
      centerX, centerY, baseSize * 0.5,
      centerX, centerY, coreSize
    );
    coreGradient.addColorStop(0, `oklch(0.82 0.07 25 / ${0.25 + energy * 0.25})`);
    coreGradient.addColorStop(0.5, `oklch(0.76 0.10 305 / ${0.15 + energy * 0.15})`);
    coreGradient.addColorStop(1, 'oklch(0.76 0.10 305 / 0)');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const [sx, sy] = superellipse(t, coreSize, squircleN);
      if (i === 0) ctx.moveTo(centerX + sx, centerY + sy);
      else ctx.lineTo(centerX + sx, centerY + sy);
    }
    ctx.closePath();
    ctx.fill();

    // Draw rings from outermost (high freq) to innermost (low freq)
    for (let r = ringCount - 1; r >= 0; r--) {
      const bandValue = bands[r];
      const ringSize = baseSize + (r + 1) * ringSpacing + bandValue * baseSize * 0.15;
      const color = ringColors[r % ringColors.length];

      // Opacity scales with band energy
      const alpha = 0.1 + bandValue * 0.5;
      const lineWidth = 1 + bandValue * 1.5;

      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const t = (i / points) * Math.PI * 2;
        const [sx, sy] = superellipse(t, ringSize, squircleN);
        if (i === 0) ctx.moveTo(centerX + sx, centerY + sy);
        else ctx.lineTo(centerX + sx, centerY + sy);
      }
      ctx.closePath();

      ctx.strokeStyle = `oklch(${color.r} ${color.c} ${color.h} / ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

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
  class="pointer-events-none absolute inset-0 h-full w-full"
></canvas>
