import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SERVER_COLOR_OPTIONS } from "@/lib/serverColors";

interface CreateServerModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description?: string;
    iconColor: string;
  }) => void | Promise<void>;
}

export function CreateServerModal({
  open,
  onClose,
  onCreate,
}: CreateServerModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(SERVER_COLOR_OPTIONS[0]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setColor(SERVER_COLOR_OPTIONS[0]);
  }

  async function handleCreate() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        iconColor: color,
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
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Criar um servidor"
      description="Dê um nome e uma cor para o seu espaço."
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
          <Avatar name={name || "Novo servidor"} color={color} size="lg" />
          <div className="flex-1">
            <p className="mb-1.5 text-small font-medium text-text-secondary">
              Foto do servidor
            </p>
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
              Upload de imagem chega em uma etapa futura.
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
  );
}
