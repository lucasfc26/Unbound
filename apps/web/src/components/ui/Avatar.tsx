import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { StatusDot } from "./StatusDot";
import type { UserStatus } from "@/types";

interface AvatarProps {
  name: string;
  color: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  status?: UserStatus;
  speaking?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-caption",
  md: "h-10 w-10 text-small",
  lg: "h-14 w-14 text-subheading",
  xl: "h-20 w-20 text-heading",
};

const dotPosition = {
  sm: "-bottom-0.5 -right-0.5",
  md: "-bottom-0.5 -right-0.5",
  lg: "bottom-0.5 right-0.5",
  xl: "bottom-1 right-1",
};

export function Avatar({
  name,
  color,
  imageUrl,
  size = "md",
  status,
  speaking,
  className,
}: AvatarProps) {
  const src = resolveMediaUrl(imageUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-semibold text-white overflow-hidden select-none transition-shadow duration-150",
          sizeClasses[size],
          speaking && "ring-2 ring-success",
        )}
        style={{ backgroundColor: color }}
      >
        {src && !broken ? (
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          initials(name)
        )}
      </div>
      {status && (
        <StatusDot
          status={status}
          size={size === "sm" ? "sm" : "md"}
          className={cn("absolute", dotPosition[size])}
        />
      )}
    </div>
  );
}
