const STORAGE_KEY = "unbound:device-preferences";

export interface DevicePreferences {
  micDeviceId: string | null;
  speakerDeviceId: string | null;
  cameraDeviceId: string | null;
}

const DEFAULTS: DevicePreferences = {
  micDeviceId: null,
  speakerDeviceId: null,
  cameraDeviceId: null,
};

export function loadDevicePreferences(): DevicePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DevicePreferences>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDevicePreference(key: keyof DevicePreferences, value: string | null): void {
  const current = loadDevicePreferences();
  current[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage unavailable (private browsing, etc.) — preference just won't persist
  }
}
