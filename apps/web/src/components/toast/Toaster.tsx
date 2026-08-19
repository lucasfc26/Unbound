import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/stores/useToastStore";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";

const variantIcon: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const variantClasses: Record<ToastVariant, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = variantIcon[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className="flex items-start gap-2.5 rounded-md border border-border bg-elevated px-3.5 py-3 shadow-lg animate-toast-in"
          >
            <Icon
              className={cn(
                "mt-0.5 h-4.5 w-4.5 shrink-0",
                variantClasses[toast.variant],
              )}
            />
            <p className="flex-1 text-small text-text-primary">
              {toast.message}
            </p>
            <IconButton
              aria-label="Fechar notificação"
              size="sm"
              onClick={() => dismiss(toast.id)}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
