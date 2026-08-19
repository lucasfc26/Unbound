import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-accent">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h2 className="text-heading text-text-primary">{title}</h2>
      {description && (
        <p className="max-w-sm text-body text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
