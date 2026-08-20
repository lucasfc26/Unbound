import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  MessageSquare,
  Check,
  X,
  Users,
  UserMinus,
  Copy,
  RefreshCw,
  Plus,
  Link2,
} from "lucide-react";
import {
  useFriendsStore,
  type FriendEntry,
  type FriendRequestEntry,
} from "@/stores/useFriendsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import { regenerateFriendCode } from "@/lib/account";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { statusLabels } from "@/lib/status";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/modal/Modal";
import { cn } from "@/lib/cn";

function formatFriendCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

type Tab = "online" | "all" | "pending" | "blocked";

const tabs: { id: Tab; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "blocked", label: "Bloqueados" },
];

export default function FriendsPage() {
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);
  const friends = useFriendsStore((state) => state.friends);
  const incomingRequests = useFriendsStore((state) => state.incomingRequests);
  const outgoingRequests = useFriendsStore((state) => state.outgoingRequests);
  const fetchAll = useFriendsStore((state) => state.fetchAll);
  const sendRequest = useFriendsStore((state) => state.sendRequest);

  const sendRequestByCode = useFriendsStore((state) => state.sendRequestByCode);

  const [tab, setTab] = useState<Tab>("online");
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"username" | "code">("username");
  const [addUsername, setAddUsername] = useState("");
  const [addCode, setAddCode] = useState("");
  const [sending, setSending] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");

  function handleJoinByInvite(event: FormEvent) {
    event.preventDefault();
    // Accepts either a bare code or a full link (any domain — the invite
    // page itself validates the code) — just grab the last path segment.
    const code = joinInput.trim().split(/[/\\]/).pop()?.trim();
    if (!code) return;
    setJoinOpen(false);
    setJoinInput("");
    navigate(`/invite/${code}`);
  }

  useEffect(() => {
    fetchAll().catch(() =>
      pushToast("error", "Não foi possível carregar seus amigos"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleFriends =
    tab === "online"
      ? friends.filter((f) => f.user.status === "ONLINE")
      : friends;

  async function handleAddFriend(event: FormEvent) {
    event.preventDefault();
    if (sending) return;

    if (addMode === "username") {
      const username = addUsername.trim();
      if (!username) return;
      setSending(true);
      try {
        await sendRequest(username);
        pushToast("success", `Solicitação enviada para ${username}`);
        setAddUsername("");
        setAddOpen(false);
      } catch (error) {
        pushToast(
          "error",
          error instanceof ApiError
            ? error.message
            : "Não foi possível enviar a solicitação",
        );
      } finally {
        setSending(false);
      }
      return;
    }

    const code = addCode.trim();
    if (!code) return;
    setSending(true);
    try {
      await sendRequestByCode(code);
      pushToast("success", "Solicitação enviada");
      setAddCode("");
      setAddOpen(false);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível enviar a solicitação",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-black/20 px-4 shadow-sm">
        <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
          <Users className="h-5 w-5 text-text-secondary" />
          Amigos
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-small font-medium text-text-secondary hover:bg-hover hover:text-text-primary",
                tab === item.id && "bg-active text-text-primary",
              )}
            >
              {item.label}
              {item.id === "pending" && incomingRequests.length > 0 && (
                <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-caption font-semibold text-white">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => setJoinOpen(true)}
        >
          <Link2 className="h-4 w-4" />
          Entrar com convite
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Adicionar amigo
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {tab === "pending" ? (
          <PendingLists
            incoming={incomingRequests}
            outgoing={outgoingRequests}
          />
        ) : tab === "blocked" ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário bloqueado"
            description="Você ainda não bloqueou ninguém."
          />
        ) : (
          <FriendListView
            friends={visibleFriends}
            emptyLabel={tab === "online" ? "online" : "cadastrado"}
          />
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar amigo"
        description="Envie um pedido pelo nome de usuário ou compartilhe seu código."
        size="md"
      >
        <div className="flex flex-col gap-4">
          <FriendCodeCard />
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-small font-semibold text-text-primary">
              <UserPlus className="h-4 w-4" />
              Enviar solicitação
            </h3>
            <div className="mb-3 flex items-center gap-1">
              {(["username", "code"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAddMode(mode)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-caption font-medium text-text-secondary hover:bg-hover hover:text-text-primary",
                    addMode === mode && "bg-active text-text-primary",
                  )}
                >
                  {mode === "username" ? "Por usuário" : "Por código"}
                </button>
              ))}
            </div>
            <form onSubmit={handleAddFriend} className="flex gap-2">
              {addMode === "username" ? (
                <Input
                  placeholder="nome-de-usuario"
                  value={addUsername}
                  onChange={(event) => setAddUsername(event.target.value)}
                  className="flex-1"
                />
              ) : (
                <Input
                  placeholder="AB3D-9F2K"
                  value={addCode}
                  onChange={(event) => setAddCode(event.target.value)}
                  className="flex-1"
                />
              )}
              <Button type="submit" disabled={sending}>
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          </div>
        </div>
      </Modal>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Entrar com convite"
        description="Cole o link de convite ou só o código."
        size="md"
      >
        <form onSubmit={handleJoinByInvite} className="flex gap-2">
          <Input
            placeholder="https://unbound.maselcorp.com.br/invite/AB12CD34 ou AB12CD34"
            value={joinInput}
            onChange={(event) => setJoinInput(event.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={!joinInput.trim()}>
            Entrar
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function FriendCodeCard() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const pushToast = useToastStore((state) => state.push);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  if (!user?.friendCode) return null;

  async function handleCopy() {
    if (!user?.friendCode) return;
    await navigator.clipboard.writeText(formatFriendCode(user.friendCode));
    setCopied(true);
    pushToast("success", "Código copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const updated = await regenerateFriendCode();
      updateUser(updated);
      pushToast("success", "Novo código gerado");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível gerar um novo código",
      );
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-1 text-small font-semibold text-text-primary">
        Seu código de amigo
      </h2>
      <p className="mb-3 text-small text-text-secondary">
        Compartilhe este código para que alguém te adicione sem saber seu
        nome de usuário.
      </p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-bg-primary px-3 py-2.5">
        <span className="flex-1 truncate font-mono text-body text-text-primary">
          {formatFriendCode(user.friendCode)}
        </span>
        <IconButton
          aria-label="Copiar código de amigo"
          size="sm"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </IconButton>
        <IconButton
          aria-label="Gerar novo código"
          size="sm"
          disabled={regenerating}
          onClick={handleRegenerate}
        >
          <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
        </IconButton>
      </div>
    </div>
  );
}

function FriendListView({
  friends,
  emptyLabel,
}: {
  friends: FriendEntry[];
  emptyLabel: string;
}) {
  const navigate = useNavigate();
  const removeFriend = useFriendsStore((state) => state.removeFriend);
  const pushToast = useToastStore((state) => state.push);

  if (friends.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={`Nenhum amigo ${emptyLabel}`}
        description="Seus amigos aparecerão aqui."
      />
    );
  }

  async function handleRemove(entry: FriendEntry) {
    if (
      !window.confirm(
        `Remover ${entry.user.displayName} da sua lista de amigos?`,
      )
    )
      return;
    try {
      await removeFriend(entry.user.id);
      pushToast(
        "success",
        `${entry.user.displayName} removido dos seus amigos`,
      );
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível remover o amigo",
      );
    }
  }

  return (
    <ul className="flex flex-col gap-1">
      {friends.map((entry) => (
        <li
          key={entry.friendshipId}
          className="flex cursor-pointer items-center gap-3 rounded-md border-b border-border/60 px-2 py-3 hover:bg-surface"
          onClick={() => navigate(`/app/dm/${entry.user.id}`)}
        >
          <Avatar
            name={entry.user.displayName}
            color={entry.user.avatarColor}
            imageUrl={entry.user.avatarUrl}
            status={entry.user.status}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-text-primary">
              {entry.user.displayName}
            </p>
            <p className="truncate text-small text-text-secondary">
              {entry.user.customStatus ?? statusLabels[entry.user.status]}
            </p>
          </div>
          <IconButton
            aria-label={`Conversar com ${entry.user.displayName}`}
            variant="surface"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/app/dm/${entry.user.id}`);
            }}
          >
            <MessageSquare className="h-4.5 w-4.5" />
          </IconButton>
          <IconButton
            aria-label={`Remover ${entry.user.displayName}`}
            variant="surface"
            className="text-danger"
            onClick={(event) => {
              event.stopPropagation();
              void handleRemove(entry);
            }}
          >
            <UserMinus className="h-4.5 w-4.5" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function PendingLists({
  incoming,
  outgoing,
}: {
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
}) {
  const acceptRequest = useFriendsStore((state) => state.acceptRequest);
  const rejectRequest = useFriendsStore((state) => state.rejectRequest);
  const cancelRequest = useFriendsStore((state) => state.cancelRequest);
  const pushToast = useToastStore((state) => state.push);

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma solicitação pendente"
        description="Você está em dia por aqui."
      />
    );
  }

  async function handleAccept(request: FriendRequestEntry) {
    try {
      await acceptRequest(request.id);
      pushToast(
        "success",
        `Você e ${request.user.displayName} agora são amigos`,
      );
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError ? error.message : "Não foi possível aceitar",
      );
    }
  }

  async function handleReject(request: FriendRequestEntry) {
    try {
      await rejectRequest(request.id);
      pushToast(
        "warning",
        `Solicitação de ${request.user.displayName} recusada`,
      );
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError ? error.message : "Não foi possível recusar",
      );
    }
  }

  async function handleCancel(request: FriendRequestEntry) {
    try {
      await cancelRequest(request.id);
      pushToast("success", "Solicitação cancelada");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError ? error.message : "Não foi possível cancelar",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {incoming.length > 0 && (
        <div>
          <h2 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
            Recebidas
          </h2>
          <ul className="flex flex-col gap-1">
            {incoming.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-md border-b border-border/60 px-2 py-3 hover:bg-surface"
              >
                <Avatar
                  name={request.user.displayName}
                  color={request.user.avatarColor}
                  imageUrl={request.user.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-text-primary">
                    {request.user.displayName}
                  </p>
                  <p className="truncate text-small text-text-secondary">
                    Solicitação de amizade
                  </p>
                </div>
                <IconButton
                  aria-label="Aceitar"
                  variant="surface"
                  className="text-success"
                  onClick={() => handleAccept(request)}
                >
                  <Check className="h-4.5 w-4.5" />
                </IconButton>
                <IconButton
                  aria-label="Recusar"
                  variant="surface"
                  className="text-danger"
                  onClick={() => handleReject(request)}
                >
                  <X className="h-4.5 w-4.5" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div>
          <h2 className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
            Enviadas
          </h2>
          <ul className="flex flex-col gap-1">
            {outgoing.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-md border-b border-border/60 px-2 py-3 hover:bg-surface"
              >
                <Avatar
                  name={request.user.displayName}
                  color={request.user.avatarColor}
                  imageUrl={request.user.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-text-primary">
                    {request.user.displayName}
                  </p>
                  <p className="truncate text-small text-text-secondary">
                    Aguardando resposta
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCancel(request)}
                >
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
