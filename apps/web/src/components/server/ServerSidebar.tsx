import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Plus, Compass } from "lucide-react";
import { useServerStore } from "@/stores/useServerStore";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { CreateServerModal } from "@/components/modal/CreateServerModal";
import { useFriendsStore } from "@/stores/useFriendsStore";

export function ServerSidebar() {
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  const servers = useServerStore((state) => state.servers);
  const channels = useServerStore((state) => state.channels);
  const addServer = useServerStore((state) => state.addServer);
  const fetchServers = useServerStore((state) => state.fetchServers);
  const pushToast = useToastStore((state) => state.push);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetchServers().catch(() =>
      pushToast("error", "Não foi possível carregar seus servidores"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav
      aria-label="Servidores"
      className="flex h-full min-h-0 w-18 shrink-0 flex-col items-center gap-2 overflow-y-auto bg-bg-secondary py-3"
    >
      <Tooltip content="Início" side="right">
        <NavLink
          to="/app/friends"
          className={({ isActive }) =>
            cn(
              "relative flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-accent transition-all duration-150 hover:rounded-lg hover:bg-accent hover:text-white",
              isActive && "rounded-lg bg-accent text-white",
            )
          }
        >
          <Compass className="h-6 w-6" />
          <IncomingFriendsBadge />
        </NavLink>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <ul className="flex w-full flex-col items-center gap-2">
        {servers.map((server) => (
          <li key={server.id} className="relative w-full flex justify-center">
            {serverId === server.id && (
              <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white" />
            )}
            <ServerItem
              id={server.id}
              name={server.name}
              color={server.iconColor}
              imageUrl={server.iconUrl}
              active={serverId === server.id}
              onSelect={() => {
                const firstChannel = channels
                  .filter((channel) => channel.serverId === server.id)
                  .sort((a, b) => a.position - b.position)[0];
                navigate(
                  firstChannel
                    ? `/app/server/${server.id}/channel/${firstChannel.id}`
                    : `/app/server/${server.id}`,
                );
              }}
            />
          </li>
        ))}
      </ul>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip content="Criar servidor" side="right">
        <IconButton
          aria-label="Criar servidor"
          variant="surface"
          className="h-12 w-12 rounded-xl text-success hover:rounded-lg hover:bg-success hover:text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </IconButton>
      </Tooltip>

      <CreateServerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          try {
            const server = await addServer(input);
            setCreateOpen(false);
            pushToast("success", "Servidor criado");
            navigate(`/app/server/${server.id}`);
          } catch (error) {
            pushToast(
              "error",
              error instanceof ApiError
                ? error.message
                : "Não foi possível criar o servidor",
            );
          }
        }}
      />
    </nav>
  );
}

interface ServerItemProps {
  id: string;
  name: string;
  color: string;
  imageUrl: string | null;
  active: boolean;
  onSelect: () => void;
}

function IncomingFriendsBadge() {
  const count = useFriendsStore((state) => state.incomingRequests.length);
  if (count === 0) return null;
  return (
    <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

function ServerItem({ id, name, color, imageUrl, active, onSelect }: ServerItemProps) {
  const src = resolveMediaUrl(imageUrl);
  return (
    <Tooltip content={name} side="right">
      <button
        onClick={onSelect}
        aria-label={name}
        aria-current={active}
        data-server-id={id}
        className={cn(
          "group relative flex h-12 w-12 items-center justify-center overflow-hidden text-body font-semibold text-white transition-all duration-150 hover:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          active ? "rounded-lg" : "rounded-xl",
        )}
        style={{ backgroundColor: color }}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          name
            .split(" ")
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase()
        )}
      </button>
    </Tooltip>
  );
}
