import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 15_000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

/** Auto-switches the user to IDLE after inactivity, and back to ONLINE on the next activity — but only for
 * transitions it caused itself, so a status the user picked by hand (e.g. DND) is never overridden. */
export function useIdlePresence() {
  const setStatus = useAuthStore((state) => state.setStatus);
  const lastActivityRef = useRef(Date.now());
  const autoIdleRef = useRef(false);

  useEffect(() => {
    function handleActivity() {
      lastActivityRef.current = Date.now();
      if (!autoIdleRef.current) return;
      autoIdleRef.current = false;
      if (useAuthStore.getState().user?.status === "IDLE") {
        setStatus("ONLINE");
      }
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );

    const interval = window.setInterval(() => {
      const isIdleDue =
        Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS;
      if (isIdleDue && useAuthStore.getState().user?.status === "ONLINE") {
        autoIdleRef.current = true;
        setStatus("IDLE");
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      );
      window.clearInterval(interval);
    };
  }, [setStatus]);
}
