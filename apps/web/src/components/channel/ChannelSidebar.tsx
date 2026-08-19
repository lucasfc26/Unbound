import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import {
  ChevronDown,
  Hash,
  Volume2,
  MoreHorizontal,
  UserPlus,
  FolderPlus,
  LogOut,
  Settings,
} from "lucide-react";
import { useServerStore } from "@/stores/useServerStore";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api";
import { UserArea } from "@/components/user/UserArea";
import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { InviteModal } from "@/components/modal/InviteModal";
import { CreateCategoryModal } from "@/components/modal/CreateCategoryModal";
import { CreateChannelModal } from "@/components/modal/CreateChannelModal";
import { ServerSettingsModal } from "@/components/modal/ServerSettingsModal";
import type { Channel, ChannelType } from "@/types";

export function ChannelSidebar() {
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const server = useServerStore((state) =>
    state.servers.find((item) => item.id === serverId),
  );
  const allCategories = useServerStore((state) => state.categories);
  const allChannels = useServerStore((state) => state.channels);
  const addCategory = useServerStore((state) => state.addCategory);
  const addChannel = useServerStore((state) => state.addChannel);
  const leaveServer = useServerStore((state) => state.leaveServer);
  const fetchChannels = useServerStore((state) => state.fetchChannels);
  const fetchMembers = useServerStore((state) => state.fetchMembers);
  const pushToast = useToastStore((state) => state.push);
  const speakingChannelId = useVoiceStore((state) => state.speakingChannelId);
  const speakingUserId = useVoiceStore((state) => state.speakingUserId);
  const participantsByChannel = useVoiceStore(
    (state) => state.participantsByChannel,
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [channelModal, setChannelModal] = useState<{
    open: boolean;
    type: ChannelType;
  }>({
    open: false,
    type: "TEXT",
  });

  useEffect(() => {
    if (server) {
      fetchChannels(server.id).catch(() =>
        pushToast("error", "Não foi possível carregar os canais"),
      );
      fetchMembers(server.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id]);

  const categories = useMemo(
    () =>
      server
        ? allCategories
            .filter((category) => category.serverId === server.id)
            .sort((a, b) => a.position - b.position)
        : [],
    [allCategories, server],
  );

  const channels = useMemo(
    () =>
      server
        ? allChannels.filter((channel) => channel.serverId === server.id)
        : [],
    [allChannels, server],
  );

  const uncategorizedChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.categoryId === null)
        .sort((a, b) => a.position - b.position),
    [channels],
  );

  if (!server) {
    return (
      <aside className="flex h-full w-60 shrink-0 flex-col bg-bg-secondary" />
    );
  }

  const isOwner = server.ownerId === currentUserId;

  async function handleChannelCreated(input: {
    name: string;
    type: ChannelType;
    categoryId: string | null;
  }) {
    if (!server) return;
    try {
      const channel = await addChannel({ serverId: server.id, ...input });
      setChannelModal((state) => ({ ...state, open: false }));
      pushToast("success", "Canal criado");
      navigate(
        channel.type === "VOICE"
          ? `/app/server/${server.id}/voice/${channel.id}`
          : `/app/server/${server.id}/channel/${channel.id}`,
      );
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível criar o canal",
      );
    }
  }

  async function handleCategoryCreated(name: string) {
    if (!server) return;
    try {
      await addCategory({ serverId: server.id, name });
      setCategoryOpen(false);
      pushToast("success", "Categoria criada");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível criar a categoria",
      );
    }
  }

  async function handleLeaveServer() {
    if (!server) return;
    try {
      await leaveServer(server.id);
      pushToast("success", `Você saiu de ${server.name}`);
      navigate("/app");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível sair do servidor",
      );
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-bg-secondary">
      <DropdownMenu
        trigger={
          <button className="flex h-12 w-full shrink-0 items-center justify-between border-b border-black/20 px-4 text-body font-semibold text-text-primary shadow-sm hover:bg-hover">
            <span className="truncate">{server.name}</span>
            <MoreHorizontal className="h-4 w-4 shrink-0 text-text-secondary" />
          </button>
        }
        items={[
          {
            label: "Convidar pessoas",
            icon: UserPlus,
            onSelect: () => setInviteOpen(true),
          },
          {
            label: "Criar categoria",
            icon: FolderPlus,
            onSelect: () => setCategoryOpen(true),
          },
          {
            label: "Criar canal de texto",
            icon: Hash,
            onSelect: () => setChannelModal({ open: true, type: "TEXT" }),
          },
          {
            label: "Criar canal de voz",
            icon: Volume2,
            onSelect: () => setChannelModal({ open: true, type: "VOICE" }),
          },
          ...(isOwner
            ? [
                {
                  label: "Configurações do servidor",
                  icon: Settings,
                  onSelect: () => setSettingsOpen(true),
                },
              ]
            : []),
          ...(!isOwner
            ? [
                {
                  label: "Sair do servidor",
                  icon: LogOut,
                  variant: "danger" as const,
                  onSelect: handleLeaveServer,
                },
              ]
            : []),
        ]}
      />

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {uncategorizedChannels.length > 0 && (
          <ul className="mb-2 flex flex-col gap-0.5">
            {uncategorizedChannels.map((channel) => (
              <ChannelListItem
                key={channel.id}
                channel={channel}
                serverId={server.id}
                participantIds={participantsByChannel[channel.id]}
                speaking={
                  speakingChannelId === channel.id ? speakingUserId : null
                }
              />
            ))}
          </ul>
        )}

        {categories.map((category) => (
          <CategoryGroup
            key={category.id}
            title={category.name}
            channels={channels
              .filter((channel) => channel.categoryId === category.id)
              .sort((a, b) => a.position - b.position)}
            serverId={server.id}
            participantsByChannel={participantsByChannel}
            speakingChannelId={speakingChannelId}
            speakingUserId={speakingUserId}
          />
        ))}
      </div>

      <UserArea />

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        server={server}
      />

      <CreateCategoryModal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        onCreate={handleCategoryCreated}
      />

      <CreateChannelModal
        open={channelModal.open}
        defaultType={channelModal.type}
        defaultCategoryId={categories[0]?.id ?? null}
        categories={categories}
        onClose={() => setChannelModal((state) => ({ ...state, open: false }))}
        onCreate={handleChannelCreated}
      />

      {isOwner && (
        <ServerSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          server={server}
        />
      )}
    </aside>
  );
}

interface CategoryGroupProps {
  title: string;
  channels: Channel[];
  serverId: string;
  participantsByChannel: Record<string, string[]>;
  speakingChannelId: string | null;
  speakingUserId: string | null;
}

function CategoryGroup({
  title,
  channels,
  serverId,
  participantsByChannel,
  speakingChannelId,
  speakingUserId,
}: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-1 px-1 py-1.5 text-caption font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-150",
            collapsed && "-rotate-90",
          )}
        />
        {title}
      </button>

      {!collapsed && (
        <ul className="flex flex-col gap-0.5">
          {channels.map((channel) => (
            <ChannelListItem
              key={channel.id}
              channel={channel}
              serverId={serverId}
              participantIds={participantsByChannel[channel.id]}
              speaking={
                speakingChannelId === channel.id ? speakingUserId : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface ChannelListItemProps {
  channel: Channel;
  serverId: string;
  participantIds?: string[];
  speaking: string | null;
}

function ChannelListItem({
  channel,
  serverId,
  participantIds,
  speaking,
}: ChannelListItemProps) {
  const members = useServerStore((state) => state.membersByServer[serverId]);

  return (
    <li>
      <NavLink
        to={
          channel.type === "VOICE"
            ? `/app/server/${serverId}/voice/${channel.id}`
            : `/app/server/${serverId}/channel/${channel.id}`
        }
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-body text-text-secondary transition-colors duration-150 hover:bg-hover hover:text-text-primary",
            isActive && "bg-active text-text-primary",
          )
        }
      >
        {channel.type === "VOICE" ? (
          <Volume2 className="h-4.5 w-4.5 shrink-0 text-text-muted" />
        ) : (
          <Hash className="h-4.5 w-4.5 shrink-0 text-text-muted" />
        )}
        <span className="truncate">{channel.name}</span>
      </NavLink>

      {channel.type === "VOICE" && (participantIds?.length ?? 0) > 0 && (
        <ul className="ml-6 mt-0.5 flex flex-col gap-1 border-l border-border/60 py-1 pl-3">
          {participantIds!.map((userId) => {
            const user = members?.find(
              (member) => member.userId === userId,
            )?.user;
            if (!user) return null;
            return (
              <li key={userId} className="flex items-center gap-2">
                <Avatar
                  name={user.displayName}
                  color={user.avatarColor}
                  size="sm"
                  speaking={speaking === userId}
                />
                <span className="truncate text-small text-text-secondary">
                  {user.displayName}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
