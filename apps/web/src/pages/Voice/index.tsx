import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Volume2 } from "lucide-react";
import { useServerStore } from "@/stores/useServerStore";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { avatarColorFor } from "@/lib/avatarColor";
import { VoiceParticipantGrid } from "@/components/voice/VoiceParticipantGrid";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { VoiceChatPanel } from "@/components/voice/VoiceChatPanel";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";

function formatPing(ms: number | null): string {
  if (ms == null) return "—";
  return `${Math.max(0, Math.round(ms))} ms`;
}

export default function VoicePage() {
  const navigate = useNavigate();
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
  const isConnecting = useVoiceStore((state) => state.isConnecting);
  const localStream = useVoiceStore((state) => state.localStream);
  const micEnabled = useVoiceStore((state) => state.micEnabled);
  const serverMuted = useVoiceStore((state) => state.serverMuted);
  const cameraEnabled = useVoiceStore((state) => state.cameraEnabled);
  const screenSharing = useVoiceStore((state) => state.screenSharing);
  const screenStream = useVoiceStore((state) => state.screenStream);
  const stopScreenShare = useVoiceStore((state) => state.stopScreenShare);
  const remoteParticipants = useVoiceStore((state) => state.remoteParticipants);
  const speakingChannelId = useVoiceStore((state) => state.speakingChannelId);
  const speakingUserId = useVoiceStore((state) => state.speakingUserId);
  const serverPingMs = useVoiceStore((state) => state.serverPingMs);
  const p2pPingMs = useVoiceStore((state) => state.p2pPingMs);
  const pendingVoicePath = useVoiceStore((state) => state.pendingVoicePath);
  const clearPendingVoicePath = useVoiceStore(
    (state) => state.clearPendingVoicePath,
  );
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!channelId) return;
    join(channelId);
    // Stay in the call when navigating away — leave() only runs from the hang-up control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    if (!pendingVoicePath) return;
    if (pendingVoicePath.channelId === channelId) {
      clearPendingVoicePath();
      return;
    }
    if (pendingVoicePath.fromChannelId === channelId) {
      navigate(
        `/app/server/${pendingVoicePath.serverId}/voice/${pendingVoicePath.channelId}`,
      );
    }
    clearPendingVoicePath();
  }, [pendingVoicePath, channelId, navigate, clearPendingVoicePath]);

  if (!server || !channel) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-bg-primary text-text-secondary">
        Sala de voz não encontrada.
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
            muted: !micEnabled || serverMuted,
            stream: micEnabled || cameraEnabled ? localStream : null,
            isLocal: true,
            connectionState: "connected" as RTCPeerConnectionState,
            sharingScreen: screenSharing,
            screenStream: screenSharing ? screenStream : null,
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
      muted: participant.micMuted || participant.serverMuted,
      stream: participant.stream,
      isLocal: false,
      connectionState: participant.connectionState,
      sharingScreen: participant.sharingScreen,
      screenStream: participant.screenStream,
    })),
  ];

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
          <Volume2 className="h-5 w-5 text-text-secondary" />
          <span className="text-body font-semibold text-text-primary">
            {channel.name}
          </span>
          {isConnecting && (
            <span className="text-caption text-text-muted">Conectando...</span>
          )}
          <span className="ml-2 text-caption text-text-muted">
            Servidor {formatPing(serverPingMs)}
            {p2pPingMs != null ? ` · P2P ${formatPing(p2pPingMs)}` : ""}
          </span>
          <div className="ml-auto">
            <Tooltip content={chatOpen ? "Fechar chat" : "Abrir chat de texto"}>
              <IconButton
                aria-label={chatOpen ? "Fechar chat" : "Abrir chat de texto"}
                size="sm"
                variant={chatOpen ? "active" : "ghost"}
                onClick={() => setChatOpen((value) => !value)}
              >
                <MessageSquare className="h-4.5 w-4.5" />
              </IconButton>
            </Tooltip>
          </div>
        </header>

        <VoiceParticipantGrid
          participants={participants}
          onStopScreenShare={stopScreenShare}
        />
        <VoiceControls />
      </div>

      {chatOpen && (
        <VoiceChatPanel channel={channel} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}
