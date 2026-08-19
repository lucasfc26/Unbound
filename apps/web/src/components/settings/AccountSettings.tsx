import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { updateAccount, changePassword, deleteAccount } from "@/lib/account";
import { ApiError } from "@/lib/api";

export function AccountSettings() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const pushToast = useToastStore((state) => state.push);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Minha conta</h1>

      <AccountForm
        username={user.username}
        email={user.email ?? ""}
        onSaved={(updated) => {
          updateUser(updated);
          pushToast("success", "Conta atualizada");
        }}
      />

      <PasswordForm />

      <DangerZone
        onDeleted={() => {
          // The account (and its server-side session) is already gone at this point —
          // clear local state directly rather than calling logout(), which would hit
          // /auth/logout for a user that no longer exists.
          clearSession();
          navigate("/login");
        }}
      />
    </div>
  );
}

function AccountForm({
  username: initialUsername,
  email: initialEmail,
  onSaved,
}: {
  username: string;
  email: string;
  onSaved: (updated: Awaited<ReturnType<typeof updateAccount>>) => void;
}) {
  const pushToast = useToastStore((state) => state.push);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !currentPassword) return;
    setSaving(true);
    try {
      const updated = await updateAccount({
        username: username !== initialUsername ? username : undefined,
        email: email !== initialEmail ? email : undefined,
        currentPassword,
      });
      onSaved(updated);
      setCurrentPassword("");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível atualizar a conta",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 border-b border-border pb-8">
      <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
        E-mail e nome de usuário
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Nome de usuário"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Senha atual"
          type="password"
          placeholder="Confirme com sua senha atual"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <Button
          type="submit"
          disabled={saving || !currentPassword}
          className="w-fit"
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const pushToast = useToastStore((state) => state.push);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (newPassword !== confirmPassword) {
      pushToast("error", "As senhas não coincidem");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      pushToast("success", "Senha alterada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível alterar a senha",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 border-b border-border pb-8">
      <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
        Alterar senha
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Senha atual"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <Input
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button
          type="submit"
          disabled={saving || !currentPassword || !newPassword}
          className="w-fit"
        >
          {saving ? "Salvando..." : "Alterar senha"}
        </Button>
      </form>
    </section>
  );
}

function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const pushToast = useToastStore((state) => state.push);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    if (deleting || confirmText !== "EXCLUIR") return;
    setDeleting(true);
    try {
      await deleteAccount(password);
      pushToast("success", "Conta excluída");
      onDeleted();
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível excluir a conta",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-danger">
        Zona de perigo
      </h2>
      <div className="rounded-md border border-danger/40 bg-danger/5 p-4">
        <p className="mb-3 text-small text-text-secondary">
          Excluir sua conta é permanente e não pode ser desfeito. Se você é
          dono de algum servidor, transfira a propriedade ou exclua-o antes de
          continuar.
        </p>
        <form onSubmit={handleDelete} className="flex flex-col gap-3">
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label='Digite "EXCLUIR" para confirmar'
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
          />
          <Button
            type="submit"
            variant="danger"
            disabled={deleting || !password || confirmText !== "EXCLUIR"}
            className="w-fit"
          >
            {deleting ? "Excluindo..." : "Excluir minha conta"}
          </Button>
        </form>
      </div>
    </section>
  );
}
