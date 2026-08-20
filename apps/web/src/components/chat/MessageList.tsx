import { Fragment, useState } from "react";
import { Smile, Reply, Pencil, Trash2, Check, X } from "lucide-react";
import type { Message } from "@/types";
import { formatDayLabel, formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LinkPreviewCard } from "./LinkPreviewCard";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface MessageGroup {
  authorId: string;
  dayLabel: string;
  messages: Message[];
}

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const message of messages) {
    const dayLabel = formatDayLabel(message.createdAt);
    const lastGroup = groups[groups.length - 1];
    const lastMessage = lastGroup?.messages[lastGroup.messages.length - 1];

    const sameAuthor = lastGroup?.authorId === message.authorId;
    const sameDay = lastGroup?.dayLabel === dayLabel;
    const withinWindow =
      lastMessage &&
      new Date(message.createdAt).getTime() -
        new Date(lastMessage.createdAt).getTime() <
        GROUP_WINDOW_MS;

    if (lastGroup && sameAuthor && sameDay && withinWindow) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        authorId: message.authorId,
        dayLabel,
        messages: [message],
      });
    }
  }

  return groups;
}

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function MessageList({
  messages,
  currentUserId,
  onEdit,
  onDelete,
  hasMore,
  loadingMore,
  onLoadMore,
}: MessageListProps) {
  const groups = groupMessages(messages);
  let lastDayLabel = "";

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
      {hasMore && (
        <div className="mb-2 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Carregando..." : "Carregar mensagens anteriores"}
          </Button>
        </div>
      )}

      {groups.map((group, index) => {
        const author = group.messages[0].author;
        const showDayDivider = group.dayLabel !== lastDayLabel;
        lastDayLabel = group.dayLabel;

        return (
          <Fragment key={`${group.authorId}-${index}`}>
            {showDayDivider && (
              <div className="my-3 flex items-center gap-3 first:mt-0">
                <div className="h-px flex-1 bg-border" />
                <span className="text-caption font-medium text-text-muted">
                  {group.dayLabel}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className="group/msg flex gap-3 rounded-md px-2 py-1 hover:bg-surface">
              <Avatar
                name={author?.displayName ?? "Usuário"}
                color={author?.avatarColor ?? "#6c6c74"}
                imageUrl={author?.avatarUrl}
                size="md"
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-body font-medium text-text-primary">
                    {author?.displayName ?? "Usuário desconhecido"}
                  </span>
                  <span className="text-caption text-text-muted">
                    {formatTime(group.messages[0].createdAt)}
                  </span>
                </div>

                {group.messages.map((message) => (
                  <MessageLine
                    key={message.id}
                    message={message}
                    canManage={
                      Boolean(currentUserId) &&
                      message.authorId === currentUserId
                    }
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

interface MessageLineProps {
  message: Message;
  canManage: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

function MessageLine({
  message,
  canManage,
  onEdit,
  onDelete,
}: MessageLineProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  function handleSaveEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== message.content) onEdit?.(message.id, trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="-mx-1 my-0.5 rounded px-1">
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSaveEdit();
            }
            if (event.key === "Escape") setEditing(false);
          }}
          rows={1}
          className="w-full resize-none rounded-md border border-accent bg-surface px-2 py-1.5 text-body text-text-primary outline-none"
        />
        <div className="mt-1 flex items-center gap-2 text-caption text-text-muted">
          <button
            onClick={handleSaveEdit}
            className="flex items-center gap-1 text-accent hover:underline"
          >
            <Check className="h-3.5 w-3.5" /> salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 hover:underline"
          >
            <X className="h-3.5 w-3.5" /> cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/line relative -mx-1 rounded px-1 hover:bg-hover/60">
      <p className="whitespace-pre-wrap break-words text-body leading-relaxed text-text-primary">
        {message.content}
        {message.editedAt && (
          <span className="ml-1 text-caption text-text-muted">(editado)</span>
        )}
      </p>

      {message.linkPreview && <LinkPreviewCard preview={message.linkPreview} />}

      <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5 shadow-md group-hover/line:flex">
        <button
          aria-label="Reagir"
          className="rounded p-1.5 text-text-secondary hover:bg-hover hover:text-text-primary"
        >
          <Smile className="h-4 w-4" />
        </button>
        <button
          aria-label="Responder"
          className="rounded p-1.5 text-text-secondary hover:bg-hover hover:text-text-primary"
        >
          <Reply className="h-4 w-4" />
        </button>
        {canManage && onEdit && (
          <button
            aria-label="Editar mensagem"
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
            className="rounded p-1.5 text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {canManage && onDelete && (
          <button
            aria-label="Excluir mensagem"
            onClick={() => {
              if (window.confirm("Excluir esta mensagem?"))
                onDelete(message.id);
            }}
            className="rounded p-1.5 text-text-secondary hover:bg-danger/15 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
