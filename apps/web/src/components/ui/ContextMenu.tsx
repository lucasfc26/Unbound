import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ContextMenuItem {
  type?: "item";
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  variant?: "default" | "danger";
  hidden?: boolean;
}

export interface ContextMenuSlider {
  type: "slider";
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  hidden?: boolean;
}

export interface ContextMenuSubmenu {
  type: "submenu";
  label: string;
  icon?: LucideIcon;
  hidden?: boolean;
  items: { label: string; onSelect: () => void }[];
}

export type ContextMenuEntry =
  | ContextMenuItem
  | ContextMenuSlider
  | ContextMenuSubmenu;

interface ContextMenuProps {
  items: ContextMenuEntry[];
  children: ReactNode;
  disabled?: boolean;
}

export function ContextMenu({ items, children, disabled }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleContextMenu(event: ReactMouseEvent) {
    if (disabled || visibleItems.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 240;
    const menuHeight = visibleItems.length * 40 + 16;
    const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    setPosition({ left: Math.max(8, left), top: Math.max(8, top) });
    setExpanded(null);
    setOpen(true);
  }

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={position}
            className="fixed z-[200] w-60 overflow-hidden rounded-md border border-border bg-elevated p-1 shadow-popover animate-scale-in"
          >
            {visibleItems.map((item) => {
              if (item.type === "slider") {
                return (
                  <div key={item.label} className="px-2.5 py-2">
                    <div className="mb-1 flex items-center justify-between text-caption text-text-muted">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <input
                      type="range"
                      min={item.min ?? 0}
                      max={item.max ?? 100}
                      value={item.value}
                      onChange={(event) =>
                        item.onChange(Number(event.target.value))
                      }
                      className="h-1.5 w-full cursor-pointer accent-accent"
                    />
                  </div>
                );
              }

              if (item.type === "submenu") {
                const isOpen = expanded === item.label;
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpanded(isOpen ? null : item.label);
                      }}
                      className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-small text-text-secondary hover:bg-hover hover:text-text-primary"
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>
                    {isOpen &&
                      item.items.map((sub) => (
                        <button
                          key={sub.label}
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpen(false);
                            sub.onSelect();
                          }}
                          className="flex w-full items-center rounded px-2.5 py-1.5 pl-8 text-left text-small text-text-secondary hover:bg-hover hover:text-text-primary"
                        >
                          {sub.label}
                        </button>
                      ))}
                  </div>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
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
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
