import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Volume2 } from "lucide-react";
import { useServerStore } from "@/stores/useServerStore";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { avatarColorFor } from "@/lib/avatarColor";
import { ChannelSidebar } from "@/components/channel/ChannelSidebar";
import {
  VoiceParticipantGrid,
  type ScreenShareInfo,
} from "@/components/voice/VoiceParticipantGrid";
import { VoiceControls } from "@/components/voice/VoiceControls";

export default function VoicePage() {
  const { serverId, channelId } = useParams<{
    serverId: string;
    channelId: string;
  }>();
  const server = useServerStore((state) =>
    state.servers.find((item) => item.id === serverId),
  );
  const channel = useServerStore((state) =>
    state.channels.find(
      (item) => item.id === channelId && item.serverId === serverId,
    ),
  );

  const currentUser = useAuthStore((state) => state.user);
  const join = useVoiceStore((state) => state.join);
  const leave = useVoiceStore((state) => state.leave);
  const isConnecting = useVoiceStore((state) => state.isConnecting);
  const localStream = useVoiceStore((state) => state.localStream);
  const micEnabled = useVoiceStore((state) => state.micEnabled);
  const cameraEnabled = useVoiceStore((state) => state.cameraEnabled);
  const screenSharing = useVoiceStore((state) => state.screenSharing);
  const screenStream = useVoiceStore((state) => state.screenStream);
  const stopScreenShare = useVoiceStore((state) => state.stopScreenShare);
  const remoteParticipants = useVoiceStore((state) => state.remoteParticipants);
  const speakingChannelId = useVoiceStore((state) => state.speakingChannelId);
  const speakingUserId = useVoiceStore((state) => state.speakingUserId);

  useEffect(() => {
    if (!channelId) return;
    join(channelId);
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  if (!server || !channel) {
    return (
      <div className="flex flex-1">
        <ChannelSidebar />
        <div className="flex flex-1 items-center justify-center bg-bg-primary text-text-secondary">
          Sala de voz não encontrada.
        </div>
      </div>
    );
  }

  const participants = [
    ...(currentUser
      ? [
          {
            user: {
              ...currentUser,
              avatarColor: avatarColorFor(currentUser.id),
            },
            speaking:
              speakingChannelId === channel.id &&
              speakingUserId === currentUser.id,
            muted: !micEnabled,
            stream: micEnabled || cameraEnabled ? localStream : null,
            isLocal: true,
            connectionState: "connected" as RTCPeerConnectionState,
          },
        ]
      : []),
    ...Object.values(remoteParticipants).map((participant) => ({
      user: {
        id: participant.userId,
        username: participant.displayName,
        displayName: participant.displayName,
        avatarUrl: null,
        avatarColor: avatarColorFor(participant.userId),
        status: "ONLINE" as const,
        createdAt: "",
      },
      speaking:
        speakingChannelId === channel.id &&
        speakingUserId === participant.userId,
      muted: participant.micMuted,
      stream: participant.stream,
      isLocal: false,
      connectionState: participant.connectionState,
    })),
  ];

  const remoteSharing = Object.values(remoteParticipants).find(
    (participant) => participant.sharingScreen && participant.screenStream,
  );

  const screenShare: ScreenShareInfo | null =
    screenSharing && screenStream
      ? {
          displayName: currentUser?.displayName ?? "Você",
          stream: screenStream,
          isLocal: true,
        }
      : remoteSharing
        ? {
            displayName: remoteSharing.displayName,
            stream: remoteSharing.screenStream!,
            isLocal: false,
          }
        : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChannelSidebar />

      <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
          <Volume2 className="h-5 w-5 text-text-secondary" />
          <span className="text-body font-semibold text-text-primary">
            {channel.name}
          </span>
          {isConnecting && (
            <span className="text-caption text-text-muted">Conectando...</span>
          )}
        </header>

        <VoiceParticipantGrid
          participants={participants}
          screenShare={screenShare}
          onStopScreenShare={stopScreenShare}
        />
        <VoiceControls />
      </div>
    </div>
  );
}
