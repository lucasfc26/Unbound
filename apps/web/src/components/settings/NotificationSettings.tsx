import { useEffect } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";

export function NotificationSettings() {
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
  ) {
    try {
      await update(input);
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
      <h1 className="mb-6 text-heading text-text-primary">Notificações</h1>

      <section className="divide-y divide-border">
        <Toggle
          checked={settings.desktopNotifications}
          onChange={(checked) => handleChange({ desktopNotifications: checked })}
          label="Notificações no desktop"
          description="Mostrar um aviso do sistema quando chegar uma mensagem enquanto o app estiver em segundo plano."
        />
        <Toggle
          checked={settings.notificationSound}
          onChange={(checked) => handleChange({ notificationSound: checked })}
          label="Som de notificação"
          description="Tocar um som curto junto com as notificações de novas mensagens."
        />
      </section>
    </div>
  );
}
