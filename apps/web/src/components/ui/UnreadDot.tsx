import { cn } from "@/lib/cn";

export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-label="Mensagem não lida"
      className={cn(
        "absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-bg-secondary",
        className,
      )}
    />
  );
}
