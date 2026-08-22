import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Toggle } from "@/components/ui/Toggle";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import type {
  BroadcastCodec,
  BroadcastResolution,
  BroadcastTransport,
  MediaProfile,
} from "@/types";

const mediaProfiles: { id: MediaProfile; label: string; description: string }[] = [
  {
    id: "quality",
    label: "Qualidade",
    description:
      "Prioriza VP9 para tela e câmera — melhor nitidez e compressão, com mais uso de CPU no encode.",
  },
  {
    id: "gaming",
    label: "Desempenho para jogos",
    description:
      "Prioriza H264, acelerado por hardware na maioria das placas — imagem um pouco mais simples, mas libera CPU/GPU pro jogo e segura o FPS da transmissão.",
  },
];

const resolutions: { id: BroadcastResolution; label: string }[] = [
  { id: "480p", label: "480p" },
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
  { id: "native", label: "Nativa (sem reduzir)" },
];

const codecs: { id: BroadcastCodec; label: string; description: string }[] = [
  {
    id: "auto",
    label: "Automático",
    description: "Usa o codec indicado pelo perfil de mídia acima.",
  },
  {
    id: "vp8",
    label: "VP8",
    description: "Equilíbrio entre qualidade e desempenho, boa compatibilidade.",
  },
  {
    id: "vp9",
    label: "VP9",
    description: "Melhor qualidade de imagem por bit — exige mais CPU pra codificar.",
  },
  {
    id: "h264",
    label: "H264",
    description: "Acelerado por hardware na maioria dos dispositivos — menor uso de CPU.",
  },
];

const transports: { id: BroadcastTransport; label: string; description: string }[] = [
  {
    id: "auto",
    label: "Automático (servidor)",
    description:
      "Sempre via SFU — camadas de qualidade por espectador e pausa automática quando ninguém assiste.",
  },
  {
    id: "sfu",
    label: "Servidor (SFU)",
    description: "Mesmo caminho do automático, forçado explicitamente.",
  },
  {
    id: "p2p",
    label: "Direto (P2P)",
    description:
      "Envia sua tela direto pra cada participante, sem passar pelo servidor. Usa mais upload do seu link a cada espectador, não pausa sozinho quando ninguém assiste e não tem camadas de qualidade por pessoa — bom pra poucos espectadores.",
  },
];

export function BroadcastSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const update = useSettingsStore((state) => state.update);
  const pushToast = useToastStore((state) => state.push);

  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChange(
    input: Parameters<typeof update>[0],
    successMessage: string,
  ) {
    try {
      await update(input);
      pushToast("success", successMessage);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível salvar essa preferência",
      );
    }
  }

  if (!settings) {
    return (
      <p className="text-small text-text-secondary">
        Carregando configurações...
      </p>
    );
  }

  const manual = settings.broadcastMode === "manual";

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Transmissão</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Perfil de mídia
        </h2>
        <div className="flex flex-col gap-2">
          {mediaProfiles.map((option) => (
            <RadioRow
              key={option.id}
              label={option.label}
              description={option.description}
              selected={settings.mediaProfile === option.id}
              onSelect={() =>
                handleChange(
                  { mediaProfile: option.id },
                  "Perfil de mídia atualizado",
                )
              }
            />
          ))}
        </div>
        <p className="mt-2 text-caption text-text-muted">
          Vale pra microfone, câmera e tela — ajusta o codec e o bitrate de
          cada um.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Transmissão de tela
        </h2>
        <div className="rounded-md border border-border bg-surface px-3.5">
          <Toggle
            label="Automático"
            description="Resolução, bitrate, codec e transporte são escolhidos pelo perfil de mídia acima. Desative para ajustar manualmente."
            checked={!manual}
            onChange={(checked) =>
              handleChange(
                { broadcastMode: checked ? "auto" : "manual" },
                "Transmissão atualizada",
              )
            }
          />
        </div>

        {manual && (
          <div className="mt-4 flex flex-col gap-6">
            <div>
              <p className="mb-2 text-small font-medium text-text-primary">
                Resolução
              </p>
              <div className="flex flex-col gap-2">
                {resolutions.map((option) => (
                  <RadioRow
                    key={option.id}
                    label={option.label}
                    selected={settings.broadcastResolution === option.id}
                    onSelect={() =>
                      handleChange(
                        { broadcastResolution: option.id },
                        "Resolução atualizada",
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <BitrateSlider />

            <FpsSlider />

            <div>
              <p className="mb-2 text-small font-medium text-text-primary">
                Codec de vídeo
              </p>
              <div className="flex flex-col gap-2">
                {codecs.map((option) => (
                  <RadioRow
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    selected={settings.broadcastCodec === option.id}
                    onSelect={() =>
                      handleChange(
                        { broadcastCodec: option.id },
                        "Codec atualizado",
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-small font-medium text-text-primary">
                Transporte
              </p>
              <div className="flex flex-col gap-2">
                {transports.map((option) => (
                  <RadioRow
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    selected={settings.broadcastTransport === option.id}
                    onSelect={() =>
                      handleChange(
                        { broadcastTransport: option.id },
                        "Transporte atualizado",
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function BitrateSlider() {
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!settings) return null;

  function save(broadcastMaxBitrateKbps: number) {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      update({ broadcastMaxBitrateKbps }).catch(() => {});
    }, 350);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-small font-medium text-text-primary">
          Bitrate máximo
        </p>
        <p className="text-caption text-text-muted">
          {(settings.broadcastMaxBitrateKbps / 1000).toFixed(1)} Mbps
        </p>
      </div>
      <input
        type="range"
        min={300}
        max={8000}
        step={100}
        value={settings.broadcastMaxBitrateKbps}
        onChange={(event) => {
          const value = Number(event.target.value);
          useSettingsStore.getState().patchLocal({ broadcastMaxBitrateKbps: value });
          save(value);
        }}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
    </div>
  );
}

function FpsSlider() {
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!settings) return null;

  function save(broadcastFps: number) {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      update({ broadcastFps }).catch(() => {});
    }, 350);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-small font-medium text-text-primary">
          Taxa de quadros (FPS)
        </p>
        <p className="text-caption text-text-muted">
          {settings.broadcastFps} fps
        </p>
      </div>
      <input
        type="range"
        min={15}
        max={60}
        step={1}
        value={settings.broadcastFps}
        onChange={(event) => {
          const value = Number(event.target.value);
          useSettingsStore.getState().patchLocal({ broadcastFps: value });
          save(value);
        }}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
      <p className="mt-1 text-caption text-text-muted">
        Mais fps deixa a transmissão mais fluida (bom pra jogos rápidos), mas
        usa mais banda e CPU no encode.
      </p>
    </div>
  );
}

function RadioRow({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-hover",
        selected && "border-accent",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-accent" : "border-border-strong",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span>
        <span className="block text-body text-text-primary">{label}</span>
        {description && (
          <span className="mt-0.5 block text-caption text-text-muted">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
