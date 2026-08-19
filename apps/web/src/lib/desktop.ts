import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === "granted";
  }
  return permissionGranted;
}

/** No-op outside the Tauri desktop app — safe to call unconditionally from shared frontend code. */
export async function notifyDesktop(
  title: string,
  body: string,
): Promise<void> {
  if (!isTauri()) return;
  if (!(await ensurePermission())) return;
  sendNotification({ title, body });
}
