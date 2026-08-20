import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import {
  previewInvite,
  joinByInvite,
  type ApiInvitePreview,
} from "@/lib/invites";
import { ApiError } from "@/lib/api";
import { useToastStore } from "@/stores/useToastStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);

  const [preview, setPreview] = useState<ApiInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;
    previewInvite(code)
      .then(setPreview)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o convite",
        ),
      )
      .finally(() => setLoading(false));
  }, [code]);

  async function handleJoin() {
    if (!code) return;
    setJoining(true);
    try {
      const server = await joinByInvite(code);
      pushToast("success", "Você entrou no servidor!");
      navigate(`/app/server/${server.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível entrar no servidor",
      );
      setJoining(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm animate-scale-in rounded-lg border border-border bg-elevated p-8 text-center shadow-lg">
        {loading && (
          <p className="text-body text-text-secondary">Carregando convite...</p>
        )}

        {!loading && error && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-danger/15 text-danger">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="mb-1 text-heading text-text-primary">
              Não foi possível entrar
            </h1>
            <p className="mb-6 text-small text-text-secondary">{error}</p>
            <Link to="/app" className="text-small text-accent hover:underline">
              Voltar para o Unbound
            </Link>
          </>
        )}

        {!loading && !error && preview && (
          <>
            <Avatar
              name={preview.server.name}
              color={preview.server.iconColor}
              imageUrl={preview.server.iconUrl}
              size="xl"
              className="mx-auto mb-4"
            />
            <p className="text-small text-text-secondary">
              Você foi convidado para
            </p>
            <h1 className="mb-1 text-heading text-text-primary">
              {preview.server.name}
            </h1>
            {preview.server.description && (
              <p className="mb-2 text-small text-text-secondary">
                {preview.server.description}
              </p>
            )}
            <p className="mb-6 text-caption text-text-muted">
              {preview.memberCount}{" "}
              {preview.memberCount === 1 ? "membro" : "membros"}
            </p>
            <Button className="w-full" onClick={handleJoin} disabled={joining}>
              {joining ? "Entrando..." : "Entrar no servidor"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
