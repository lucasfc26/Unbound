import {
  Hash,
  Volume2,
  Bell,
  Users,
  Search,
  MoreHorizontal,
} from "lucide-react";
import type { Channel } from "@/types";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useUIStore } from "@/stores/useUIStore";

export function ChatHeader({ channel }: { channel: Channel }) {
  const toggleMemberSidebar = useUIStore((state) => state.toggleMemberSidebar);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
      {channel.type === "VOICE" ? (
        <Volume2 className="h-5 w-5 shrink-0 text-text-secondary" />
      ) : (
        <Hash className="h-5 w-5 shrink-0 text-text-secondary" />
      )}
      <span className="shrink-0 text-body font-semibold text-text-primary">
        {channel.name}
      </span>
      {channel.topic && (
        <>
          <div className="h-4 w-px shrink-0 bg-border" />
          <span className="truncate text-small text-text-secondary">
            {channel.topic}
          </span>
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip content="Notificações" side="bottom">
          <IconButton aria-label="Notificações" size="sm">
            <Bell className="h-4.5 w-4.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Lista de membros" side="bottom">
          <IconButton
            aria-label="Lista de membros"
            size="sm"
            onClick={toggleMemberSidebar}
          >
            <Users className="h-4.5 w-4.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Buscar" side="bottom">
          <IconButton aria-label="Buscar" size="sm">
            <Search className="h-4.5 w-4.5" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Mais opções" side="bottom">
          <IconButton aria-label="Mais opções" size="sm">
            <MoreHorizontal className="h-4.5 w-4.5" />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
}
