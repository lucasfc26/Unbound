import { create } from "zustand";
import type { UserSettings } from "@/types";
import {
  getUserSettings,
  toUserSettings,
  updateUserSettings,
  type UpdateUserSettingsInput,
} from "@/lib/settings";
import { getVoicePipeline } from "@/lib/voicePipeline";

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  fetch: () => Promise<void>;
  patchLocal: (input: UpdateUserSettingsInput) => void;
  update: (input: UpdateUserSettingsInput) => Promise<void>;
}

function mergeSettings(
  current: UserSettings,
  input: UpdateUserSettingsInput,
): UserSettings {
  return {
    ...current,
    ...input,
    keybinds: input.keybinds
      ? { ...current.keybinds, ...input.keybinds }
      : current.keybinds,
  };
}

function applyPipeline(settings: UserSettings) {
  const pipeline = getVoicePipeline();
  if (!pipeline) return;
  pipeline.setMicGain(settings.micGain);
  pipeline.setNoise(settings.noiseSuppressionMode, settings.noiseGate);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const api = await getUserSettings();
      const settings = toUserSettings(api);
      set({ settings });
      applyPipeline(settings);
    } finally {
      set({ isLoading: false });
    }
  },

  patchLocal: (input) => {
    const current = get().settings;
    if (!current) return;
    const next = mergeSettings(current, input);
    set({ settings: next });
    applyPipeline(next);
  },

  update: async (input) => {
    const current = get().settings;
    if (current) {
      const next = mergeSettings(current, input);
      set({ settings: next });
      applyPipeline(next);
    }
    const api = await updateUserSettings(input);
    const settings = toUserSettings(api);
    set({ settings });
    applyPipeline(settings);
  },
}));
