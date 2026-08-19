import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CreateCategoryModal({
  open,
  onClose,
  onCreate,
}: CreateCategoryModalProps) {
  const [name, setName] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(name.trim().toUpperCase());
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
      title="Criar categoria"
      description="Agrupe canais relacionados, como um novo grupo de jogos ou de conversas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate}>Criar categoria</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Nome da categoria"
          placeholder="NOVO GRUPO"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </form>
    </Modal>
  );
}
