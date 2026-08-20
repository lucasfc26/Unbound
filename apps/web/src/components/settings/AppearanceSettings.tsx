import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import type { DensityPreference, ThemePreference } from "@/types";

const themes: { id: ThemePreference; label: string; disabled?: boolean }[] = [
  { id: "dark", label: "Escuro" },
  { id: "light", label: "Claro", disabled: true },
  { id: "system", label: "Sistema", disabled: true },
];

const densities: { id: DensityPreference; label: string }[] = [
  { id: "compact", label: "Compacta" },
  { id: "normal", label: "Normal" },
  { id: "comfortable", label: "Confortável" },
];

export function AppearanceSettings() {
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

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Aparência</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Tema
        </h2>
        <div className="flex flex-col gap-2">
          {themes.map((option) => (
            <RadioRow
              key={option.id}
              label={option.label}
              selected={settings.theme === option.id}
              disabled={option.disabled}
              onSelect={() =>
                handleChange({ theme: option.id }, "Tema atualizado")
              }
            />
          ))}
        </div>
        <p className="mt-2 text-caption text-text-muted">
          O tema claro ainda não está disponível nesta versão.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Densidade
        </h2>
        <div className="flex flex-col gap-2">
          {densities.map((option) => (
            <RadioRow
              key={option.id}
              label={option.label}
              selected={settings.density === option.id}
              onSelect={() =>
                handleChange(
                  { density: option.id },
                  "Densidade da interface atualizada",
                )
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function RadioRow({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5 text-left text-body text-text-primary transition-colors duration-150 hover:bg-hover",
        "disabled:opacity-50 disabled:pointer-events-none",
        selected && "border-accent",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-accent" : "border-border-strong",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      {label}
    </button>
  );
}
