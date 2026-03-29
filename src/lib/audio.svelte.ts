let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaElementAudioSourceNode | null = null;
let connected = false;

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

export function isConnected(): boolean {
  return connected;
}

export function connect(audioEl: HTMLAudioElement) {
  if (connected) return;

  try {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.88;

    source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    connected = true;
  } catch {
    connected = false;
  }
}

export function resume() {
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
}

export function cleanup() {
  if (source) source.disconnect();
  if (analyser) analyser.disconnect();
  if (audioCtx) audioCtx.close();
  audioCtx = null;
  analyser = null;
  source = null;
  connected = false;
}
