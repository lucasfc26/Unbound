import type { MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { isTauri } from "@tauri-apps/api/core";
import { openExternalUrl, unboundInviteRoute } from "@/lib/openExternalUrl";

export function ChatLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    const inviteRoute = unboundInviteRoute(href);
    if (inviteRoute && isTauri()) {
      navigate(inviteRoute);
      return;
    }
    await openExternalUrl(href);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
