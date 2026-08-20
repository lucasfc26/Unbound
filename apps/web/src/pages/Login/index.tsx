import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const pushToast = useToastStore((state) => state.push);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      pushToast("success", "Login realizado");
      navigate("/app");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível conectar ao servidor",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm animate-scale-in rounded-lg border border-border bg-elevated p-8 shadow-lg">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-small text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-black">
            <img src="/favicon.png" alt="Unbound" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-heading text-text-primary">Bem-vindo de volta</h1>
          <p className="text-small text-text-secondary">
            Entre para continuar no Unbound
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Usuário ou e-mail"
            placeholder="usuário"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            error={error ?? undefined}
          />
          <Button type="submit" className="mt-2 w-full" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-small text-text-secondary">
          Não tem uma conta?{" "}
          <Link
            to="/register"
            className="font-medium text-accent hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
