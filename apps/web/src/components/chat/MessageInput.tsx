import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Plus, Smile } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

const TYPING_IDLE_MS = 2500;

interface MessageInputProps {
  channelName: string;
  placeholder?: string;
  onSend: (content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export function MessageInput({
  channelName,
  placeholder,
  onSend,
  onTypingStart,
  onTypingStop,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onTypingStop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notifyTyping() {
    if (!onTypingStart) return;
    if (!typingTimeoutRef.current) onTypingStart();
    else clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
      onTypingStop?.();
    }, TYPING_IDLE_MS);
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      onTypingStop?.();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 focus-within:border-border-strong">
        <Tooltip content="Em breve">
          <button
            disabled
            aria-label="Anexar arquivo (em breve)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </Tooltip>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder ?? `Escreva uma mensagem em #${channelName}...`}
          onChange={(event) => {
            setValue(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
            notifyTyping();
          }}
          onKeyDown={handleKeyDown}
          className="max-h-48 flex-1 resize-none bg-transparent py-1 text-body text-text-primary placeholder:text-text-muted outline-none"
        />

        <button
          aria-label="Emoji"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
        >
          <Smile className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
