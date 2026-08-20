import { useNavigate, useLocation } from "react-router-dom";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  PhoneOff,
  Volume2,
} from "lucide-react";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useServerStore } from "@/stores/useServerStore";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";

export function VoiceCallWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeChannelId = useVoiceStore((state) => state.activeChannelId);
  const micEnabled = useVoiceStore((state) => state.micEnabled);
  const deafened = useVoiceStore((state) => state.deafened);
  const toggleMic = useVoiceStore((state) => state.toggleMic);
  const toggleDeafen = useVoiceStore((state) => state.toggleDeafen);
  const leave = useVoiceStore((state) => state.leave);
  const channels = useServerStore((state) => state.channels);
  const servers = useServerStore((state) => state.servers);

  if (!activeChannelId) return null;

  const onServerPage = location.pathname.startsWith("/app/server/");
  if (onServerPage) return null;

  const channel = channels.find((item) => item.id === activeChannelId);
  const server = servers.find((item) => item.id === channel?.serverId);

  return (
    <div className="pointer-events-none fixed bottom-4 left-[5.5rem] z-[150]">
      <div className="pointer-events-auto w-60 overflow-hidden rounded-lg border border-success/40 bg-bg-secondary shadow-popover">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover"
          onClick={() => {
            if (channel) {
              navigate(`/app/server/${channel.serverId}/voice/${channel.id}`);
            }
          }}
        >
          <Volume2 className="h-4 w-4 text-success" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-small font-semibold text-success">
              Voz conectada
            </span>
            <span className="block truncate text-caption text-text-muted">
              {channel?.name ?? "Canal de voz"}
              {server ? ` / ${server.name}` : ""}
            </span>
          </span>
        </button>
        <div className="flex items-center justify-end gap-1 border-t border-black/20 px-2 py-1.5">
          <Tooltip content={micEnabled ? "Mutar microfone" : "Ativar microfone"}>
            <IconButton
              aria-label={micEnabled ? "Mutar microfone" : "Ativar microfone"}
              size="sm"
              variant={micEnabled ? "ghost" : "danger"}
              onClick={toggleMic}
            >
              {micEnabled ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip content={deafened ? "Reativar áudio" : "Silenciar tudo"}>
            <IconButton
              aria-label={deafened ? "Reativar áudio" : "Silenciar tudo"}
              size="sm"
              variant={deafened ? "danger" : "ghost"}
              onClick={toggleDeafen}
            >
              {deafened ? (
                <HeadphoneOff className="h-4 w-4" />
              ) : (
                <Headphones className="h-4 w-4" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip content="Sair da chamada">
            <IconButton
              aria-label="Sair da chamada"
              size="sm"
              variant="danger"
              onClick={leave}
            >
              <PhoneOff className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
