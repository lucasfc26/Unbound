import { useRef, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ImageCropDialog } from "@/components/media/ImageCropDialog";
import { SERVER_COLOR_OPTIONS } from "@/lib/serverColors";
import { assertImageFile } from "@/lib/imageFile";
import { useToastStore } from "@/stores/useToastStore";

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description?: string;
    iconColor: string;
    iconFile?: File;
  }) => void | Promise<void>;
}

export function CreateServerModal({
  open,
  onClose,
  onCreate,
}: CreateServerModalProps) {
  const pushToast = useToastStore((state) => state.push);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(SERVER_COLOR_OPTIONS[0]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setColor(SERVER_COLOR_OPTIONS[0]);
    setIconFile(null);
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconPreview(null);
    setCropSource(null);
  }

  async function handleCreate() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        iconColor: color,
        iconFile: iconFile ?? undefined,
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    handleCreate();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          reset();
          onClose();
        }}
        title="Criar um servidor"
        description="Dê um nome, uma cor e, se quiser, uma foto para o seu espaço."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Criando..." : "Criar"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={name || "Novo servidor"}
              color={color}
              imageUrl={iconPreview}
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
                {iconPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (iconPreview) URL.revokeObjectURL(iconPreview);
                      setIconFile(null);
                      setIconPreview(null);
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
                    className={`h-6 w-6 rounded-full transition-transform duration-150 ${
                      color === option
                        ? "ring-2 ring-text-primary ring-offset-2 ring-offset-elevated scale-110"
                        : ""
                    }`}
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
            placeholder="Meu servidor"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Sobre o que é esse servidor?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </form>
      </Modal>

      <ImageCropDialog
        file={cropSource}
        open={Boolean(cropSource)}
        title="Recortar ícone do servidor"
        onCancel={() => setCropSource(null)}
        onConfirm={(file) => {
          if (iconPreview) URL.revokeObjectURL(iconPreview);
          setIconFile(file);
          setIconPreview(URL.createObjectURL(file));
          setCropSource(null);
        }}
      />
    </>
  );
}
