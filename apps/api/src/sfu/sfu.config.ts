import type { types as MediasoupTypes } from 'mediasoup';

/** Codecs the router accepts for screen-share producers (video + optional system audio). */
export const MEDIA_CODECS: MediasoupTypes.RouterRtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];
