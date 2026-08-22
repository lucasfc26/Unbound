import { useEffect, useState, type FormEvent } from "react";
import { Hash, Volume2 } from "lucide-react";
import { Modal } from "./Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type {
  ChannelCategory,
  ChannelType,
  ChannelVisibility,
} from "@/types";
import { CHANNEL_VISIBILITY_LABELS } from "@/lib/permissions";

interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    type: ChannelType;
    categoryId: string | null;
    visibility: ChannelVisibility;
  }) => void;
  categories: ChannelCategory[];
  defaultType?: ChannelType;
  defaultCategoryId?: string | null;
}

export function CreateChannelModal({
  open,
  onClose,
  onCreate,
  categories,
  defaultType = "TEXT",
  defaultCategoryId = null,
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>(defaultType);
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId,
  );
  const [visibility, setVisibility] = useState<ChannelVisibility>("EVERYONE");

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setCategoryId(defaultCategoryId);
      setVisibility("EVERYONE");
    }
  }, [open, defaultType, defaultCategoryId]);

  function handleCreate() {
    if (!name.trim()) return;
    onCreate({
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      type,
      categoryId,
      visibility,
    });
    setName("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    handleCreate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar canal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate}>Criar canal</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-small font-medium text-text-secondary">
            Tipo
          </p>
          <div className="flex flex-col gap-2">
            <TypeOption
              icon={Hash}
              label="Texto"
              description="Envie mensagens, links e imagens"
              selected={type === "TEXT"}
              onSelect={() => setType("TEXT")}
            />
            <TypeOption
              icon={Volume2}
              label="Voz"
              description="Converse por áudio e compartilhe a tela"
              selected={type === "VOICE"}
              onSelect={() => setType("VOICE")}
            />
          </div>
        </div>

        <Input
          label="Nome"
          placeholder={type === "TEXT" ? "novo-canal" : "Sala de voz"}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />

        <div>
          <label
            className="mb-1.5 block text-small font-medium text-text-secondary"
            htmlFor="channel-visibility"
          >
            Quem pode ver
          </label>
          <select
            id="channel-visibility"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as ChannelVisibility)
            }
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary outline-none focus:border-accent"
          >
            {(
              Object.keys(CHANNEL_VISIBILITY_LABELS) as ChannelVisibility[]
            ).map((option) => (
              <option key={option} value={option}>
                {CHANNEL_VISIBILITY_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        {categories.length > 0 && (
          <div>
            <label
              className="mb-1.5 block text-small font-medium text-text-secondary"
              htmlFor="channel-category"
            >
              Categoria
            </label>
            <select
              id="channel-category"
              value={categoryId ?? ""}
              onChange={(event) => setCategoryId(event.target.value || null)}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary outline-none focus:border-accent"
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}

function TypeOption({
  icon: Icon,
  label,
  description,
  selected,
  onSelect,
}: {
  icon: typeof Hash;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-hover",
        selected && "border-accent",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-accent" : "border-border-strong",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <Icon className="h-4.5 w-4.5 shrink-0 text-text-secondary" />
      <span>
        <span className="block text-small font-medium text-text-primary">
          {label}
        </span>
        <span className="block text-caption text-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}
