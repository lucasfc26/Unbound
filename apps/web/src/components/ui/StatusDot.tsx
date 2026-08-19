import { cn } from "@/lib/cn";
import type { UserStatus } from "@/types";

interface StatusDotProps {
  status: UserStatus;
  size?: "sm" | "md";
  className?: string;
}

const statusClasses: Record<UserStatus, string> = {
  ONLINE: "bg-success",
  IDLE: "bg-idle",
  DO_NOT_DISTURB: "bg-danger",
  INVISIBLE: "bg-offline",
  OFFLINE: "bg-offline",
};

export function StatusDot({ status, size = "sm", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "block rounded-full ring-2 ring-bg-secondary",
        size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3",
        statusClasses[status],
        className,
      )}
      aria-hidden="true"
    />
  );
}
