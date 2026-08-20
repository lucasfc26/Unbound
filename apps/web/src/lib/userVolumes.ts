const STORAGE_KEY = "unbound:user-volumes";

export function loadUserVolumes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const next: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number") {
        next[id] = Math.max(0, Math.min(300, Math.round(value)));
      }
    }
    return next;
  } catch {
    return {};
  }
}

export function saveUserVolumes(volumes: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
  } catch {
    // storage unavailable
  }
}
