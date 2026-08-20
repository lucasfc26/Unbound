import { useEffect, useRef, useState } from "react";
import { EyeOff, MonitorUp, Server, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useVoiceStore } from "@/stores/useVoiceStore";
import type { User } from "@/types";

interface Participant {
  user: User;
  speaking?: boolean;
  muted?: boolean;
  stream?: MediaStream | null;
  isLocal?: boolean;
  connectionState?: RTCPeerConnectionState;
  sharingScreen?: boolean;
  screenStream?: MediaStream | null;
}

interface VoiceParticipantGridProps {
  participants: Participant[];
  onStopScreenShare?: () => void;
}

function gridSizeFor(count: number): number {
  if (count <= 1) return 1;
  return Math.ceil(Math.sqrt(count));
}

export function VoiceParticipantGrid({
  participants,
  onStopScreenShare,
}: VoiceParticipantGridProps) {
  const [watchingUserId, setWatchingUserId] = useState<string | null>(null);
  const [showWatchingCards, setShowWatchingCards] = useState(true);
  const notifyWatching = useVoiceStore((state) => state.notifyWatching);
  const size = gridSizeFor(participants.length);

  const watched = participants.find(
    (participant) =>
      participant.user.id === watchingUserId &&
      participant.sharingScreen &&
      participant.screenStream,
  );

  useEffect(() => {
    if (!watchingUserId) return;
    // Not gated on screenStream here — right after clicking watch it's still
    // null for a moment while the SFU consumer spins up, and that's not the
    // same as the person having stopped sharing.
    const stillSharing = participants.some(
      (participant) =>
        participant.user.id === watchingUserId && participant.sharingScreen,
    );
    if (!stillSharing) setWatchingUserId(null);
  }, [participants, watchingUserId]);

  if (watched?.screenStream) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <ScreenShareStage
          displayName={watched.user.displayName}
          stream={watched.screenStream}
          isLocal={Boolean(watched.isLocal)}
          showCards={showWatchingCards}
          onToggleCards={() => setShowWatchingCards((value) => !value)}
          onStopShare={watched.isLocal ? onStopScreenShare : undefined}
          onStopWatching={() => {
            useVoiceStore.getState().stopWatchingScreen();
            setWatchingUserId(null);
          }}
        />
        {showWatchingCards && (
          <div className="mt-2 max-w-full shrink-0 self-start overflow-x-auto overflow-y-hidden">
            <div className="flex w-max items-center gap-2">
              {participants.map((participant) => (
                <MiniParticipantCard
                  key={participant.user.id}
                  participant={participant}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {participants.map((participant) => (
          <ParticipantTile
            key={participant.user.id}
            {...participant}
            onWatchScreen={
              participant.sharingScreen
                ? () => {
                    notifyWatching();
                    useVoiceStore.getState().watchScreen(participant.user.id);
                    setWatchingUserId(participant.user.id);
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function ScreenShareStage({
  displayName,
  stream,
  isLocal,
  showCards,
  onToggleCards,
  onStopShare,
  onStopWatching,
}: {
  displayName: string;
  stream: MediaStream;
  isLocal: boolean;
  showCards: boolean;
  onToggleCards: () => void;
  onStopShare?: () => void;
  onStopWatching: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerCount = useVoiceStore((state) => state.screenViewerCount);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = true;
    const tryPlay = () => {
      void el
        .play()
        .then(() => {
          if (!isLocal) el.muted = false;
        })
        .catch(() => {
          el.muted = true;
          void el.play().catch(() => {});
        });
    };
    tryPlay();
    el.addEventListener("loadedmetadata", tryPlay);
    return () => {
      el.removeEventListener("loadedmetadata", tryPlay);
      el.srcObject = null;
    };
  }, [stream, isLocal]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-accent bg-black">
      <div className="flex shrink-0 items-center justify-between gap-3 bg-surface px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-small text-text-secondary">
          <MonitorUp className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {displayName} está compartilhando a tela
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onToggleCards}>
            {showCards ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {showCards ? "Ocultar cards" : "Mostrar cards"}
          </Button>
          {isLocal && onStopShare && (
            <Button variant="danger" size="sm" onClick={onStopShare}>
              Parar compartilhamento
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onStopWatching}>
            <X className="h-3.5 w-3.5" />
            Sair da tela
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full bg-black object-contain"
        />
        {/* Compartilhamento de tela sempre passa pelo SFU (mediasoup) — só
            áudio/câmera usam o mesh P2P, ver RTCHIBRIDO.mp. */}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-caption font-medium text-text-primary">
          <Server className="h-3 w-3" />
          Via servidor (SFU)
          {isLocal && (
            <span className="border-l border-white/20 pl-1">
              {viewerCount === 0
                ? "ninguém assistindo"
                : `${viewerCount} ${viewerCount === 1 ? "pessoa assistindo" : "pessoas assistindo"}`}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function MiniParticipantCard({ participant }: { participant: Participant }) {
  const { user, speaking, muted, stream, isLocal, sharingScreen } = participant;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(
    stream?.getVideoTracks().some((track) => track.enabled),
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div
      className={cn(
        "relative h-[120px] w-[160px] shrink-0 overflow-hidden rounded-lg border",
        speaking ? "border-success" : "border-border",
        sharingScreen ? "bg-zinc-700" : "bg-surface",
      )}
    >
      {sharingScreen ? (
        <div className="flex h-full w-full items-center justify-center">
          <MonitorUp className="h-8 w-8 text-zinc-400" />
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              !hasVideo && "hidden",
            )}
          />
          {!hasVideo && (
            <div className="flex h-full w-full items-center justify-center">
              <Avatar
                name={user.displayName}
                color={user.avatarColor}
                imageUrl={user.avatarUrl}
                size="lg"
                speaking={speaking}
              />
            </div>
          )}
        </>
      )}
      <span className="absolute bottom-1.5 left-1.5 z-10 max-w-[calc(100%-12px)] truncate rounded bg-black/50 px-1.5 py-0.5 text-caption font-medium text-text-primary">
        {muted && <span className="mr-1 text-danger">●</span>}
        {user.displayName}
        {isLocal && " (você)"}
      </span>
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
  sharingScreen,
  onWatchScreen,
}: Participant & { onWatchScreen?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(
    stream?.getVideoTracks().some((track) => track.enabled),
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  const connecting =
    connectionState &&
    connectionState !== "connected" &&
    connectionState !== "closed";

  if (sharingScreen && onWatchScreen) {
    return (
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border bg-zinc-700 transition-colors duration-150",
          speaking ? "border-success" : "border-zinc-500",
        )}
      >
        <MonitorUp className="h-8 w-8 text-zinc-400" />
        <Button variant="primary" size="sm" onClick={onWatchScreen}>
          Assistir Tela
        </Button>
        <span className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded bg-black/50 px-2 py-0.5 text-small font-medium text-text-primary">
          {muted && <span className="text-danger">●</span>}
          {user.displayName}
          {isLocal && " (você)"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border bg-surface transition-colors duration-150",
        speaking ? "border-success" : "border-border",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          !hasVideo && "hidden",
        )}
      />
      {!hasVideo && (
        <Avatar
          name={user.displayName}
          color={user.avatarColor}
          imageUrl={user.avatarUrl}
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
