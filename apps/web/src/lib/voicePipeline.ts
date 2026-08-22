import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import type { NoiseSuppressionMode } from "@/types";

/** RNNoise requires the AudioContext to run at 48kHz. */
const RNNOISE_SAMPLE_RATE = 48000;

let rnnoiseWasmPromise: Promise<ArrayBuffer> | null = null;

/** Loads (and caches) the RNNoise WASM binary. Safe to call from multiple pipelines — the returned ArrayBuffer is structured-cloned per AudioWorkletNode, not transferred, so it isn't detached by reuse. */
function loadRnnoiseWasm(): Promise<ArrayBuffer> {
  if (!rnnoiseWasmPromise) {
    rnnoiseWasmPromise = loadRnnoise({
      url: rnnoiseWasmPath,
      simdUrl: rnnoiseWasmSimdPath,
    }).catch((error) => {
      rnnoiseWasmPromise = null;
      throw error;
    });
  }
  return rnnoiseWasmPromise;
}

/** Sets up the RNNoise denoiser node for an AudioContext. Returns null (and logs) if AudioWorklet/WASM isn't available, so callers can fall back to running without ML noise reduction instead of breaking voice entirely. */
async function createRnnoiseNode(
  ctx: AudioContext,
): Promise<RnnoiseWorkletNode | null> {
  try {
    const [wasmBinary] = await Promise.all([
      loadRnnoiseWasm(),
      ctx.audioWorklet.addModule(rnnoiseWorkletPath),
    ]);
    return new RnnoiseWorkletNode(ctx, { maxChannels: 2, wasmBinary });
  } catch (error) {
    console.warn(
      "RNNoise indisponível — seguindo sem aprimoramento de áudio por IA",
      error,
    );
    return null;
  }
}

export interface VoicePipeline {
  outputStream: MediaStream;
  rawStream: MediaStream;
  setMicGain: (percent: number) => void;
  setNoise: (mode: NoiseSuppressionMode, gate: number) => void;
  setOpen: (open: boolean) => void;
  /** Current mic input level, normalized 0-1 RMS. Use `rmsToGatePercent` to compare against the manual noise-gate slider scale. */
  getLevel: () => number;
  dispose: () => void;
}

const GATE_RMS_MIN = 0.004;
const GATE_RMS_RANGE = 0.08;

/** Converts a manual noise-gate slider value (0-100) into the RMS threshold used by the gate. */
export function gatePercentToRms(percent: number): number {
  return GATE_RMS_MIN + (Math.max(0, Math.min(100, percent)) / 100) * GATE_RMS_RANGE;
}

/** Converts a measured RMS level into the same 0-100 scale as the manual noise-gate slider, so a live meter can be shown directly against it. */
export function rmsToGatePercent(rms: number): number {
  return Math.max(
    0,
    Math.min(100, ((rms - GATE_RMS_MIN) / GATE_RMS_RANGE) * 100),
  );
}

let active: VoicePipeline | null = null;

export function getVoicePipeline(): VoicePipeline | null {
  return active;
}

export function audioCaptureConstraints(
  deviceId: string | null,
  mode: NoiseSuppressionMode,
): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    noiseSuppression: mode === "auto",
    echoCancellation: true,
    autoGainControl: mode === "auto",
  };
}

export async function createVoicePipeline(
  rawStream: MediaStream,
  options: {
    micGain: number;
    noiseMode: NoiseSuppressionMode;
    noiseGate: number;
    open: boolean;
  },
): Promise<VoicePipeline> {
  active?.dispose();

  const ctx = new AudioContext({ sampleRate: RNNOISE_SAMPLE_RATE });
  const source = ctx.createMediaStreamSource(rawStream);
  const rnnoise = await createRnnoiseNode(ctx);
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  const gateGain = ctx.createGain();
  const userGain = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  // RNNoise (when available) sits right after capture, so the gate/meter
  // downstream reacts to the already-denoised signal.
  const cleaned = rnnoise ?? source;
  if (rnnoise) source.connect(rnnoise);
  cleaned.connect(highpass);
  highpass.connect(gateGain);
  gateGain.connect(userGain);
  userGain.connect(dest);
  cleaned.connect(analyser);

  let micGain = clampGain(options.micGain);
  let noiseMode = options.noiseMode;
  let noiseGate = options.noiseGate;
  let open = options.open;
  let raf = 0;
  const data = new Uint8Array(analyser.fftSize);

  let lastRms = 0;

  function applyStatic() {
    userGain.gain.value = micGain / 100;
    highpass.frequency.value =
      noiseMode === "manual" ? 80 + noiseGate * 1.5 : 80;
  }
  applyStatic();

  function tick() {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const sample of data) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    lastRms = Math.sqrt(sum / data.length);

    if (!open) {
      gateGain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    } else if (noiseMode === "manual") {
      const threshold = gatePercentToRms(noiseGate);
      const next = lastRms >= threshold ? 1 : 0;
      gateGain.gain.setTargetAtTime(next, ctx.currentTime, 0.02);
    } else {
      gateGain.gain.setTargetAtTime(1, ctx.currentTime, 0.015);
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const processedTrack = dest.stream.getAudioTracks()[0];
  const outputStream = new MediaStream();
  if (processedTrack) outputStream.addTrack(processedTrack);

  const pipeline: VoicePipeline = {
    outputStream,
    rawStream,
    setMicGain(percent) {
      micGain = clampGain(percent);
      applyStatic();
    },
    setNoise(mode, gate) {
      noiseMode = mode;
      noiseGate = Math.max(0, Math.min(100, Math.round(gate)));
      applyStatic();
      const track = rawStream.getAudioTracks()[0];
      track
        ?.applyConstraints(audioCaptureConstraints(null, mode))
        .catch(() => {});
    },
    setOpen(next) {
      open = next;
    },
    getLevel() {
      return lastRms;
    },
    dispose() {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
        rnnoise?.disconnect();
        rnnoise?.destroy();
        highpass.disconnect();
        gateGain.disconnect();
        userGain.disconnect();
        analyser.disconnect();
      } catch {
        // already torn down
      }
      ctx.close().catch(() => {});
      rawStream.getTracks().forEach((track) => track.stop());
      if (active === pipeline) active = null;
    },
  };

  active = pipeline;
  return pipeline;
}

function clampGain(value: number): number {
  return Math.max(0, Math.min(300, Math.round(value)));
}
