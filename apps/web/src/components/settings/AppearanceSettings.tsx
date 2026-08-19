import { useState } from "react";
import { cn } from "@/lib/cn";

type Theme = "dark" | "light" | "system";
type Density = "compact" | "normal" | "comfortable";

const themes: { id: Theme; label: string }[] = [
  { id: "dark", label: "Escuro" },
  { id: "light", label: "Claro" },
  { id: "system", label: "Sistema" },
];

const densities: { id: Density; label: string }[] = [
  { id: "compact", label: "Compacta" },
  { id: "normal", label: "Normal" },
  { id: "comfortable", label: "Confortável" },
];

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [density, setDensity] = useState<Density>("normal");

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
              selected={theme === option.id}
              disabled={option.id !== "dark"}
              onSelect={() => setTheme(option.id)}
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
              selected={density === option.id}
              onSelect={() => setDensity(option.id)}
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
