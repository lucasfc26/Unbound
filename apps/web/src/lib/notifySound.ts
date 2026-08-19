let ctx: AudioContext | null = null;

/** A short synthesized "ping" — avoids needing to ship/host an audio file asset. */
export function playNotificationSound(): void {
  try {
    const audioCtx = ctx ?? (ctx = new AudioContext());
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // audio unavailable (e.g. no user gesture yet in this browser) — skip silently
  }
}
