import { create } from "zustand";
import type { UserSettings } from "@/types";
import {
  getUserSettings,
  toUserSettings,
  updateUserSettings,
  type UpdateUserSettingsInput,
} from "@/lib/settings";

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  fetch: () => Promise<void>;
  update: (input: UpdateUserSettingsInput) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const api = await getUserSettings();
      set({ settings: toUserSettings(api) });
    } finally {
      set({ isLoading: false });
    }
  },

  update: async (input) => {
    const api = await updateUserSettings(input);
    set({ settings: toUserSettings(api) });
  },
}));
