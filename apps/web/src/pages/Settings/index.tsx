import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  User,
  Shield,
  Bell,
  Mic,
  Palette,
  Keyboard,
  Info,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/useAuthStore";
import { useToastStore } from "@/stores/useToastStore";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { VoiceSettings } from "@/components/settings/VoiceSettings";
import { IconButton } from "@/components/ui/IconButton";

type SettingsSection =
  | "account"
  | "profile"
  | "privacy"
  | "notifications"
  | "voice"
  | "appearance"
  | "shortcuts"
  | "about";

const sections: { id: SettingsSection; label: string; icon: typeof User }[] = [
  { id: "account", label: "Minha conta", icon: User },
  { id: "profile", label: "Perfil", icon: User },
  { id: "privacy", label: "Privacidade", icon: Shield },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "voice", label: "Voz e vídeo", icon: Mic },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "shortcuts", label: "Atalhos", icon: Keyboard },
  { id: "about", label: "Sobre", icon: Info },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [active, setActive] = useState<SettingsSection>("appearance");

  return (
    <div className="flex h-screen w-screen bg-bg-primary text-text-primary">
      <nav className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-bg-secondary px-3 py-6">
        <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
          {user?.displayName}
        </p>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActive(section.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body text-text-secondary hover:bg-hover hover:text-text-primary",
              active === section.id && "bg-active text-text-primary",
            )}
          >
            <section.icon className="h-4.5 w-4.5" />
            {section.label}
          </button>
        ))}
      </nav>

      <div className="relative flex-1 overflow-y-auto">
        <IconButton
          aria-label="Fechar configurações"
          variant="surface"
          className="absolute right-6 top-6"
          onClick={() => navigate(-1)}
        >
          <X />
        </IconButton>

        <div className="mx-auto max-w-2xl px-8 py-10">
          <SettingsPanel section={active} />
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ section }: { section: SettingsSection }) {
  const pushToast = useToastStore((state) => state.push);

  switch (section) {
    case "appearance":
      return <AppearanceSettings />;
    case "voice":
      return <VoiceSettings />;
    default:
      return (
        <div>
          <h1 className="mb-1 text-heading text-text-primary">
            {sections.find((s) => s.id === section)?.label}
          </h1>
          <p className="mb-6 text-small text-text-secondary">
            Esta seção será implementada em uma próxima etapa.
          </p>
          <button
            className="text-small text-accent hover:underline"
            onClick={() => pushToast("success", "Configurações salvas")}
          >
            Simular salvar
          </button>
        </div>
      );
  }
}
