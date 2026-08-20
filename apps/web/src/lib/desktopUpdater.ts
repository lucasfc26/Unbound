import { isTauri } from "@tauri-apps/api/core";

export interface UpdateProgress {
  phase: "checking" | "downloading" | "installing" | "done" | "none" | "error";
  /** 0-100, only meaningful during "downloading". */
  percent?: number;
  version?: string;
  error?: string;
}

/**
 * Checks the configured updater endpoint (tauri.conf.json) and, if a newer
 * signed build is available, downloads + installs it and relaunches — no
 * "go download the installer again" round trip. No-op outside the desktop
 * app. Never throws; failures just report through onProgress so the app can
 * still boot normally instead of getting stuck on a splash screen.
 */
export async function checkAndInstallUpdate(
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  if (!isTauri()) {
    onProgress({ phase: "none" });
    return;
  }

  try {
    onProgress({ phase: "checking" });
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      onProgress({ phase: "none" });
      return;
    }

    onProgress({ phase: "downloading", percent: 0, version: update.version });
    let downloaded = 0;
    let total = 0;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress({
            phase: "downloading",
            percent: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : undefined,
            version: update.version,
          });
          break;
        case "Finished":
          onProgress({ phase: "installing", version: update.version });
          break;
      }
    });

    onProgress({ phase: "done", version: update.version });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (err) {
    // Missing/unreachable endpoint, no release published yet, etc. — not
    // fatal, just means the app boots on whatever version is installed.
    onProgress({
      phase: "error",
      error: err instanceof Error ? err.message : "Falha ao verificar atualização",
    });
  }
}
