export function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} está digitando...`
      : names.length === 2
        ? `${names[0]} e ${names[1]} estão digitando...`
        : `${names[0]} e outras pessoas estão digitando...`;

  return (
    <div className="flex h-6 shrink-0 items-center gap-2 px-4 text-small text-text-secondary">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-text-secondary [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-text-secondary [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-text-secondary" />
      </span>
      {label}
    </div>
  );
}
