import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Headphones, Video } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { useToastStore } from "@/stores/useToastStore";
import { useDeviceStore } from "@/stores/useDeviceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { getVoicePipeline } from "@/lib/voicePipeline";
import { PercentSlider } from "./PercentSlider";
import { KeybindCapture } from "./KeybindCapture";
import type { Keybind } from "@/types";

const supportsSinkId =
  typeof window !== "undefined" &&
  typeof HTMLMediaElement.prototype.setSinkId === "function";

export function VoiceSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);

  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
  }, [settings, fetchSettings]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const refreshDevices = useCallback(async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list);
    setPermissionGranted(list.some((device) => device.label !== ""));
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () =>
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        refreshDevices,
      );
  }, [refreshDevices]);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      await refreshDevices();
    } catch {
      useToastStore
        .getState()
        .push("error", "Não foi possível acessar o microfone e a câmera");
    }
  }, [refreshDevices]);

  const mics = devices.filter((device) => device.kind === "audioinput");
  const speakers = devices.filter((device) => device.kind === "audiooutput");
  const cameras = devices.filter((device) => device.kind === "videoinput");

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Voz e vídeo</h1>

      {!permissionGranted && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5">
          <p className="text-small text-text-secondary">
            Conceda acesso ao microfone e à câmera para ver os nomes dos seus
            dispositivos e testá-los.
          </p>
          <Button size="sm" onClick={requestPermission}>
            Conceder acesso
          </Button>
        </div>
      )}

      <MicSection devices={mics} />
      <SpeakerSection devices={speakers} />
      <CameraSection devices={cameras} />
    </div>
  );
}

function DeviceSelect({
  devices,
  value,
  onChange,
  fallbackLabel,
  disabled,
}: {
  devices: MediaDeviceInfo[];
  value: string | null;
  onChange: (id: string | null) => void;
  fallbackLabel: string;
  disabled?: boolean;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary outline-none focus:border-accent disabled:opacity-50"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">Padrão do sistema</option>
      {devices.map((device, index) => (
        <option key={device.deviceId} value={device.deviceId}>
          {device.label || `${fallbackLabel} ${index + 1}`}
        </option>
      ))}
    </select>
  );
}

function MicSection({ devices }: { devices: MediaDeviceInfo[] }) {
  const micDeviceId = useDeviceStore((state) => state.micDeviceId);
  const setMicDevice = useDeviceStore((state) => state.setMicDevice);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const stopTest = useCallback(() => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setTesting(false);
  }, []);

  useEffect(() => () => stopTest(), [stopTest]);

  const startTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (const sample of data) {
          const centered = sample - 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        setLevel(Math.min(100, Math.round((rms / 128) * 300)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
    } catch {
      useToastStore
        .getState()
        .push("error", "Não foi possível acessar o microfone");
    }
  }, [micDeviceId]);

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
        <Mic className="h-3.5 w-3.5" />
        Microfone
      </h2>
      <DeviceSelect
        devices={devices}
        value={micDeviceId}
        onChange={setMicDevice}
        fallbackLabel="Microfone"
      />

      <MicProcessingControls />

      <p className="mb-1.5 mt-4 text-caption font-semibold uppercase tracking-wide text-text-muted">
        Entrada
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-success transition-[width] duration-75"
          style={{ width: `${level}%` }}
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={testing ? stopTest : startTest}
      >
        {testing ? "Parar teste" : "Testar microfone"}
      </Button>
    </section>
  );
}

function SpeakerSection({ devices }: { devices: MediaDeviceInfo[] }) {
  const speakerDeviceId = useDeviceStore((state) => state.speakerDeviceId);
  const setSpeakerDevice = useDeviceStore((state) => state.setSpeakerDevice);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const stopTone = useCallback(() => {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
    oscRef.current?.stop();
    oscRef.current?.disconnect();
    oscRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => () => stopTone(), [stopTone]);

  const playTone = useCallback(async () => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 440;
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    oscRef.current = osc;

    const audioEl = audioRef.current;
    if (!audioEl) return;
    audioEl.srcObject = dest.stream;

    if (speakerDeviceId && typeof audioEl.setSinkId === "function") {
      try {
        await audioEl.setSinkId(speakerDeviceId);
      } catch {
        useToastStore
          .getState()
          .push("error", "Não foi possível usar esse dispositivo de saída");
      }
    }

    try {
      await audioEl.play();
      setPlaying(true);
      timeoutRef.current = window.setTimeout(stopTone, 2000);
    } catch {
      stopTone();
    }
  }, [speakerDeviceId, stopTone]);

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
        <Headphones className="h-3.5 w-3.5" />
        Fone / alto-falante
      </h2>
      <DeviceSelect
        devices={devices}
        value={speakerDeviceId}
        onChange={setSpeakerDevice}
        fallbackLabel="Saída"
        disabled={!supportsSinkId}
      />
      {!supportsSinkId && (
        <p className="mt-2 text-caption text-text-muted">
          Este navegador não permite escolher o dispositivo de saída — o som
          sempre usa a saída padrão do sistema.
        </p>
      )}

      <OutputGainControl />

      <audio ref={audioRef} className="hidden" />

      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={playing ? stopTone : playTone}
      >
        {playing ? "Tocando..." : "Tocar som de teste"}
      </Button>
    </section>
  );
}

function CameraSection({ devices }: { devices: MediaDeviceInfo[] }) {
  const cameraDeviceId = useDeviceStore((state) => state.cameraDeviceId);
  const setCameraDevice = useDeviceStore((state) => state.setCameraDevice);
  const [testing, setTesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTest = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTesting(false);
  }, []);

  useEffect(() => () => stopTest(), [stopTest]);

  const startTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId } }
          : true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setTesting(true);
    } catch {
      useToastStore
        .getState()
        .push("error", "Não foi possível acessar a câmera");
    }
  }, [cameraDeviceId]);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
        <Video className="h-3.5 w-3.5" />
        Câmera
      </h2>
      <DeviceSelect
        devices={devices}
        value={cameraDeviceId}
        onChange={setCameraDevice}
        fallbackLabel="Câmera"
      />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "mt-3 aspect-video w-full rounded-md border border-border bg-black object-cover",
          !testing && "hidden",
        )}
      />

      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={testing ? stopTest : startTest}
      >
        {testing ? "Parar teste" : "Testar câmera"}
      </Button>
    </section>
  );
}

function useDebouncedUpdate() {
  const update = useSettingsStore((state) => state.update);
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );
  return (patch: Parameters<typeof update>[0]) => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      update(patch).catch(() => {});
    }, 350);
  };
}

function MicProcessingControls() {
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const syncMic = useVoiceStore((state) => state.syncMic);
  const save = useDebouncedUpdate();
  if (!settings) return null;

  const auto = settings.noiseSuppressionMode === "auto";

  return (
    <>
      <PercentSlider
        label="Ganho do microfone"
        description="Amplifica o que seus amigos escutam da sua voz, de 0% a 300%."
        value={settings.micGain}
        onChange={(micGain) => {
          useSettingsStore.getState().patchLocal({ micGain });
          save({ micGain });
        }}
      />

      <div className="mt-4 rounded-md border border-border bg-surface px-3.5">
        <Toggle
          label="Filtro de ruído automático"
          description="O sistema remove ruído do microfone. Desative para ajustar o filtro manualmente."
          checked={auto}
          onChange={(checked) => {
            const noiseSuppressionMode = checked ? "auto" : "manual";
            getVoicePipeline()?.setNoise(noiseSuppressionMode, settings.noiseGate);
            void update({ noiseSuppressionMode });
          }}
        />
      </div>

      {!auto && (
        <PercentSlider
          label="Filtro de ruído manual"
          description="Quanto maior, mais agressivo o corte de ruído de fundo."
          value={settings.noiseGate}
          min={0}
          max={100}
          onChange={(noiseGate) => {
            useSettingsStore.getState().patchLocal({ noiseGate });
            save({ noiseGate });
          }}
        />
      )}

      <div className="mt-4 rounded-md border border-border bg-surface px-3.5">
        <Toggle
          label="Push to talk"
          description="O microfone só abre enquanto você segura o atalho."
          checked={settings.pushToTalkEnabled}
          onChange={(checked) => {
            void update({ pushToTalkEnabled: checked }).then(() => syncMic());
          }}
        />
      </div>
      {settings.pushToTalkEnabled && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-small text-text-secondary">Tecla de push to talk</p>
          <KeybindCapture
            value={settings.keybinds.pushToTalk}
            onChange={(next: Keybind | null) => {
              void update({
                keybinds: { ...settings.keybinds, pushToTalk: next },
              });
            }}
          />
        </div>
      )}
    </>
  );
}

function OutputGainControl() {
  const settings = useSettingsStore((state) => state.settings);
  const save = useDebouncedUpdate();
  if (!settings) return null;
  return (
    <PercentSlider
      label="Ganho do fone"
      description="Amplifica o que você escuta dos outros, de 0% a 300%."
      value={settings.outputGain}
      onChange={(outputGain) => {
        useSettingsStore.getState().patchLocal({ outputGain });
        save({ outputGain });
      }}
    />
  );
}
