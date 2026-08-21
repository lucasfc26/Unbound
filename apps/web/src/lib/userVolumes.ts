const STORAGE_KEY = "unbound:user-volumes";
const STREAM_STORAGE_KEY = "unbound:stream-volumes";

function loadVolumes(key: string, max: number): Record<string, number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const next: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number") {
        next[id] = Math.max(0, Math.min(max, Math.round(value)));
      }
    }
    return next;
  } catch {
    return {};
  }
}

function saveVolumes(key: string, volumes: Record<string, number>): void {
  try {
    localStorage.setItem(key, JSON.stringify(volumes));
  } catch {
    // storage unavailable
  }
}

export function loadUserVolumes(): Record<string, number> {
  return loadVolumes(STORAGE_KEY, 300);
}

export function saveUserVolumes(volumes: Record<string, number>): void {
  saveVolumes(STORAGE_KEY, volumes);
}

/** Per-broadcaster volume for screen-share audio while watching a transmission. */
export function loadStreamVolumes(): Record<string, number> {
  return loadVolumes(STREAM_STORAGE_KEY, 100);
}

export function saveStreamVolumes(volumes: Record<string, number>): void {
  saveVolumes(STREAM_STORAGE_KEY, volumes);
}
