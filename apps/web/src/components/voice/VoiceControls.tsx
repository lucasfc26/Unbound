import { Video, VideoOff, MonitorUp, PhoneOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useServerStore } from "@/stores/useServerStore";

export function VoiceControls() {
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  const cameraEnabled = useVoiceStore((state) => state.cameraEnabled);
  const screenSharing = useVoiceStore((state) => state.screenSharing);
  const toggleCamera = useVoiceStore((state) => state.toggleCamera);
  const startScreenShare = useVoiceStore((state) => state.startScreenShare);
  const stopScreenShare = useVoiceStore((state) => state.stopScreenShare);
  const leave = useVoiceStore((state) => state.leave);
  const channels = useServerStore((state) => state.channels);

  function handleLeave() {
    leave();
    const textChannel = channels.find(
      (channel) => channel.serverId === serverId && channel.type === "TEXT",
    );
    if (textChannel && serverId) {
      navigate(`/app/server/${serverId}/channel/${textChannel.id}`);
      return;
    }
    if (serverId) {
      navigate(`/app/server/${serverId}`);
      return;
    }
    navigate("/app/friends");
  }

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-black/20 bg-bg-secondary px-4 py-4">
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
