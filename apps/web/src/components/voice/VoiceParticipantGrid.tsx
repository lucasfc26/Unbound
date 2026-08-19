import { useEffect, useRef } from "react";
import { MonitorUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useDeviceStore } from "@/stores/useDeviceStore";
import type { User } from "@/types";

function applySinkId(el: HTMLMediaElement | null, sinkId: string | null) {
  if (!el || !sinkId || typeof el.setSinkId !== "function") return;
  el.setSinkId(sinkId).catch(() => {
    // device may no longer exist / browser lacks support — audio just stays on default output
  });
}

interface Participant {
  user: User;
  speaking?: boolean;
  muted?: boolean;
  stream?: MediaStream | null;
  isLocal?: boolean;
  connectionState?: RTCPeerConnectionState;
}

export interface ScreenShareInfo {
  displayName: string;
  stream: MediaStream;
  isLocal: boolean;
}

interface VoiceParticipantGridProps {
  participants: Participant[];
  screenShare?: ScreenShareInfo | null;
  onStopScreenShare?: () => void;
}

export function VoiceParticipantGrid({
  participants,
  screenShare,
  onStopScreenShare,
}: VoiceParticipantGridProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      {screenShare && (
        <ScreenShareStage
          screenShare={screenShare}
          onStop={onStopScreenShare}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {participants.map((participant) => (
          <ParticipantTile key={participant.user.id} {...participant} />
        ))}
      </div>
    </div>
  );
}

function ScreenShareStage({
  screenShare,
  onStop,
}: {
  screenShare: ScreenShareInfo;
  onStop?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = screenShare.stream;
  }, [screenShare.stream]);

  return (
    <div className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-accent bg-black">
      <div className="flex items-center justify-between gap-3 bg-surface px-3 py-2">
        <span className="flex items-center gap-1.5 text-small text-text-secondary">
          <MonitorUp className="h-4 w-4" />
          {screenShare.displayName} está compartilhando a tela
        </span>
        {screenShare.isLocal && (
          <Button variant="danger" size="sm" onClick={onStop}>
            Parar compartilhamento
          </Button>
        )}
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={screenShare.isLocal}
        className="max-h-[45vh] w-full bg-black object-contain"
      />
    </div>
  );
}

function ParticipantTile({
  user,
  speaking,
  muted,
  stream,
  isLocal,
  connectionState,
}: Participant) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const speakerDeviceId = useDeviceStore((state) => state.speakerDeviceId);
  const hasVideo = Boolean(
    stream?.getVideoTracks().some((track) => track.enabled),
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  useEffect(() => {
    if (!isLocal) applySinkId(videoRef.current, speakerDeviceId);
  }, [isLocal, speakerDeviceId, stream]);

  const connecting =
    connectionState &&
    connectionState !== "connected" &&
    connectionState !== "closed";

  return (
    <div
      className={cn(
        "relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-surface transition-colors duration-150",
        speaking ? "border-success" : "border-border",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          !hasVideo && "hidden",
        )}
      />
      {!hasVideo && (
        <Avatar
          name={user.displayName}
          color={user.avatarColor}
          size="xl"
          speaking={speaking}
        />
      )}

      <span className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded bg-black/50 px-2 py-0.5 text-small font-medium text-text-primary">
        {muted && <span className="text-danger">●</span>}
        {user.displayName}
        {isLocal && " (você)"}
      </span>

      {connecting && (
        <span className="absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-caption text-text-muted">
          conectando...
        </span>
      )}
    </div>
  );
}
