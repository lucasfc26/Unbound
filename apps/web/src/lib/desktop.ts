import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let tauriPermissionChecked = false;
let tauriPermissionGranted = false;

async function ensureTauriPermission(): Promise<boolean> {
  if (tauriPermissionChecked) return tauriPermissionGranted;
  tauriPermissionChecked = true;
  tauriPermissionGranted = await isPermissionGranted();
  if (!tauriPermissionGranted) {
    tauriPermissionGranted = (await requestPermission()) === "granted";
  }
  return tauriPermissionGranted;
}

async function ensureBrowserPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** No-op if notifications aren't available or permitted — safe to call unconditionally. */
export async function notifyDesktop(
  title: string,
  body: string,
): Promise<void> {
  if (isTauri()) {
    if (await ensureTauriPermission()) sendNotification({ title, body });
    return;
  }
  if (await ensureBrowserPermission()) new Notification(title, { body });
}
