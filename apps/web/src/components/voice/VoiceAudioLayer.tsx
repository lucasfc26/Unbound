import { useEffect, useRef } from "react";
import { useVoiceStore } from "@/stores/useVoiceStore";
import { useDeviceStore } from "@/stores/useDeviceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

function applySinkId(
  ctx: AudioContext,
  sinkId: string | null,
) {
  const withSink = ctx as AudioContext & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (!withSink.setSinkId) return;
  withSink.setSinkId(sinkId ?? "").catch(() => {});
}

/** Keeps remote audio playing even when the voice page is unmounted. */
export function VoiceAudioLayer() {
  const remoteParticipants = useVoiceStore((state) => state.remoteParticipants);
  const deafened = useVoiceStore((state) => state.deafened);
  const locallyMutedUserIds = useVoiceStore(
    (state) => state.locallyMutedUserIds,
  );
  const volumesByUserId = useVoiceStore((state) => state.volumesByUserId);
  const speakerDeviceId = useDeviceStore((state) => state.speakerDeviceId);
  const outputGain = useSettingsStore(
    (state) => state.settings?.outputGain ?? 100,
  );
  // getDisplayMedia's audio capture is a system/tab loopback — it has no
  // concept of "this app's own remote voice audio", so anything we render
  // to the output device while that capture is running gets picked up and
  // re-broadcast, echoing back to the very people being captured. Muting
  // local playback while an audio-enabled screen share is live is the only
  // reliable way to keep their voices out of it; it costs the sharer hearing
  // others over speakers for that stretch (headphones/normal mic input are
  // unaffected — everyone still hears the sharer fine).
  const sharingScreenWithAudio = useVoiceStore(
    (state) =>
      state.screenSharing &&
      (state.screenStream?.getAudioTracks().length ?? 0) > 0,
  );

  return (
    <div className="sr-only" aria-hidden>
      {Object.values(remoteParticipants).map((participant) => (
        <RemoteAudio
          key={participant.userId}
          stream={participant.stream}
          muted={
            deafened ||
            Boolean(locallyMutedUserIds[participant.userId]) ||
            participant.serverMuted ||
            sharingScreenWithAudio
          }
          volume={
            ((volumesByUserId[participant.userId] ?? 100) / 100) *
            (outputGain / 100)
          }
          sinkId={speakerDeviceId}
        />
      ))}
    </div>
  );
}

function RemoteAudio({
  stream,
  muted,
  volume,
  sinkId,
}: {
  stream: MediaStream | null;
  muted: boolean;
  volume: number;
  sinkId: string | null;
}) {
  const keepAliveRef = useRef<HTMLAudioElement>(null);
  const graphRef = useRef<{
    ctx: AudioContext;
    source: MediaStreamAudioSourceNode;
    gain: GainNode;
  } | null>(null);

  useEffect(() => {
    if (keepAliveRef.current) keepAliveRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const existing = graphRef.current;
    if (existing) {
      try {
        existing.source.disconnect();
        existing.gain.disconnect();
        existing.ctx.close().catch(() => {});
      } catch {
        // already closed
      }
      graphRef.current = null;
    }
    if (!stream) return;

    const ctx = new AudioContext();
    applySinkId(ctx, sinkId);
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = muted ? 0 : Math.max(0, volume);
    source.connect(gain).connect(ctx.destination);
    graphRef.current = { ctx, source, gain };

    return () => {
      try {
        source.disconnect();
        gain.disconnect();
        ctx.close().catch(() => {});
      } catch {
        // already closed
      }
      if (graphRef.current?.ctx === ctx) graphRef.current = null;
    };
  }, [stream, sinkId]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.gain.gain.value = muted ? 0 : Math.max(0, volume);
  }, [muted, volume]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph) applySinkId(graph.ctx, sinkId);
  }, [sinkId]);

  return <audio ref={keepAliveRef} autoPlay playsInline muted />;
}
