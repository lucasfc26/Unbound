import type { NoiseSuppressionMode } from "@/types";

export interface VoicePipeline {
  outputStream: MediaStream;
  rawStream: MediaStream;
  setMicGain: (percent: number) => void;
  setNoise: (mode: NoiseSuppressionMode, gate: number) => void;
  setOpen: (open: boolean) => void;
  dispose: () => void;
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

export function createVoicePipeline(
  rawStream: MediaStream,
  options: {
    micGain: number;
    noiseMode: NoiseSuppressionMode;
    noiseGate: number;
    open: boolean;
  },
): VoicePipeline {
  active?.dispose();

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(rawStream);
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  const gateGain = ctx.createGain();
  const userGain = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  source.connect(highpass);
  highpass.connect(gateGain);
  gateGain.connect(userGain);
  userGain.connect(dest);
  source.connect(analyser);

  let micGain = clampGain(options.micGain);
  let noiseMode = options.noiseMode;
  let noiseGate = options.noiseGate;
  let open = options.open;
  let raf = 0;
  const data = new Uint8Array(analyser.fftSize);

  function applyStatic() {
    userGain.gain.value = micGain / 100;
    highpass.frequency.value =
      noiseMode === "manual" ? 80 + noiseGate * 1.5 : 80;
  }
  applyStatic();

  function tick() {
    if (!open) {
      gateGain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    } else if (noiseMode === "manual") {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      const threshold = 0.004 + (noiseGate / 100) * 0.08;
      const next = rms >= threshold ? 1 : 0;
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
    dispose() {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
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
