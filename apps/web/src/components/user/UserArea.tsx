import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Settings,
  User,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
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
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    pushToast("success", "Você saiu da sua conta");
    navigate("/login");
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-t border-black/20 bg-bg-secondary px-2">
      <DropdownMenu
        trigger={
          <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-hover">
            <Avatar
              name={user.displayName}
              color={user.avatarColor}
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

      <Tooltip content={muted ? "Ativar microfone" : "Mutar microfone"}>
        <IconButton
          aria-label={muted ? "Ativar microfone" : "Mutar microfone"}
          size="sm"
          variant={muted ? "danger" : "ghost"}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </IconButton>
      </Tooltip>

      <Tooltip content={deafened ? "Reativar áudio" : "Silenciar tudo"}>
        <IconButton
          aria-label={deafened ? "Reativar áudio" : "Silenciar tudo"}
          size="sm"
          variant={deafened ? "danger" : "ghost"}
          onClick={() => setDeafened((value) => !value)}
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
  );
}
