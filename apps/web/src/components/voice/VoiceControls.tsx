import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Headphones,
  PhoneOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useVoiceStore } from "@/stores/useVoiceStore";

export function VoiceControls({ onLeave }: { onLeave?: () => void }) {
  const navigate = useNavigate();
  const micEnabled = useVoiceStore((state) => state.micEnabled);
  const cameraEnabled = useVoiceStore((state) => state.cameraEnabled);
  const screenSharing = useVoiceStore((state) => state.screenSharing);
  const toggleMic = useVoiceStore((state) => state.toggleMic);
  const toggleCamera = useVoiceStore((state) => state.toggleCamera);
  const startScreenShare = useVoiceStore((state) => state.startScreenShare);
  const stopScreenShare = useVoiceStore((state) => state.stopScreenShare);
  const leave = useVoiceStore((state) => state.leave);
  const [deafened, setDeafened] = useState(false);

  function handleLeave() {
    leave();
    (onLeave ?? (() => navigate(-1)))();
  }

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-black/20 bg-bg-secondary px-4 py-4">
      <Tooltip content={micEnabled ? "Mutar microfone" : "Ativar microfone"}>
        <IconButton
          aria-label={micEnabled ? "Mutar microfone" : "Ativar microfone"}
          size="lg"
          variant={micEnabled ? "surface" : "danger"}
          onClick={toggleMic}
        >
          {micEnabled ? <Mic /> : <MicOff />}
        </IconButton>
      </Tooltip>

      <Tooltip content={cameraEnabled ? "Desativar câmera" : "Ativar câmera"}>
        <IconButton
          aria-label={cameraEnabled ? "Desativar câmera" : "Ativar câmera"}
          size="lg"
          variant={cameraEnabled ? "active" : "surface"}
          onClick={toggleCamera}
        >
          {cameraEnabled ? <Video /> : <VideoOff />}
        </IconButton>
      </Tooltip>

      <Tooltip
        content={screenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
      >
        <IconButton
          aria-label={
            screenSharing ? "Parar compartilhamento" : "Compartilhar tela"
          }
          size="lg"
          variant={screenSharing ? "active" : "surface"}
          onClick={() =>
            screenSharing ? stopScreenShare() : startScreenShare()
          }
        >
          <MonitorUp />
        </IconButton>
      </Tooltip>

      <Tooltip content={deafened ? "Reativar áudio" : "Silenciar tudo"}>
        <IconButton
          aria-label={deafened ? "Reativar áudio" : "Silenciar tudo"}
          size="lg"
          variant={deafened ? "danger" : "surface"}
          onClick={() => setDeafened((v) => !v)}
        >
          <Headphones />
        </IconButton>
      </Tooltip>

      <Tooltip content="Sair da chamada">
        <IconButton
          aria-label="Sair da chamada"
          size="lg"
          variant="danger"
          className="bg-danger text-white hover:brightness-110"
          onClick={handleLeave}
        >
          <PhoneOff />
        </IconButton>
      </Tooltip>
    </div>
  );
}
