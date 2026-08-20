import { cn } from "@/lib/cn";

export function PercentSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 300,
  description,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-small font-medium text-text-primary">{label}</p>
        <p className="text-caption text-text-muted">{value}%</p>
      </div>
      {description && (
        <p className="mb-2 text-caption text-text-muted">{description}</p>
      )}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn("h-1.5 w-full cursor-pointer accent-accent")}
      />
    </div>
  );
}
