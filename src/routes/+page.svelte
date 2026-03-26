<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Radio, Play, Pause, Volume2, VolumeX, Disc3 } from '@lucide/svelte';
  import CircularVisualizer from '$lib/components/CircularVisualizer.svelte';
  import { connect, resume, cleanup } from '$lib/audio.svelte';

  interface NowPlaying {
    playing: boolean;
    artist: string;
    track: string;
    album: string;
    albumArt: string | null;
    listenUrl: string;
    listeners: number;
  }

  let nowPlaying: NowPlaying | null = $state(null);
  let isPlaying = $state(false);
  let isMuted = $state(false);
  let volume = $state(0.8);
  let audioEl: HTMLAudioElement | undefined = $state();
  let artError = $state(false);
  let trackKey = $state(0);

  async function fetchNowPlaying() {
    try {
      const res = await fetch('/api/now-playing');
      const data: NowPlaying = await res.json();
      const changed = data.artist !== nowPlaying?.artist || data.track !== nowPlaying?.track;
      if (changed) {
        artError = false;
        trackKey++;
      }
      nowPlaying = data;
    } catch {
      nowPlaying = null;
    }
  }

  function togglePlay() {
    if (!audioEl) return;

    if (isPlaying) {
      audioEl.pause();
      audioEl.src = '';
      isPlaying = false;
    } else {
      connect(audioEl);
      resume();
      audioEl.src = '/api/stream';
      audioEl.load();
      audioEl.play();
      isPlaying = true;
    }
  }

  function toggleMute() {
    if (!audioEl) return;
    isMuted = !isMuted;
    audioEl.muted = isMuted;
  }

  function handleVolume(e: Event) {
    const target = e.target as HTMLInputElement;
    volume = parseFloat(target.value);
    if (audioEl) {
      audioEl.volume = volume;
    }
  }

  onMount(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10000);
    return () => {
      clearInterval(interval);
      cleanup();
    };
  });
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <div class="flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-12">
    <!-- Album Art with visualizer aura -->
    <div class="relative flex shrink-0 items-center justify-center" style="width: 500px; height: 500px;">
      {#if isPlaying}
        <CircularVisualizer {isPlaying} />
      {/if}

      <div class="relative z-10 aspect-square w-72 bg-card shadow-lg" style="clip-path: polygon(100.00% 50.00%, 99.94% 68.06%, 99.75% 73.81%, 99.44% 77.94%, 99.01% 81.26%, 98.44% 84.05%, 97.74% 86.46%, 96.91% 88.57%, 95.94% 90.43%, 94.81% 92.07%, 93.53% 93.53%, 92.07% 94.81%, 90.43% 95.94%, 88.57% 96.91%, 86.46% 97.74%, 84.05% 98.44%, 81.26% 99.01%, 77.94% 99.44%, 73.81% 99.75%, 68.06% 99.94%, 50.00% 100.00%, 31.94% 99.94%, 26.19% 99.75%, 22.06% 99.44%, 18.74% 99.01%, 15.95% 98.44%, 13.54% 97.74%, 11.43% 96.91%, 9.57% 95.94%, 7.93% 94.81%, 6.47% 93.53%, 5.19% 92.07%, 4.06% 90.43%, 3.09% 88.57%, 2.26% 86.46%, 1.56% 84.05%, 0.99% 81.26%, 0.56% 77.94%, 0.25% 73.81%, 0.06% 68.06%, 0.00% 50.00%, 0.06% 31.94%, 0.25% 26.19%, 0.56% 22.06%, 0.99% 18.74%, 1.56% 15.95%, 2.26% 13.54%, 3.09% 11.43%, 4.06% 9.57%, 5.19% 7.93%, 6.47% 6.47%, 7.93% 5.19%, 9.57% 4.06%, 11.43% 3.09%, 13.54% 2.26%, 15.95% 1.56%, 18.74% 0.99%, 22.06% 0.56%, 26.19% 0.25%, 31.94% 0.06%, 50.00% 0.00%, 68.06% 0.06%, 73.81% 0.25%, 77.94% 0.56%, 81.26% 0.99%, 84.05% 1.56%, 86.46% 2.26%, 88.57% 3.09%, 90.43% 4.06%, 92.07% 5.19%, 93.53% 6.47%, 94.81% 7.93%, 95.94% 9.57%, 96.91% 11.43%, 97.74% 13.54%, 98.44% 15.95%, 99.01% 18.74%, 99.44% 22.06%, 99.75% 26.19%, 99.94% 31.94%)">
        {#key trackKey}
          {#if nowPlaying?.albumArt && !artError}
            <img
              in:fade={{ duration: 600 }}
              out:fade={{ duration: 300 }}
              src={nowPlaying.albumArt}
              alt="Album art"
              class="absolute inset-0 h-full w-full object-cover"
              onerror={() => artError = true}
            />
          {:else}
            <div
              in:fade={{ duration: 600 }}
              out:fade={{ duration: 300 }}
              class="absolute inset-0 flex h-full w-full items-center justify-center bg-card"
            >
              <span class:animate-spin-slow={isPlaying}>
                <Disc3 class="h-24 w-24 text-muted-foreground/30" />
              </span>
            </div>
          {/if}
        {/key}
      </div>
    </div>

    <!-- Right column: track info + controls -->
    <div class="flex flex-col items-center gap-6 lg:items-start">
      <!-- Track Info -->
      <div class="flex flex-col items-center gap-1 text-center lg:items-start lg:text-left">
        {#if nowPlaying?.playing}
          {#key trackKey}
            <h1
              in:fly={{ y: 20, duration: 500, delay: 200 }}
              out:fade={{ duration: 200 }}
              class="text-2xl font-semibold leading-tight lg:text-3xl"
            >
              {nowPlaying.track || 'Unknown Track'}
            </h1>
            <p
              in:fly={{ y: 15, duration: 500, delay: 300 }}
              out:fade={{ duration: 200 }}
              class="text-lg text-muted-foreground"
            >
              {nowPlaying.artist || 'Unknown Artist'}
            </p>
            {#if nowPlaying.album}
              <p
                in:fly={{ y: 10, duration: 500, delay: 400 }}
                out:fade={{ duration: 200 }}
                class="text-sm text-muted-foreground/70"
              >
                {nowPlaying.album}
              </p>
            {/if}
          {/key}
        {:else}
          <h1 class="text-2xl font-semibold lg:text-3xl">Offline</h1>
          <p class="text-muted-foreground">No stream available</p>
        {/if}
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-4">
        <button
          onclick={togglePlay}
          disabled={!nowPlaying?.playing}
          class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {#if isPlaying}
            <Pause class="h-6 w-6" />
          {:else}
            <Play class="ml-0.5 h-6 w-6" />
          {/if}
        </button>

        <button
          onclick={toggleMute}
          class="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          {#if isMuted}
            <VolumeX class="h-5 w-5" />
          {:else}
            <Volume2 class="h-5 w-5" />
          {/if}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          oninput={handleVolume}
          class="w-28 accent-primary"
        />
      </div>

      <!-- Status -->
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        {#if isPlaying}
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></span>
            Live
          </span>
        {/if}
        {#if nowPlaying?.listeners}
          <span class="flex items-center gap-1.5">
            <Radio class="h-3 w-3" />
            {nowPlaying.listeners} listening
          </span>
        {/if}
      </div>
    </div>
  </div>
</div>

<audio bind:this={audioEl} crossorigin="anonymous" preload="none"></audio>
