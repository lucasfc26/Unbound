import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

const GAP = 8;

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const positions: Record<TooltipSide, { top: number; left: number }> = {
      top: { top: rect.top - GAP, left: rect.left + rect.width / 2 },
      bottom: { top: rect.bottom + GAP, left: rect.left + rect.width / 2 },
      left: { top: rect.top + rect.height / 2, left: rect.left - GAP },
      right: { top: rect.top + rect.height / 2, left: rect.right + GAP },
    };

    setPosition(positions[side]);
    setVisible(true);
  }

  const translate: Record<TooltipSide, string> = {
    top: "-translate-x-1/2 -translate-y-full",
    bottom: "-translate-x-1/2",
    left: "-translate-x-full -translate-y-1/2",
    right: "-translate-y-1/2",
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocus={show}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className={cn(
              "pointer-events-none fixed z-[200] whitespace-nowrap rounded-md border border-border bg-elevated px-2.5 py-1.5 text-caption text-text-primary shadow-md animate-fade-in",
              translate[side],
              className,
            )}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
