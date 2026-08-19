import { create } from "zustand";
import { loadDevicePreferences, saveDevicePreference } from "@/lib/devicePreferences";

interface DeviceState {
  micDeviceId: string | null;
  speakerDeviceId: string | null;
  cameraDeviceId: string | null;
  setMicDevice: (id: string | null) => void;
  setSpeakerDevice: (id: string | null) => void;
  setCameraDevice: (id: string | null) => void;
}

const initial = loadDevicePreferences();

export const useDeviceStore = create<DeviceState>((set) => ({
  micDeviceId: initial.micDeviceId,
  speakerDeviceId: initial.speakerDeviceId,
  cameraDeviceId: initial.cameraDeviceId,

  setMicDevice: (id) => {
    saveDevicePreference("micDeviceId", id);
    set({ micDeviceId: id });
  },
  setSpeakerDevice: (id) => {
    saveDevicePreference("speakerDeviceId", id);
    set({ speakerDeviceId: id });
  },
  setCameraDevice: (id) => {
    saveDevicePreference("cameraDeviceId", id);
    set({ cameraDeviceId: id });
  },
}));
