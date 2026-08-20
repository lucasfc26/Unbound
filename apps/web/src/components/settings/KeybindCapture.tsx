import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatKeybind, keybindFromEvent } from "@/lib/keybinds";
import type { Keybind } from "@/types";

export function KeybindCapture({
  value,
  onChange,
}: {
  value: Keybind | null | undefined;
  onChange: (next: Keybind | null) => void;
}) {
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;

    function handleKey(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setListening(false);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        onChange(null);
        setListening(false);
        return;
      }
      if (event.code === "ControlLeft" || event.code === "ControlRight") return;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") return;
      if (event.code === "AltLeft" || event.code === "AltRight") return;
      if (event.code === "MetaLeft" || event.code === "MetaRight") return;
      onChange(keybindFromEvent(event));
      setListening(false);
    }

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [listening, onChange]);

  return (
    <Button
      type="button"
      variant={listening ? "primary" : "secondary"}
      size="sm"
      className="min-w-36"
      onClick={() => setListening((current) => !current)}
    >
      {listening ? "Pressione uma tecla..." : formatKeybind(value)}
    </Button>
  );
}
