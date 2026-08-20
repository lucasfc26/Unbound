import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlayClick?: boolean;
  /** Panel width. Only one max-w-* class is ever applied — never combine with className to avoid Tailwind cascade-order bugs. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Sit above another open modal (crop picker inside settings, etc). */
  nested?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnOverlayClick = true,
  size = "md",
  className,
  nested = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (nested) event.stopImmediatePropagation();
      onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown, nested);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown, nested);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus();
    };
    // Only re-run when the modal actually opens/closes — not when the caller
    // passes a fresh onClose closure on every render (which happens on every
    // keystroke in forms), or focus gets yanked away from inputs mid-typing.
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/60 p-4 animate-fade-in",
        nested ? "z-[70]" : "z-50",
      )}
      onMouseDown={(event) => {
        if (closeOnOverlayClick && event.target === event.currentTarget)
          onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          "w-full rounded-lg border border-border bg-elevated shadow-lg outline-none animate-scale-in",
          SIZE_CLASSES[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-subheading text-text-primary">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-small text-text-secondary">
                {description}
              </p>
            )}
          </div>
          <IconButton aria-label="Fechar" size="sm" onClick={onClose}>
            <X />
          </IconButton>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
