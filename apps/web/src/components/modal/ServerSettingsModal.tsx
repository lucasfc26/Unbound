import { useEffect, useRef, useState } from "react";
import { Settings2, Users, ShieldBan, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/useAuthStore";
import { useServerStore } from "@/stores/useServerStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import { ImageCropDialog } from "@/components/media/ImageCropDialog";
import { assertImageFile } from "@/lib/imageFile";
import { avatarColorFor } from "@/lib/avatarColor";
import {
  assignableRoles,
  canDeleteServer,
  canManageMember,
  ROLE_LABELS,
} from "@/lib/permissions";
import {
  banMember,
  kickMember,
  listBans,
  unbanMember,
  updateMemberRole,
  type ApiServerBan,
} from "@/lib/servers";
import { SERVER_COLOR_OPTIONS } from "@/lib/serverColors";
import { cn } from "@/lib/cn";
import type { Server, ServerRole } from "@/types";

interface ServerSettingsModalProps {
  open: boolean;
  onClose: () => void;
  server: Server;
}

type Tab = "general" | "members" | "bans";

const TABS: { id: Tab; label: string; icon: typeof Settings2 }[] = [
  { id: "general", label: "Geral", icon: Settings2 },
  { id: "members", label: "Membros", icon: Users },
  { id: "bans", label: "Banidos", icon: ShieldBan },
];

export function ServerSettingsModal({
  open,
  onClose,
  server,
}: ServerSettingsModalProps) {
  const [tab, setTab] = useState<Tab>("general");

  useEffect(() => {
    if (open) setTab("general");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Configurações de ${server.name}`}
      size="lg"
    >
      <div className="flex gap-6">
        <nav className="flex w-40 shrink-0 flex-col gap-0.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-small text-text-secondary hover:bg-hover hover:text-text-primary",
                tab === item.id && "bg-active text-text-primary",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-h-[320px] flex-1">
          {tab === "general" && (
            <GeneralTab server={server} onClose={onClose} />
          )}
          {tab === "members" && <MembersTab server={server} />}
          {tab === "bans" && <BansTab server={server} />}
        </div>
      </div>
    </Modal>
  );
}

function GeneralTab({
  server,
  onClose,
}: {
  server: Server;
  onClose: () => void;
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const members = useServerStore(
    (state) => state.membersByServer[server.id] ?? [],
  );
  const myRole = members.find((member) => member.userId === currentUserId)
    ?.role;
  const showDelete =
    canDeleteServer(myRole) || server.ownerId === currentUserId;
  const updateServerInfo = useServerStore((state) => state.updateServerInfo);
  const uploadServerIcon = useServerStore((state) => state.uploadServerIcon);
  const clearServerIcon = useServerStore((state) => state.clearServerIcon);
  const deleteServer = useServerStore((state) => state.deleteServer);
  const pushToast = useToastStore((state) => state.push);

  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? "");
  const [color, setColor] = useState(server.iconColor);
  const [iconUrl, setIconUrl] = useState(server.iconUrl);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (removeIcon && !iconFile) {
        await clearServerIcon(server.id);
        setIconUrl(null);
      } else if (iconFile) {
        await uploadServerIcon(server.id, iconFile);
        setIconFile(null);
        if (iconPreview) URL.revokeObjectURL(iconPreview);
        setIconPreview(null);
        setRemoveIcon(false);
      }
      await updateServerInfo(server.id, {
        name: name.trim(),
        description: description.trim(),
        iconColor: color,
      });
      const latest = useServerStore
        .getState()
        .servers.find((item) => item.id === server.id);
      if (latest) setIconUrl(latest.iconUrl);
      pushToast("success", "Configurações salvas");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError ? error.message : "Não foi possível salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!password) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteServer(server.id, password);
      pushToast("success", `${server.name} foi excluído`);
      onClose();
    } catch (error) {
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível excluir o servidor",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar
          name={name || server.name}
          color={color}
          imageUrl={iconPreview || (removeIcon ? null : iconUrl)}
          size="lg"
        />
        <div className="flex-1">
          <p className="mb-1.5 text-small font-medium text-text-secondary">
            Foto do servidor
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                assertImageFile(file);
                setCropSource(file);
              } catch (error) {
                pushToast(
                  "error",
                  error instanceof Error
                    ? error.message
                    : "Não foi possível ler essa imagem",
                );
              }
            }}
          />
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              Enviar foto
            </Button>
            {(iconUrl || iconPreview) && !removeIcon && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (iconPreview) URL.revokeObjectURL(iconPreview);
                  setIconFile(null);
                  setIconPreview(null);
                  setRemoveIcon(true);
                }}
              >
                Remover foto
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {SERVER_COLOR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Escolher cor ${option}`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "h-6 w-6 rounded-full transition-transform duration-150",
                  color === option &&
                    "ring-2 ring-text-primary ring-offset-2 ring-offset-elevated scale-110",
                )}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-caption text-text-muted">
            JPG, PNG, WEBP ou GIF de até 5 MB. A cor vale quando não houver
            foto.
          </p>
        </div>
      </div>

      <Input
        label="Nome do servidor"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        label="Descrição"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Sobre o que é esse servidor?"
      />

      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Salvar alterações"}
      </Button>

      <ImageCropDialog
        file={cropSource}
        open={Boolean(cropSource)}
        title="Recortar ícone do servidor"
        onCancel={() => setCropSource(null)}
        onConfirm={(file) => {
          if (iconPreview) URL.revokeObjectURL(iconPreview);
          setIconFile(file);
          setIconPreview(URL.createObjectURL(file));
          setRemoveIcon(false);
          setCropSource(null);
        }}
      />

      {showDelete && (
        <div className="mt-2 rounded-md border border-danger/30 bg-danger/5 p-4">
          <h3 className="mb-1 flex items-center gap-2 text-small font-semibold text-danger">
            <Trash2 className="h-4 w-4" />
            Excluir servidor
          </h3>
          <p className="mb-3 text-caption text-text-muted">
            Essa ação é permanente e apaga todos os canais e mensagens. Confirme
            com sua senha.
          </p>

          {!confirmingDelete ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
            >
              Excluir servidor
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                type="password"
                label="Sua senha"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setDeleteError(null);
                }}
                error={deleteError ?? undefined}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setPassword("");
                    setDeleteError(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting || !password}
                >
                  {deleting ? "Excluindo..." : "Excluir permanentemente"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MembersTab({ server }: { server: Server }) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const membersByServer = useServerStore((state) => state.membersByServer);
  const fetchMembers = useServerStore((state) => state.fetchMembers);
  const pushToast = useToastStore((state) => state.push);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMembers(server.id).finally(() => setLoading(false));
  }, [server.id, fetchMembers]);

  const members = membersByServer[server.id] ?? [];
  const myRole = members.find((member) => member.userId === currentUserId)
    ?.role;
  const roleOptions = assignableRoles(myRole);

  async function handleRoleChange(userId: string, role: ServerRole) {
    setBusyUserId(userId);
    try {
      await updateMemberRole(server.id, userId, role);
      await fetchMembers(server.id);
      pushToast("success", "Cargo atualizado");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível alterar o cargo",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleKick(userId: string) {
    setBusyUserId(userId);
    try {
      await kickMember(server.id, userId);
      await fetchMembers(server.id);
      pushToast("success", "Membro removido");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível remover o membro",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleBan(userId: string) {
    setBusyUserId(userId);
    try {
      await banMember(server.id, userId);
      await fetchMembers(server.id);
      pushToast("success", "Membro banido");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível banir o membro",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-small text-text-secondary">Carregando membros...</p>
    );
  }

  if (members.length === 0) {
    return (
      <p className="text-small text-text-secondary">
        Nenhum membro encontrado.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {members.map((member) => (
        <li
          key={member.userId}
          className="flex items-center gap-3 rounded-md border-b border-border/60 px-2 py-2.5"
        >
          <Avatar
            name={member.user.displayName}
            color={member.user.avatarColor}
            imageUrl={member.user.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-text-primary">
              {member.user.displayName}
            </p>
            <p className="truncate text-caption text-text-muted">
              @{member.user.username}
            </p>
          </div>

          {member.userId !== currentUserId &&
          canManageMember(myRole, member.role) ? (
            <div className="flex items-center gap-1.5">
              <select
                value={member.role}
                disabled={busyUserId === member.userId}
                onChange={(event) =>
                  handleRoleChange(
                    member.userId,
                    event.target.value as ServerRole,
                  )
                }
                className="h-8 rounded-md border border-border bg-surface px-2 text-caption text-text-primary outline-none focus:border-accent"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyUserId === member.userId}
                onClick={() => handleKick(member.userId)}
              >
                Remover
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={busyUserId === member.userId}
                onClick={() => handleBan(member.userId)}
              >
                Banir
              </Button>
            </div>
          ) : (
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-caption font-medium text-accent">
              {ROLE_LABELS[member.role]}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function BansTab({ server }: { server: Server }) {
  const pushToast = useToastStore((state) => state.push);
  const [bans, setBans] = useState<ApiServerBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setBans(await listBans(server.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  async function handleUnban(userId: string) {
    setBusyUserId(userId);
    try {
      await unbanMember(server.id, userId);
      await refresh();
      pushToast("success", "Usuário desbanido");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError ? error.message : "Não foi possível desbanir",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-small text-text-secondary">Carregando banidos...</p>
    );
  }

  if (bans.length === 0) {
    return (
      <p className="text-small text-text-secondary">Nenhum usuário banido.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {bans.map((ban) => (
        <li
          key={ban.id}
          className="flex items-center gap-3 rounded-md border-b border-border/60 px-2 py-2.5"
        >
          <Avatar
            name={ban.user.displayName}
            color={avatarColorFor(ban.user.id)}
            imageUrl={ban.user.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-text-primary">
              {ban.user.displayName}
            </p>
            <p className="truncate text-caption text-text-muted">
              {ban.reason ? ban.reason : "Sem motivo informado"} — por{" "}
              {ban.bannedBy.displayName}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={busyUserId === ban.userId}
            onClick={() => handleUnban(ban.userId)}
          >
            Desbanir
          </Button>
        </li>
      ))}
    </ul>
  );
}
