import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useDmStore, type DmConversation } from "@/stores/useDmStore";
import { useFriendsStore } from "@/stores/useFriendsStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import { statusLabels } from "@/lib/status";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

export default function DmPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const pushToast = useToastStore((state) => state.push);
  const friend = useFriendsStore((state) =>
    state.friends.find((entry) => entry.user.id === userId),
  );
  const openWith = useDmStore((state) => state.openWith);
  const markRead = useDmStore((state) => state.markRead);
  const setActiveChannelId = useDmStore((state) => state.setActiveChannelId);

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

  const [channelId, setChannelId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<DmConversation | null>(null);
  const [opening, setOpening] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setOpening(true);
    setChannelId(null);
    setConversation(null);
    openWith(userId)
      .then(async (opened) => {
        if (cancelled) return;
        setConversation(opened);
        setChannelId(opened.channelId);
        setActiveChannelId(opened.channelId);
        joinChannel(opened.channelId);
        try {
          await loadHistory(opened.channelId);
        } catch (error) {
          pushToast(
            "error",
            error instanceof ApiError
              ? error.message
              : "Não foi possível carregar o histórico",
          );
        }
        try {
          await markRead(opened.channelId);
        } catch {
          // opening the thread still succeeds if the receipt write fails
        }
      })
      .catch((error) => {
        if (cancelled) return;
        pushToast(
          "error",
          error instanceof ApiError
            ? error.message
            : "Não foi possível abrir a conversa",
        );
        navigate("/app/friends", { replace: true });
      })
      .finally(() => {
        if (!cancelled) setOpening(false);
      });

    return () => {
      cancelled = true;
      const active = useDmStore.getState().activeChannelId;
      if (active) leaveChannel(active);
      setActiveChannelId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!channelId) return;
    const id = channelId;
    function markIfVisible() {
      if (document.hidden) return;
      void markRead(id);
    }
    document.addEventListener("visibilitychange", markIfVisible);
    window.addEventListener("focus", markIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", markIfVisible);
      window.removeEventListener("focus", markIfVisible);
    };
  }, [channelId, markRead]);

  const other = conversation?.user ?? friend?.user;
  const liveMessages = channelId ? (messagesByChannel[channelId] ?? []) : [];
  const typingUsers = (
    channelId ? (typingByChannel[channelId] ?? []) : []
  ).filter((user) => user.userId !== currentUser?.id);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-black/20 px-4 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => navigate("/app/friends")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {other ? (
          <>
            <Avatar
              name={other.displayName}
              color={other.avatarColor}
              imageUrl={other.avatarUrl}
              status={other.status}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-text-primary">
                {other.displayName}
              </p>
            </div>
            <span className="truncate text-small text-text-secondary">
              {other.customStatus ?? statusLabels[other.status]}
            </span>
          </>
        ) : (
          <span className="text-body font-semibold text-text-primary">
            Mensagem direta
          </span>
        )}
      </header>

      {opening || !channelId ? (
        <div className="flex flex-1 items-center justify-center text-small text-text-secondary">
          Abrindo conversa...
        </div>
      ) : (
        <>
          <MessageList
            messages={liveMessages}
            currentUserId={currentUser?.id}
            onEdit={editMessage}
            onDelete={deleteMessage}
            hasMore={hasMoreByChannel[channelId] ?? false}
            loadingMore={loadingByChannel[channelId] ?? false}
            onLoadMore={() => loadMore(channelId)}
          />
          <TypingIndicator names={typingUsers.map((user) => user.displayName)} />
          <MessageInput
            channelName={other?.displayName ?? "amigo"}
            placeholder={`Escreva uma mensagem para ${other?.displayName ?? "seu amigo"}...`}
            onSend={(content) => sendMessage(channelId, content)}
            onTypingStart={() => startTyping(channelId)}
            onTypingStop={() => stopTyping(channelId)}
          />
        </>
      )}
    </div>
  );
}
