<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Play, Pause, Volume2, VolumeX, Disc3, Users, Headphones, Tag, ExternalLink } from '@lucide/svelte';
  import CircularVisualizer from '$lib/components/CircularVisualizer.svelte';
  import * as HoverCard from '$lib/components/ui/hover-card';
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

  interface ArtistInfo {
    found: boolean;
    name: string;
    bio: string;
    tags: string[];
    listeners: number;
    playcount: number;
    url: string;
  }

  let nowPlaying: NowPlaying | null = $state(null);
  let isPlaying = $state(false);
  let isMuted = $state(false);
  let volume = $state(0.8);
  let audioEl: HTMLAudioElement | undefined = $state();
  let artError = $state(false);
  let trackKey = $state(0);
  let prevArt: string | null = $state(null);
  let showPrevArt = $state(false);

  let artistInfo: ArtistInfo | null = $state(null);
  let artistLoading = $state(false);

  type StreamHealth = 'good' | 'buffering' | 'error' | 'idle';
  let streamHealth: StreamHealth = $state('idle');
  let streamUptime = $state(0);
  let streamStart = 0;
  let healthInterval: ReturnType<typeof setInterval> | null = null;

  function updateUptime() {
    if (!isPlaying || streamHealth !== 'good') return;
    streamUptime = Math.floor((Date.now() - streamStart) / 1000);
  }

  function startHealthMonitor() {
    if (healthInterval) return;
    healthInterval = setInterval(updateUptime, 1000);
  }

  function stopHealthMonitor() {
    if (healthInterval) {
      clearInterval(healthInterval);
      healthInterval = null;
    }
    streamHealth = 'idle';
    streamUptime = 0;
  }

  function formatUptime(s: number): string {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m < 60) return `${m}m${sec > 0 ? ` ${sec}s` : ''}`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }


  function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  async function loadArtistInfo() {
    if (artistInfo || artistLoading || !nowPlaying?.artist) return;
    artistLoading = true;
    try {
      const res = await fetch(`/api/artist-info?artist=${encodeURIComponent(nowPlaying.artist)}`);
      artistInfo = await res.json();
    } catch {
      artistInfo = null;
    }
    artistLoading = false;
  }

  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  function getStreamUrl(): string {
    return nowPlaying?.listenUrl || '';
  }

  function startStream() {
    if (!audioEl) return;
    const url = getStreamUrl();
    if (!url) return;
    connect(audioEl);
    resume();
    streamHealth = 'buffering';
    audioEl.src = url;
    audioEl.load();
    audioEl.play();
    isPlaying = true;
    startHealthMonitor();
  }

  function handleStreamError() {
    streamHealth = 'error';
    if (!isPlaying || !audioEl) return;
    if (retryTimeout) clearTimeout(retryTimeout);
    retryTimeout = setTimeout(() => {
      if (isPlaying && audioEl) {
        const url = getStreamUrl();
        if (!url) return;
        streamHealth = 'buffering';
        audioEl.src = url;
        audioEl.load();
        audioEl.play();
      }
    }, 3000);
  }

  function handleWaiting() {
    if (isPlaying) streamHealth = 'buffering';
  }

  function handlePlaying() {
    streamHealth = 'good';
    streamStart = Date.now();
    streamUptime = 0;
  }

  function togglePlay() {
    if (!audioEl) return;

    if (isPlaying) {
      if (retryTimeout) clearTimeout(retryTimeout);
      audioEl.pause();
      audioEl.src = '';
      isPlaying = false;
      stopHealthMonitor();
    } else {
      startStream();
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
    const es = new EventSource('/api/now-playing/stream');

    es.onmessage = (event) => {
      try {
        const data: NowPlaying = JSON.parse(event.data);
        const changed = data.artist !== nowPlaying?.artist || data.track !== nowPlaying?.track;
        if (changed) {
          prevArt = nowPlaying?.albumArt || null;
          showPrevArt = !!prevArt;
          if (showPrevArt) {
            setTimeout(() => { showPrevArt = false; }, 800);
          }
          artError = false;
          trackKey++;
          artistInfo = null;
        }
        nowPlaying = data;
      } catch { /* ignore parse errors */ }
    };

    const closeAll = () => {
      es.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      stopHealthMonitor();
      cleanup();
    };

    window.addEventListener('beforeunload', closeAll);

    return () => {
      window.removeEventListener('beforeunload', closeAll);
      closeAll();
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
        <!-- Previous art fading out -->
        {#if showPrevArt && prevArt}
          <img
            out:fade={{ duration: 600 }}
            src={prevArt}
            alt=""
            class="absolute inset-0 z-10 h-full w-full object-cover"
          />
        {/if}

        <!-- Current art fading in -->
        {#key trackKey}
          {#if nowPlaying?.albumArt && !artError}
            <img
              in:fade={{ duration: 600 }}
              src={nowPlaying.albumArt}
              alt="Album art"
              class="absolute inset-0 h-full w-full object-cover"
              onerror={() => artError = true}
            />
          {:else}
            <div
              in:fade={{ duration: 600 }}
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

            <!-- Artist with hover card -->
            <div
              in:fly={{ y: 15, duration: 500, delay: 300 }}
              out:fade={{ duration: 200 }}
            >
              <HoverCard.Root openDelay={300}>
                <HoverCard.Trigger
                  class="text-lg text-muted-foreground underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/50 cursor-pointer"
                  onpointerenter={loadArtistInfo}
                >
                  {nowPlaying.artist || 'Unknown Artist'}
                </HoverCard.Trigger>
                <HoverCard.Content side="bottom" class="w-80">
                  {#if artistLoading}
                    <p class="text-muted-foreground text-sm">Loading...</p>
                  {:else if artistInfo?.found}
                    <div class="flex flex-col gap-2">
                      {#if artistInfo.bio}
                        <p class="text-muted-foreground text-xs leading-relaxed line-clamp-3">{artistInfo.bio}</p>
                      {/if}
                      {#if artistInfo.tags.length}
                        <div class="flex flex-wrap gap-1">
                          {#each artistInfo.tags as tag}
                            <span class="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              <Tag class="h-2.5 w-2.5" />{tag}
                            </span>
                          {/each}
                        </div>
                      {/if}
                      <div class="flex items-center gap-3 text-xs text-muted-foreground">
                        <span class="flex items-center gap-1">
                          <Users class="h-3 w-3" />{formatNumber(artistInfo.listeners)} listeners
                        </span>
                        <span class="flex items-center gap-1">
                          <Headphones class="h-3 w-3" />{formatNumber(artistInfo.playcount)} plays
                        </span>
                        {#if artistInfo.url}
                          <a
                            href={artistInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ml-auto text-muted-foreground transition-colors hover:text-primary"
                          >
                            <ExternalLink class="h-3.5 w-3.5" />
                          </a>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <p class="text-muted-foreground text-sm">No info available</p>
                  {/if}
                </HoverCard.Content>
              </HoverCard.Root>
            </div>

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
          class="flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-40 {isPlaying ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}"
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
            <span
              class="h-1.5 w-1.5 rounded-full"
              class:bg-primary={streamHealth === 'good'}
              class:animate-pulse={streamHealth === 'good'}
              class:bg-yellow-500={streamHealth === 'buffering'}
              class:animate-bounce={streamHealth === 'buffering'}
              class:bg-red-500={streamHealth === 'error'}
            ></span>
            {#if streamHealth === 'good'}
              Live
            {:else if streamHealth === 'buffering'}
              Buffering
            {:else if streamHealth === 'error'}
              Reconnecting
            {/if}
            {#if nowPlaying?.listeners}
              <span class="text-muted-foreground/60">({nowPlaying.listeners} listening)</span>
            {/if}
            {#if streamHealth === 'good' && streamUptime > 0}
              <span class="text-muted-foreground/40">{formatUptime(streamUptime)}</span>
            {/if}
          </span>
        {/if}
      </div>
    </div>
  </div>
</div>

<audio
  bind:this={audioEl}
  crossorigin="anonymous"
  preload="none"
  onerror={handleStreamError}
  onwaiting={handleWaiting}
  onplaying={handlePlaying}
></audio>
