import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToastStore } from "@/stores/useToastStore";
import { updateProfile } from "@/lib/account";
import { ApiError } from "@/lib/api";

export function ProfileSettings() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const updateSettings = useSettingsStore((state) => state.update);
  const pushToast = useToastStore((state) => state.push);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [pronouns, setPronouns] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings) {
      setPronouns(settings.pronouns ?? "");
      setCustomStatus(settings.customStatus ?? "");
      setBio(settings.bio ?? "");
    }
  }, [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !user) return;
    setSaving(true);
    try {
      const [updatedUser] = await Promise.all([
        updateProfile({
          displayName: displayName.trim(),
          avatarUrl: avatarUrl.trim(),
        }),
        updateSettings({
          pronouns: pronouns.trim(),
          customStatus: customStatus.trim(),
          bio: bio.trim(),
        }),
      ]);
      updateUser(updatedUser);
      pushToast("success", "Perfil atualizado");
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível atualizar o perfil",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Perfil</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar
            name={displayName || user.displayName}
            color={user.avatarColor}
            imageUrl={avatarUrl || null}
            size="xl"
          />
          <div className="flex-1">
            <Input
              label="URL do avatar"
              placeholder="https://exemplo.com/avatar.png"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
            <p className="mt-1.5 text-caption text-text-muted">
              Deixe em branco para usar suas iniciais.
            </p>
          </div>
        </div>

        <Input
          label="Nome de exibição"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={50}
        />

        <Input
          label="Pronomes"
          placeholder="ela/dela, ele/dele, elu/delu..."
          value={pronouns}
          onChange={(event) => setPronouns(event.target.value)}
          maxLength={40}
        />

        <Input
          label="Status personalizado"
          placeholder="O que você está fazendo?"
          value={customStatus}
          onChange={(event) => setCustomStatus(event.target.value)}
          maxLength={100}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-small font-medium text-text-secondary">
            Sobre mim
          </label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={190}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-body text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
            placeholder="Conte um pouco sobre você"
          />
          <p className="text-caption text-text-muted">{bio.length}/190</p>
        </div>

        <Button type="submit" disabled={saving} className="w-fit">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>
    </div>
  );
}
