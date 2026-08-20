import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-body font-medium text-text-primary">{label}</p>
        {description && (
          <p className="mt-0.5 text-small text-text-secondary">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors duration-150",
          "disabled:opacity-50 disabled:pointer-events-none",
          checked
            ? "bg-accent"
            : "bg-surface ring-1 ring-inset ring-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
