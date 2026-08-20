import type { Keybind, KeybindAction } from "@/types";

export const KEYBIND_ACTIONS: {
  id: KeybindAction;
  label: string;
  description: string;
  hold?: boolean;
}[] = [
  {
    id: "toggleMute",
    label: "Silenciar microfone",
    description: "Liga ou desliga o microfone na chamada.",
  },
  {
    id: "toggleDeafen",
    label: "Silenciar áudio",
    description: "Muta o fone e o microfone.",
  },
  {
    id: "pushToTalk",
    label: "Push to talk",
    description: "Segure para falar. Solte para silenciar.",
    hold: true,
  },
  {
    id: "toggleCamera",
    label: "Câmera",
    description: "Liga ou desliga a câmera.",
  },
  {
    id: "toggleScreenShare",
    label: "Compartilhar tela",
    description: "Inicia ou para a transmissão de tela.",
  },
  {
    id: "leaveCall",
    label: "Sair da chamada",
    description: "Encerra a sala de voz atual.",
  },
  {
    id: "openSettings",
    label: "Abrir configurações",
    description: "Abre a janela de configurações do Unbound.",
  },
  {
    id: "toggleNoiseSuppression",
    label: "Filtro de ruído",
    description: "Alterna entre filtro automático e manual.",
  },
];

export const DEFAULT_KEYBINDS: Partial<Record<KeybindAction, Keybind | null>> = {
  pushToTalk: { code: "KeyV", ctrl: false, alt: false, shift: false, meta: false },
};

export function keybindFromEvent(event: KeyboardEvent): Keybind {
  return {
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function formatKeybind(bind: Keybind | null | undefined): string {
  if (!bind) return "Nenhum";
  const parts: string[] = [];
  if (bind.ctrl) parts.push("Ctrl");
  if (bind.alt) parts.push("Alt");
  if (bind.shift) parts.push("Shift");
  if (bind.meta) parts.push("Meta");
  parts.push(prettyCode(bind.code));
  return parts.join(" + ");
}

export function keybindsMatch(
  bind: Keybind | null | undefined,
  event: KeyboardEvent,
): boolean {
  if (!bind) return false;
  return (
    bind.code === event.code &&
    bind.ctrl === event.ctrlKey &&
    bind.alt === event.altKey &&
    bind.shift === event.shiftKey &&
    bind.meta === event.metaKey
  );
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function prettyCode(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const labels: Record<string, string> = {
    Space: "Espaço",
    ShiftLeft: "Shift Esq",
    ShiftRight: "Shift Dir",
    ControlLeft: "Ctrl Esq",
    ControlRight: "Ctrl Dir",
    AltLeft: "Alt Esq",
    AltRight: "Alt Dir",
    MetaLeft: "Win",
    MetaRight: "Win",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    CapsLock: "Caps Lock",
  };
  return labels[code] ?? code;
}
