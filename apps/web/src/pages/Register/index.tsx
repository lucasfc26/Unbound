import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const pushToast = useToastStore((state) => state.push);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        displayName,
        username: username.toLowerCase(),
        email,
        password,
      });
      pushToast("success", "Conta criada com sucesso");
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
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-black">
            <img src="/favicon.png" alt="Unbound" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-heading text-text-primary">Criar sua conta</h1>
          <p className="text-small text-text-secondary">
            Junte-se ao seu grupo no Unbound
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nome de exibição"
            placeholder="Lucas Cunha"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
          <Input
            label="Usuário"
            placeholder="lucas"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            pattern="[a-z0-9_]{3,20}"
            title="3 a 20 caracteres: letras minúsculas, números e underscore"
          />
          <Input
            label="E-mail"
            type="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            error={error ?? undefined}
          />
          <Button type="submit" className="mt-2 w-full" disabled={submitting}>
            {submitting ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-small text-text-secondary">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
