import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useServerStore } from "@/stores/useServerStore";
import { useChatStore } from "@/stores/useChatStore";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberSidebar } from "@/components/user/MemberSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/Button";
import { CreateChannelModal } from "@/components/modal/CreateChannelModal";
import { useUIStore } from "@/stores/useUIStore";

export default function ServerPage() {
  const navigate = useNavigate();
  const { serverId, channelId } = useParams<{
    serverId: string;
    channelId: string;
  }>();
  const memberSidebarOpen = useUIStore((state) => state.memberSidebarOpen);
  const currentUser = useAuthStore((state) => state.user);
  const pushToast = useToastStore((state) => state.push);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const server = useServerStore((state) =>
    state.servers.find((item) => item.id === serverId),
  );
  const allChannels = useServerStore((state) => state.channels);
  const allCategories = useServerStore((state) => state.categories);
  const addChannel = useServerStore((state) => state.addChannel);

  const messagesByChannel = useChatStore((state) => state.messagesByChannel);
  const typingByChannel = useChatStore((state) => state.typingByChannel);
  const hasMoreByChannel = useChatStore((state) => state.hasMoreByChannel);
  const loadingByChannel = useChatStore((state) => state.loadingByChannel);
  const joinChannel = useChatStore((state) => state.joinChannel);
  const leaveChannel = useChatStore((state) => state.leaveChannel);
  const loadHistory = useChatStore((state) => state.loadHistory);
  const loadMore = useChatStore((state) => state.loadMore);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const startTyping = useChatStore((state) => state.startTyping);
  const stopTyping = useChatStore((state) => state.stopTyping);

  const channels = useMemo(
    () =>
      server ? allChannels.filter((item) => item.serverId === server.id) : [],
    [allChannels, server],
  );
  const categories = useMemo(
    () =>
      server ? allCategories.filter((item) => item.serverId === server.id) : [],
    [allCategories, server],
  );
  const channel = channels.find((item) => item.id === channelId);

  useEffect(() => {
    if (!channel) return;
    joinChannel(channel.id);
    loadHistory(channel.id);
    return () => leaveChannel(channel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  if (!server) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-bg-primary text-text-secondary">
        Servidor não encontrado.
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
        <EmptyState
          icon={Sparkles}
          title={`Bem-vindo ao ${server.name}`}
          description="Comece criando seu primeiro canal para a conversa fluir por aqui."
          action={
            <Button onClick={() => setCreateChannelOpen(true)}>
              + Criar canal
            </Button>
          }
        />
        <CreateChannelModal
          open={createChannelOpen}
          categories={categories}
          onClose={() => setCreateChannelOpen(false)}
          onCreate={async (input) => {
            try {
              const created = await addChannel({
                serverId: server.id,
                ...input,
              });
              setCreateChannelOpen(false);
              pushToast("success", "Canal criado");
              navigate(
                created.type === "VOICE"
                  ? `/app/server/${server.id}/voice/${created.id}`
                  : `/app/server/${server.id}/channel/${created.id}`,
              );
            } catch (error) {
              pushToast(
                "error",
                error instanceof ApiError
                  ? error.message
                  : "Não foi possível criar o canal",
              );
            }
          }}
        />
      </div>
    );
  }

  const liveMessages = messagesByChannel[channel.id] ?? [];
  const typingUsers = (typingByChannel[channel.id] ?? []).filter(
    (user) => user.userId !== currentUser?.id,
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
        <ChatHeader channel={channel} />
        <MessageList
          messages={liveMessages}
          currentUserId={currentUser?.id}
          onEdit={editMessage}
          onDelete={deleteMessage}
          hasMore={hasMoreByChannel[channel.id] ?? false}
          loadingMore={loadingByChannel[channel.id] ?? false}
          onLoadMore={() => loadMore(channel.id)}
        />
        <TypingIndicator names={typingUsers.map((user) => user.displayName)} />
        <MessageInput
          channelName={channel.name}
          onSend={(content) => sendMessage(channel.id, content)}
          onTypingStart={() => startTyping(channel.id)}
          onTypingStop={() => stopTyping(channel.id)}
        />
      </div>

      {memberSidebarOpen && <MemberSidebar server={server} />}
    </div>
  );
}
