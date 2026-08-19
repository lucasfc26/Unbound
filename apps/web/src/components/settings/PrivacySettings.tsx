import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Toggle } from "@/components/ui/Toggle";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import type { FriendRequestPrivacy } from "@/types";

const friendRequestOptions: { id: FriendRequestPrivacy; label: string }[] = [
  { id: "EVERYONE", label: "Todos podem me enviar" },
  { id: "NOBODY", label: "Ninguém pode me enviar" },
];

export function PrivacySettings() {
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const update = useSettingsStore((state) => state.update);
  const pushToast = useToastStore((state) => state.push);

  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChange(
    input: Parameters<typeof update>[0],
    successMessage: string,
  ) {
    try {
      await update(input);
      pushToast("success", successMessage);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível salvar essa preferência",
      );
    }
  }

  if (!settings) return null;

  return (
    <div>
      <h1 className="mb-6 text-heading text-text-primary">Privacidade</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Solicitações de amizade
        </h2>
        <div className="flex flex-col gap-2">
          {friendRequestOptions.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={settings.friendRequestPrivacy === option.id}
              onClick={() =>
                handleChange(
                  { friendRequestPrivacy: option.id },
                  "Preferência de amizade atualizada",
                )
              }
              className={cn(
                "flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5 text-left text-body text-text-primary transition-colors duration-150 hover:bg-hover",
                settings.friendRequestPrivacy === option.id && "border-accent",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  settings.friendRequestPrivacy === option.id
                    ? "border-accent"
                    : "border-border-strong",
                )}
              >
                {settings.friendRequestPrivacy === option.id && (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                )}
              </span>
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-caption text-text-muted">
          Controla quem pode te adicionar por nome de usuário ou código de
          amigo.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          Atividade
        </h2>
        <Toggle
          checked={settings.shareTypingStatus}
          onChange={(checked) =>
            handleChange(
              { shareTypingStatus: checked },
              checked
                ? "Agora outras pessoas veem quando você está digitando"
                : "Seu indicador de digitação está oculto",
            )
          }
          label="Mostrar quando eu estiver digitando"
          description="Desative para ocultar o indicador de digitação dos outros membros do canal."
        />
      </section>
    </div>
  );
}
