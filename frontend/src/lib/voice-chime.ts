/**
 * Discord-style voice channel chimes, synthesized via the Web Audio API.
 *
 * No audio assets to bundle, no licensing concerns. Each chime is two
 * sine-wave notes with a fast attack and exponential decay — same
 * "boop boop" envelope as Discord's join/leave notifications:
 *   - join: ascending (E5 → A5)
 *   - leave: descending (A5 → E5)
 *
 * Browsers suspend AudioContexts until the first user gesture; because
 * both chimes are triggered by an explicit user click (Join button /
 * Leave button → onDisconnected), the context resumes cleanly when
 * needed.
 */

const E5 = 659.25;
const A5 = 880.0;

let cachedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (cachedContext) return cachedContext;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  cachedContext = new Ctor();
  return cachedContext;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playChime(notes: ReadonlyArray<{ freq: number; offset: number; duration: number }>): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  for (const note of notes) {
    playTone(ctx, note.freq, now + note.offset, note.duration, 0.18);
  }
}

/** Two ascending sine tones — fires on successful voice-room connect. */
export function playVoiceJoinChime(): void {
  playChime([
    { freq: E5, offset: 0, duration: 0.18 },
    { freq: A5, offset: 0.09, duration: 0.22 },
  ]);
}

/** Two descending sine tones — fires on voice-room disconnect. */
export function playVoiceLeaveChime(): void {
  playChime([
    { freq: A5, offset: 0, duration: 0.18 },
    { freq: E5, offset: 0.09, duration: 0.22 },
  ]);
}
