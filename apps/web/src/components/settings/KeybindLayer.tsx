import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useVoiceStore } from "@/stores/useVoiceStore";
import {
  isTypingTarget,
  keybindsMatch,
} from "@/lib/keybinds";
import type { KeybindAction } from "@/types";

export function KeybindLayer() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const updateSettings = useSettingsStore((state) => state.update);
  const setPttHeld = useVoiceStore((state) => state.setPttHeld);

  useEffect(() => {
    if (user && !settings) fetchSettings().catch(() => {});
  }, [user, settings, fetchSettings]);

  useEffect(() => {
    useVoiceStore.getState().syncMic();
  }, [settings?.pushToTalkEnabled]);

  useEffect(() => {
    const binds = settings?.keybinds ?? {};
    const pttEnabled = settings?.pushToTalkEnabled ?? false;
    if (!user) return;

    function run(action: KeybindAction) {
      const voice = useVoiceStore.getState();
      switch (action) {
        case "toggleMute":
          voice.toggleMic();
          break;
        case "toggleDeafen":
          voice.toggleDeafen();
          break;
        case "toggleCamera":
          void voice.toggleCamera();
          break;
        case "toggleScreenShare":
          if (voice.screenSharing) voice.stopScreenShare();
          else void voice.startScreenShare();
          break;
        case "leaveCall":
          voice.leave();
          break;
        case "openSettings":
          navigate("/app/settings");
          break;
        case "toggleNoiseSuppression": {
          const current = useSettingsStore.getState().settings;
          if (!current) return;
          void updateSettings({
            noiseSuppressionMode:
              current.noiseSuppressionMode === "auto" ? "manual" : "auto",
          });
          break;
        }
        default:
          break;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      const ptt = binds.pushToTalk;
      if (pttEnabled && ptt && keybindsMatch(ptt, event)) {
        setPttHeld(true);
        return;
      }
      if (isTypingTarget(event.target)) return;
      for (const [action, bind] of Object.entries(binds)) {
        if (action === "pushToTalk") continue;
        if (keybindsMatch(bind, event)) {
          event.preventDefault();
          run(action as KeybindAction);
          return;
        }
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const ptt = binds.pushToTalk;
      if (pttEnabled && ptt && keybindsMatch(ptt, event)) {
        event.preventDefault();
        setPttHeld(false);
      }
    }

    function onBlur() {
      setPttHeld(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [navigate, setPttHeld, settings, updateSettings, user]);

  return null;
}
