import { KEYBIND_ACTIONS } from "@/lib/keybinds";
import { useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { KeybindCapture } from "./KeybindCapture";
import type { Keybind, KeybindAction } from "@/types";

export function ShortcutSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const update = useSettingsStore((state) => state.update);

  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
  }, [settings, fetchSettings]);

  if (!settings) return null;

  function handleBind(action: KeybindAction, next: Keybind | null) {
    void update({
      keybinds: { ...settings!.keybinds, [action]: next },
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-heading text-text-primary">Atalhos</h1>
      <p className="mb-6 text-small text-text-secondary">
        Escolha as teclas que disparam as funções do Unbound. Clique no atalho e
        pressione a combinação desejada. Backspace remove o vínculo.
      </p>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {KEYBIND_ACTIONS.map((action) => (
          <li
            key={action.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-body font-medium text-text-primary">
                {action.label}
                {action.hold && (
                  <span className="ml-2 text-caption font-normal text-text-muted">
                    (segurar)
                  </span>
                )}
              </p>
              <p className="text-caption text-text-muted">
                {action.description}
              </p>
            </div>
            <KeybindCapture
              value={settings.keybinds[action.id]}
              onChange={(next) => handleBind(action.id, next)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
