import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToastStore } from "@/stores/useToastStore";
import { updateProfile, uploadAvatar } from "@/lib/account";
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
      if (avatarFile) {
        const uploaded = await uploadAvatar(avatarFile);
        updateUser(uploaded);
        setAvatarUrl(uploaded.avatarUrl ?? "");
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      const [updatedUser] = await Promise.all([
        updateProfile({
          displayName: displayName.trim(),
          avatarUrl: avatarFile ? undefined : avatarUrl.trim(),
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
            imageUrl={avatarPreview || avatarUrl || null}
            size="xl"
          />
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const prepared = await prepareAvatarFile(file);
                  if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                  setAvatarFile(prepared);
                  setAvatarPreview(URL.createObjectURL(prepared));
                } catch {
                  pushToast("error", "Não foi possível ler essa imagem");
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Enviar foto
              </Button>
              {(avatarUrl || avatarPreview) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                    setAvatarFile(null);
                    setAvatarPreview(null);
                    setAvatarUrl("");
                  }}
                >
                  Remover foto
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-caption text-text-muted">
              JPG, PNG, WEBP ou GIF de até 2 MB. A foto é salva com as outras
              alterações do perfil.
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

async function prepareAvatarFile(file: File): Promise<File> {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("too large");
  }
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) return file;
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
