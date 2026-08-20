import { useSettingsStore } from "@/stores/useSettingsStore";

let ctx: AudioContext | null = null;
let unlockInstalled = false;

function getCtx(): AudioContext | null {
  try {
    return ctx ?? (ctx = new AudioContext({ latencyHint: "interactive" }));
  } catch {
    return null;
  }
}

function soundsEnabled(): boolean {
  return useSettingsStore.getState().settings?.notificationSound ?? true;
}

/** Resume Web Audio so cues can play after async work (join) and on every click. */
export async function unlockVoiceAudio(): Promise<void> {
  installUnlockListeners();
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    await audioCtx.resume().catch(() => {});
  }
}

function installUnlockListeners(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    void unlockVoiceAudio();
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

installUnlockListeners();

/** A short synthesized "ping" — avoids needing to ship/host an audio file asset. */
export function playNotificationSound(): void {
  void playTones([{ freq: 880, duration: 0.3, delay: 0 }]);
}

export type VoiceCue =
  | "join"
  | "leave"
  | "move"
  | "stream"
  | "watch"
  | "mute"
  | "unmute"
  | "deafen";

const VOICE_CUES: Record<
  VoiceCue,
  { freq: number; duration: number; delay: number }[]
> = {
  join: [
    { freq: 523, duration: 0.1, delay: 0 },
    { freq: 784, duration: 0.16, delay: 0.09 },
  ],
  leave: [
    { freq: 784, duration: 0.1, delay: 0 },
    { freq: 523, duration: 0.18, delay: 0.09 },
  ],
  move: [
    { freq: 440, duration: 0.09, delay: 0 },
    { freq: 554, duration: 0.09, delay: 0.08 },
    { freq: 659, duration: 0.14, delay: 0.16 },
  ],
  stream: [
    { freq: 660, duration: 0.08, delay: 0 },
    { freq: 880, duration: 0.1, delay: 0.07 },
    { freq: 1174, duration: 0.12, delay: 0.15 },
  ],
  watch: [
    { freq: 740, duration: 0.08, delay: 0 },
    { freq: 988, duration: 0.14, delay: 0.07 },
  ],
  mute: [{ freq: 330, duration: 0.12, delay: 0 }],
  unmute: [{ freq: 523, duration: 0.1, delay: 0 }],
  deafen: [
    { freq: 330, duration: 0.08, delay: 0 },
    { freq: 220, duration: 0.14, delay: 0.07 },
  ],
};

const VOICE_CUE_KINDS = new Set<string>(Object.keys(VOICE_CUES));

export function isVoiceCue(value: string): value is VoiceCue {
  return VOICE_CUE_KINDS.has(value);
}

export function playVoiceCue(kind: VoiceCue): void {
  void playTones(VOICE_CUES[kind]);
}

async function playTones(
  notes: { freq: number; duration: number; delay?: number }[],
): Promise<void> {
  if (!soundsEnabled()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  try {
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    if (audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    for (const note of notes) {
      const start = now + (note.delay ?? 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + note.duration + 0.02);
    }
  } catch {
    // audio unavailable (e.g. no user gesture yet) — skip silently
  }
}
