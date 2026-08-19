import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import { createInvite } from "@/lib/invites";
import type { Server } from "@/types";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  server: Server;
}

const INVITE_EXPIRY_DAYS = 7;

export function InviteModal({ open, onClose, server }: InviteModalProps) {
  const pushToast = useToastStore((state) => state.push);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setError(null);
    setCode(null);
    setLoading(true);
    createInvite(server.id, { expiresInDays: INVITE_EXPIRY_DAYS })
      .then((invite) => setCode(invite.code))
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível criar o convite",
        ),
      )
      .finally(() => setLoading(false));
  }, [open, server.id]);

  const link = code ? `${window.location.origin}/invite/${code}` : null;

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    pushToast("success", "Convite copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar para o servidor"
      description="Envie este link para seus amigos entrarem."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCopy} disabled={!link}>
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </>
      }
    >
      {loading && (
        <p className="text-small text-text-secondary">Gerando convite...</p>
      )}
      {error && <p className="text-small text-danger">{error}</p>}

      {link && (
        <>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5">
            <span className="flex-1 truncate text-body text-text-primary">
              {link}
            </span>
            <button
              aria-label="Copiar link de convite"
              onClick={handleCopy}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-secondary hover:bg-hover hover:text-text-primary"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-small text-text-muted">
            O convite expira em {INVITE_EXPIRY_DAYS} dias.
          </p>
        </>
      )}
    </Modal>
  );
}
