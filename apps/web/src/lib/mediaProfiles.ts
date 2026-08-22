import type { types as MsTypes } from "mediasoup-client";
import type {
  BroadcastCodec,
  BroadcastMode,
  BroadcastResolution,
  BroadcastTransport,
  MediaProfile,
} from "@/types";

/**
 * Central place for turning "Transmissão" settings (Automático/Manual +
 * Qualidade/Gaming) into concrete WebRTC/mediasoup encoding parameters.
 * Kept framework-free so both the SFU (screen share) and the P2P mesh
 * (mic/câmera, and screen share when broadcastTransport = "p2p") can reuse
 * the same resolution/bitrate/codec logic instead of hardcoding it twice.
 */

/** The subset of UserSettings these functions need — lets callers pass either the real (possibly still-loading) settings or a fallback default without depending on the full settings shape. */
export interface BroadcastSettings {
  mediaProfile: MediaProfile;
  broadcastMode: BroadcastMode;
  broadcastResolution: BroadcastResolution;
  broadcastMaxBitrateKbps: number;
  broadcastFps: number;
  broadcastCodec: BroadcastCodec;
  broadcastTransport: BroadcastTransport;
}

export const DEFAULT_BROADCAST_SETTINGS: BroadcastSettings = {
  mediaProfile: "quality",
  broadcastMode: "auto",
  broadcastResolution: "720p",
  broadcastMaxBitrateKbps: 2000,
  broadcastFps: 30,
  broadcastCodec: "auto",
  broadcastTransport: "auto",
};

const RESOLUTION_TARGET_HEIGHT: Record<
  Exclude<BroadcastResolution, "native">,
  number
> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};

const CODEC_MIME: Record<Exclude<BroadcastCodec, "auto">, string> = {
  vp8: "video/VP8",
  vp9: "video/VP9",
  h264: "video/H264",
};

/** VP9 favors compression/quality at the cost of CPU; H264 is broadly hardware-accelerated and cheap — a good match for "gaming" where the encoder competes with the game for CPU/GPU. */
function preferredCodecKey(
  settings: BroadcastSettings,
): Exclude<BroadcastCodec, "auto"> {
  if (settings.broadcastCodec !== "auto") return settings.broadcastCodec;
  return settings.mediaProfile === "gaming" ? "h264" : "vp9";
}

/**
 * Screen-share encodings. Manual mode collapses to a single fixed layer
 * sized off the *captured* resolution (so "1080p" downscales a 4K capture
 * but doesn't upscale a 720p one). Auto mode keeps the existing 3-layer
 * simulcast, with the top layer's bitrate/framerate nudged by the media
 * profile — gaming trades a bit of resolution for higher framerate.
 */
export function resolveScreenShareEncodings(
  settings: BroadcastSettings,
  captureHeight?: number,
): RTCRtpEncodingParameters[] {
  if (settings.broadcastMode === "manual") {
    const maxBitrate = settings.broadcastMaxBitrateKbps * 1000;
    const targetHeight =
      settings.broadcastResolution === "native"
        ? undefined
        : RESOLUTION_TARGET_HEIGHT[settings.broadcastResolution];
    const scaleResolutionDownBy =
      !targetHeight || !captureHeight
        ? 1
        : Math.max(1, captureHeight / targetHeight);
    const maxFramerate = Math.max(15, Math.min(60, settings.broadcastFps));
    return [{ maxBitrate, scaleResolutionDownBy, maxFramerate }];
  }

  const gaming = settings.mediaProfile === "gaming";
  return [
    {
      rid: "r0",
      scaleResolutionDownBy: 4,
      maxBitrate: 500_000,
      maxFramerate: gaming ? 30 : 20,
    },
    {
      rid: "r1",
      scaleResolutionDownBy: 2,
      maxBitrate: 1_000_000,
      maxFramerate: 30,
    },
    {
      rid: "r2",
      scaleResolutionDownBy: 1,
      maxBitrate: gaming ? 5_000_000 : 2_000_000,
      maxFramerate: gaming ? 60 : 30,
    },
  ];
}

/** Picks a specific router codec to force via mediasoup-client's `produce({ codec })`, instead of letting it fall back to the router's default (VP8-first) order. */
export function resolveSfuVideoCodec(
  routerCodecs: MsTypes.RtpCodecCapability[] | undefined,
  settings: BroadcastSettings,
): MsTypes.RtpCodecCapability | undefined {
  if (!routerCodecs) return undefined;
  const mime = CODEC_MIME[preferredCodecKey(settings)];
  return routerCodecs.find(
    (codec) =>
      codec.kind === "video" && codec.mimeType.toLowerCase() === mime.toLowerCase(),
  );
}

/** Same codec preference, expressed as an ordered list for `RTCRtpTransceiver.setCodecPreferences()` on the plain P2P mesh (no mediasoup involved). */
export function resolveP2pVideoCodecPreferences(
  settings: BroadcastSettings,
): RTCRtpCodec[] | undefined {
  if (typeof RTCRtpSender === "undefined" || !RTCRtpSender.getCapabilities) {
    return undefined;
  }
  const capabilities = RTCRtpSender.getCapabilities("video");
  if (!capabilities) return undefined;
  const mime = CODEC_MIME[preferredCodecKey(settings)];
  const preferred = capabilities.codecs.filter(
    (codec) => codec.mimeType.toLowerCase() === mime.toLowerCase(),
  );
  if (preferred.length === 0) return undefined;
  const rest = capabilities.codecs.filter(
    (codec) => codec.mimeType.toLowerCase() !== mime.toLowerCase(),
  );
  return [...preferred, ...rest];
}

/** Webcam has no manual controls (only the Transmissão section does) — just the quality/gaming trade-off: gaming caps bitrate lower and raises the framerate ceiling since the facecam isn't the priority next to the game itself. */
export function resolveCameraSenderParams(settings: BroadcastSettings): {
  maxBitrate: number;
  maxFramerate: number;
} {
  return settings.mediaProfile === "gaming"
    ? { maxBitrate: 1_500_000, maxFramerate: 60 }
    : { maxBitrate: 2_500_000, maxFramerate: 30 };
}

/** Mic (Opus) bitrate cap — gaming trims it to leave more CPU/bandwidth headroom for the game and the screen share encode. */
export function resolveMicSenderParams(settings: BroadcastSettings): {
  maxBitrate: number;
} {
  return settings.mediaProfile === "gaming"
    ? { maxBitrate: 24_000 }
    : { maxBitrate: 64_000 };
}
