import { useEffect } from "react";
import { Hash, X } from "lucide-react";
import type { Channel } from "@/types";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { IconButton } from "@/components/ui/IconButton";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

export function VoiceChatPanel({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  const currentUser = useAuthStore((state) => state.user);
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

  useEffect(() => {
    joinChannel(channel.id);
    loadHistory(channel.id);
    return () => leaveChannel(channel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const messages = messagesByChannel[channel.id] ?? [];
  const typingUsers = (typingByChannel[channel.id] ?? []).filter(
    (user) => user.userId !== currentUser?.id,
  );

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-black/20 bg-bg-secondary">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-3">
        <Hash className="h-4 w-4 text-text-secondary" />
        <span className="min-w-0 flex-1 truncate text-small font-semibold text-text-primary">
          Chat de {channel.name}
        </span>
        <IconButton aria-label="Fechar chat" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </header>
      <MessageList
        messages={messages}
        currentUserId={currentUser?.id}
        onEdit={editMessage}
        onDelete={deleteMessage}
        hasMore={hasMoreByChannel[channel.id] ?? false}
        loadingMore={loadingByChannel[channel.id] ?? false}
        onLoadMore={() => loadMore(channel.id)}
      />
      <TypingIndicator names={typingUsers.map((user) => user.displayName)} />
      <div className="p-2">
        <MessageInput
          channelName={channel.name}
          onSend={(content) => sendMessage(channel.id, content)}
          onTypingStart={() => startTyping(channel.id)}
          onTypingStop={() => stopTyping(channel.id)}
        />
      </div>
    </aside>
  );
}
