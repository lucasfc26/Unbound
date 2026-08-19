import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DropdownMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  variant?: "default" | "danger";
}

interface DropdownMenuProps {
  trigger: ReactElement;
  items: DropdownMenuItem[];
  align?: "start" | "end";
}

interface Position {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export function DropdownMenu({
  trigger,
  items,
  align = "start",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({});
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggle() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const openUpward = rect.top > window.innerHeight / 2;
      setPosition({
        ...(align === "end"
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    }
    setOpen((value) => !value);
  }

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ref: triggerRef,
        onClick: (event: React.MouseEvent) => {
          (
            trigger.props as { onClick?: (event: React.MouseEvent) => void }
          ).onClick?.(event);
          toggle();
        },
      })
    : trigger;

  return (
    <>
      {triggerElement}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={position}
            className="fixed z-[200] w-56 overflow-hidden rounded-md border border-border bg-elevated p-1 shadow-popover animate-scale-in"
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-small text-text-secondary hover:bg-hover hover:text-text-primary",
                  item.variant === "danger" &&
                    "text-danger hover:bg-danger/15 hover:text-danger",
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
