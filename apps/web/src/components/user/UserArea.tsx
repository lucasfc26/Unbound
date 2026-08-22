import { useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Settings,
  User,
  LogOut,
  Volume2,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useServerStore } from "@/stores/useServerStore";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { statusLabels } from "@/lib/status";
import type { UserStatus } from "@/types";

const STATUS_MENU_OPTIONS: { status: UserStatus; label: string }[] = [
  { status: "ONLINE", label: "🟢 Ativo" },
  { status: "IDLE", label: "🌙 Ausente" },
  { status: "DO_NOT_DISTURB", label: "⛔ Não perturbe" },
  { status: "INVISIBLE", label: "⚪ Invisível" },
];

export function UserArea() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setStatus = useAuthStore((state) => state.setStatus);
  const pushToast = useToastStore((state) => state.push);
  const micEnabled = useVoiceStore((state) => state.micEnabled);
  const deafened = useVoiceStore((state) => state.deafened);
  const pttHeld = useVoiceStore((state) => state.pttHeld);
  const toggleMic = useVoiceStore((state) => state.toggleMic);
  const toggleDeafen = useVoiceStore((state) => state.toggleDeafen);
  const leaveCall = useVoiceStore((state) => state.leave);
  const pttEnabled = useSettingsStore(
    (state) => state.settings?.pushToTalkEnabled ?? false,
  );

  if (!user) return null;

  async function handleLogout() {
    leaveCall();
    await logout();
    pushToast("success", "Você saiu da sua conta");
    navigate("/login");
  }

  return (
    <div className="shrink-0">
      <VoiceConnectionBar />
      <div className="flex h-14 items-center gap-2 border-t border-black/20 bg-bg-secondary px-2">
        <DropdownMenu
          trigger={
            <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-hover">
              <Avatar
                name={user.displayName}
                color={user.avatarColor}
                imageUrl={user.avatarUrl}
                status={user.status}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-medium text-text-primary">
                  {user.displayName}
                </span>
                <span className="block truncate text-caption text-text-muted">
                  {user.customStatus ?? statusLabels[user.status]}
                </span>
              </span>
            </button>
          }
          items={[
            ...STATUS_MENU_OPTIONS.map(({ status, label }) => ({
              label,
              onSelect: () => setStatus(status),
            })),
            {
              label: "Perfil",
              icon: User,
              onSelect: () => navigate("/app/settings/perfil"),
            },
            {
              label: "Configurações",
              icon: Settings,
              onSelect: () => navigate("/app/settings"),
            },
            {
              label: "Sair",
              icon: LogOut,
              variant: "danger",
              onSelect: handleLogout,
            },
          ]}
        />

        <Tooltip
          content={
            pttEnabled
              ? pttHeld
                ? "Solte para silenciar"
                : "Push to talk — segure o atalho para falar"
              : micEnabled
                ? "Mutar microfone"
                : "Ativar microfone"
          }
        >
          <IconButton
            aria-label={
              pttEnabled
                ? "Push to talk"
                : micEnabled
                  ? "Mutar microfone"
                  : "Ativar microfone"
            }
            size="sm"
            variant={
              pttEnabled
                ? pttHeld
                  ? "ghost"
                  : "danger"
                : micEnabled
                  ? "ghost"
                  : "danger"
            }
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

        <Tooltip content="Configurações">
          <IconButton
            aria-label="Configurações"
            size="sm"
            onClick={() => navigate("/app/settings")}
          >
            <Settings className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

function VoicePingLine() {
  const serverPingMs = useVoiceStore((state) => state.serverPingMs);
  const p2pPingMs = useVoiceStore((state) => state.p2pPingMs);
  const serverLabel =
    serverPingMs == null ? "—" : `${Math.round(serverPingMs)} ms`;
  const p2pLabel = p2pPingMs == null ? null : `${Math.round(p2pPingMs)} ms`;
  return (
    <span className="block truncate text-caption text-text-muted">
      Ping {serverLabel}
      {p2pLabel ? ` · P2P ${p2pLabel}` : ""}
    </span>
  );
}

function VoiceConnectionBar() {
  const navigate = useNavigate();
  const activeChannelId = useVoiceStore((state) => state.activeChannelId);
  const channels = useServerStore((state) => state.channels);
  const servers = useServerStore((state) => state.servers);

  if (!activeChannelId) return null;

  const channel = channels.find((item) => item.id === activeChannelId);
  const server = servers.find((item) => item.id === channel?.serverId);

  return (
    <div className="border-t border-black/20 bg-bg-secondary px-2 py-2">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-hover"
        onClick={() => {
          if (channel) {
            navigate(`/app/server/${channel.serverId}/voice/${channel.id}`);
          }
        }}
      >
        <Volume2 className="h-4 w-4 shrink-0 text-success" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-semibold text-success">
            Voz conectada
          </span>
          <span className="block truncate text-caption text-text-muted">
            {channel?.name ?? "Canal de voz"}
            {server ? ` / ${server.name}` : ""}
          </span>
          <VoicePingLine />
        </span>
      </button>
    </div>
  );
}
