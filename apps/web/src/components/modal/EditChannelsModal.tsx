import { useMemo, useState, type DragEvent } from "react";
import { GripVertical, Hash, Pencil, Trash2, Volume2 } from "lucide-react";
import type { Channel, ChannelCategory, ChannelVisibility } from "@/types";
import { useServerStore } from "@/stores/useServerStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  CHANNEL_VISIBILITY_LABELS,
} from "@/lib/permissions";
import { Modal } from "./Modal";
import { IconButton } from "@/components/ui/IconButton";

const VISIBILITY_OPTIONS: ChannelVisibility[] = [
  "EVERYONE",
  "MODERATORS",
  "ADMINS",
];

interface EditChannelsModalProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
}

export function EditChannelsModal({
  open,
  onClose,
  serverId,
}: EditChannelsModalProps) {
  const allCategories = useServerStore((state) => state.categories);
  const allChannels = useServerStore((state) => state.channels);
  const updateChannel = useServerStore((state) => state.updateChannel);
  const deleteChannel = useServerStore((state) => state.deleteChannel);
  const reorderChannels = useServerStore((state) => state.reorderChannels);
  const updateCategory = useServerStore((state) => state.updateCategory);
  const deleteCategory = useServerStore((state) => state.deleteCategory);
  const pushToast = useToastStore((state) => state.push);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const categories = useMemo(
    () =>
      allCategories
        .filter((category) => category.serverId === serverId)
        .sort((a, b) => a.position - b.position),
    [allCategories, serverId],
  );

  const channels = useMemo(
    () => allChannels.filter((channel) => channel.serverId === serverId),
    [allChannels, serverId],
  );

  const groups = useMemo(() => {
    const uncategorized = channels
      .filter((channel) => channel.categoryId === null)
      .sort((a, b) => a.position - b.position);
    return [
      { category: null as ChannelCategory | null, channels: uncategorized },
      ...categories.map((category) => ({
        category,
        channels: channels
          .filter((channel) => channel.categoryId === category.id)
          .sort((a, b) => a.position - b.position),
      })),
    ];
  }, [categories, channels]);

  function startRename(id: string, name: string) {
    setEditingId(id);
    setDraftName(name);
  }

  async function commitRename(kind: "channel" | "category", id: string) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name) return;
    try {
      if (kind === "channel") {
        await updateChannel(serverId, id, { name });
      } else {
        await updateCategory(serverId, id, name.toUpperCase());
      }
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível renomear",
      );
    }
  }

  async function handleDeleteChannel(channel: Channel) {
    if (!window.confirm(`Apagar o canal "${channel.name}"?`)) return;
    try {
      await deleteChannel(serverId, channel.id);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível apagar o canal",
      );
    }
  }

  async function handleDeleteCategory(category: ChannelCategory) {
    if (
      !window.confirm(
        `Apagar o grupo "${category.name}"? Os canais vão para Sem grupo.`,
      )
    ) {
      return;
    }
    try {
      await deleteCategory(serverId, category.id);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível apagar o grupo",
      );
    }
  }

  async function handleVisibility(
    channel: Channel,
    visibility: ChannelVisibility,
  ) {
    if (channel.visibility === visibility) return;
    try {
      await updateChannel(serverId, channel.id, { visibility });
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível alterar a visibilidade",
      );
    }
  }

  function moveChannel(
    channelId: string,
    destCategoryId: string | null,
    beforeChannelId: string | null,
  ) {
    const nextGroups = groups.map((group) => ({
      categoryId: group.category?.id ?? null,
      channels: group.channels.filter((channel) => channel.id !== channelId),
    }));
    const moving = channels.find((channel) => channel.id === channelId);
    if (!moving) return;

    const dest = nextGroups.find((group) => group.categoryId === destCategoryId);
    if (!dest) return;
    if (beforeChannelId) {
      const index = dest.channels.findIndex(
        (channel) => channel.id === beforeChannelId,
      );
      dest.channels.splice(index >= 0 ? index : dest.channels.length, 0, moving);
    } else {
      dest.channels.push(moving);
    }

    const items = nextGroups.flatMap((group) =>
      group.channels.map((channel, position) => ({
        id: channel.id,
        categoryId: group.categoryId,
        position,
      })),
    );

    reorderChannels(serverId, items).catch((error) => {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível reordenar os canais",
      );
    });
  }

  function handleDragStart(event: DragEvent, channelId: string) {
    event.dataTransfer.setData("text/plain", channelId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(channelId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDropOnChannel(event: DragEvent, target: Channel) {
    event.preventDefault();
    event.stopPropagation();
    const channelId = event.dataTransfer.getData("text/plain");
    handleDragEnd();
    if (!channelId || channelId === target.id) return;
    moveChannel(channelId, target.categoryId, target.id);
  }

  function handleDropOnGroup(event: DragEvent, categoryId: string | null) {
    event.preventDefault();
    const channelId = event.dataTransfer.getData("text/plain");
    handleDragEnd();
    if (!channelId) return;
    moveChannel(channelId, categoryId, null);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar canais"
      description="Arraste canais entre grupos, reordene, renomeie, apague ou escolha quem pode vê-los."
      size="lg"
    >
      <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
        {groups.map(({ category, channels: groupChannels }) => {
          const groupKey = category?.id ?? "uncategorized";
          return (
            <section
              key={groupKey}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(`group:${groupKey}`);
              }}
              onDrop={(event) =>
                handleDropOnGroup(event, category?.id ?? null)
              }
              className={cn(
                "rounded-lg border border-border bg-surface/60 p-2",
                dropTarget === `group:${groupKey}` && "border-accent",
              )}
            >
              <header className="mb-1.5 flex items-center gap-1 px-1">
                {editingId === category?.id && category ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => commitRename("category", category.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter")
                        commitRename("category", category.id);
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    className="h-7 flex-1 rounded border border-accent bg-bg-primary px-2 text-caption font-semibold uppercase tracking-wide text-text-primary outline-none"
                  />
                ) : (
                  <span className="flex-1 truncate text-caption font-semibold uppercase tracking-wide text-text-muted">
                    {category?.name ?? "Sem grupo"}
                  </span>
                )}
                {category && editingId !== category.id && (
                  <>
                    <IconButton
                      aria-label="Renomear grupo"
                      size="sm"
                      onClick={() => startRename(category.id, category.name)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      aria-label="Apagar grupo"
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteCategory(category)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </>
                )}
              </header>

              <ul className="flex flex-col gap-1">
                {groupChannels.length === 0 && (
                  <li className="rounded-md border border-dashed border-border px-3 py-3 text-center text-caption text-text-muted">
                    Arraste um canal para cá
                  </li>
                )}
                {groupChannels.map((channel) => (
                  <li
                    key={channel.id}
                    draggable={editingId !== channel.id}
                    onDragStart={(event) =>
                      handleDragStart(event, channel.id)
                    }
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDropTarget(`channel:${channel.id}`);
                    }}
                    onDrop={(event) => handleDropOnChannel(event, channel)}
                    className={cn(
                      "flex items-center gap-2 rounded-md bg-bg-secondary px-2 py-1.5",
                      draggingId === channel.id && "opacity-50",
                      dropTarget === `channel:${channel.id}` &&
                        "ring-1 ring-accent",
                    )}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-muted" />
                    {channel.type === "VOICE" ? (
                      <Volume2 className="h-4 w-4 shrink-0 text-text-muted" />
                    ) : (
                      <Hash className="h-4 w-4 shrink-0 text-text-muted" />
                    )}
                    {editingId === channel.id ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        onBlur={() => commitRename("channel", channel.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter")
                            commitRename("channel", channel.id);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 min-w-0 flex-1 rounded border border-accent bg-bg-primary px-2 text-small text-text-primary outline-none"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-small text-text-primary">
                        {channel.name}
                      </span>
                    )}
                    <select
                      value={channel.visibility}
                      onChange={(event) =>
                        handleVisibility(
                          channel,
                          event.target.value as ChannelVisibility,
                        )
                      }
                      onClick={(event) => event.stopPropagation()}
                      className="h-7 max-w-[11rem] shrink-0 rounded border border-border bg-surface px-1.5 text-caption text-text-secondary outline-none focus:border-accent"
                    >
                      {VISIBILITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {CHANNEL_VISIBILITY_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    {editingId !== channel.id && (
                      <>
                        <IconButton
                          aria-label="Renomear canal"
                          size="sm"
                          onClick={() => startRename(channel.id, channel.name)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          aria-label="Apagar canal"
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteChannel(channel)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
