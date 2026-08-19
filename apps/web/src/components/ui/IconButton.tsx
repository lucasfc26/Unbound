import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type IconButtonVariant = "ghost" | "surface" | "active" | "danger";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  "aria-label": string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost:
    "bg-transparent text-text-secondary hover:bg-hover hover:text-text-primary",
  surface:
    "bg-surface text-text-secondary hover:bg-hover hover:text-text-primary border border-border",
  active: "bg-accent/15 text-accent hover:bg-accent/25",
  danger: "bg-transparent text-danger hover:bg-danger/15",
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-8 w-8 rounded-md [&_svg]:h-4 [&_svg]:w-4",
  md: "h-10 w-10 rounded-md [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-12 w-12 rounded-lg [&_svg]:h-5 [&_svg]:w-5",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center shrink-0 transition-colors duration-150",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
