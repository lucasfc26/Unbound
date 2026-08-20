import { create, type StoreApi } from "zustand";
import { Device } from "mediasoup-client";
import type { types as MsTypes } from "mediasoup-client";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "./useAuthStore";
import { useToastStore } from "./useToastStore";
import { useDeviceStore } from "./useDeviceStore";
import { useSettingsStore } from "./useSettingsStore";
import {
  isVoiceCue,
  playVoiceCue,
  unlockVoiceAudio,
  type VoiceCue,
} from "@/lib/notifySound";
import {
  audioCaptureConstraints,
  createVoicePipeline,
  getVoicePipeline,
} from "@/lib/voicePipeline";
import { loadUserVolumes, saveUserVolumes } from "@/lib/userVolumes";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAKING_THRESHOLD = 12;

/**
 * Screen share ("transmissão") goes through the SFU — mic/camera stay on the P2P mesh above.
 * Uses socket.io's ack timeout so a server-side exception (which arrives as a separate
 * 'error' event, not as the ack) actually rejects instead of hanging the caller forever.
 */
function emitAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return socket.timeout(8000).emitWithAck(event, payload) as Promise<T>;
}

export interface RemoteParticipant {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  micMuted: boolean;
  serverMuted: boolean;
  /** Only set while actively watching — populated on demand, not the moment they start sharing. */
  screenStream: MediaStream | null;
  sharingScreen: boolean;
  /** Producers available to subscribe to, independent of whether anyone's watching yet. */
  screenProducers: { producerId: string; kind: MsTypes.MediaKind }[];
}

export interface VoiceRosterEntry {
  userId: string;
  displayName: string;
  micMuted: boolean;
  serverMuted: boolean;
}

interface VoiceState {
  /** Who's in which voice channel across the whole app — feeds the channel sidebar roster. */
  participantsByChannel: Record<string, VoiceRosterEntry[]>;
  speakingChannelId: string | null;
  speakingUserId: string | null;

  activeChannelId: string | null;
  isConnecting: boolean;
  localStream: MediaStream | null;
  micEnabled: boolean;
  deafened: boolean;
  pttHeld: boolean;
  serverMuted: boolean;
  locallyMutedUserIds: Record<string, true>;
  volumesByUserId: Record<string, number>;
  cameraEnabled: boolean;
  screenSharing: boolean;
  screenStream: MediaStream | null;
  remoteParticipants: Record<string, RemoteParticipant>;
  serverPingMs: number | null;
  p2pPingMs: number | null;
  pendingVoicePath: {
    serverId: string;
    channelId: string;
    fromChannelId: string;
  } | null;

  join: (channelId: string) => Promise<void>;
  leave: () => void;
  toggleMic: () => void;
  toggleDeafen: () => void;
  setPttHeld: (held: boolean) => void;
  syncMic: () => void;
  toggleLocalMute: (userId: string) => void;
  setUserVolume: (userId: string, volume: number) => void;
  toggleServerMute: (channelId: string, userId: string, muted: boolean) => void;
  moveMember: (
    channelId: string,
    targetUserId: string,
    destinationChannelId: string,
  ) => void;
  clearPendingVoicePath: () => void;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  watchScreen: (userId: string) => void;
  stopWatchingScreen: () => void;
  notifyWatching: () => void;
  syncRoster: () => void;
}

type SetFn = StoreApi<VoiceState>["setState"];
type GetFn = StoreApi<VoiceState>["getState"];

function playLocalAndBroadcast(
  socket: Socket,
  get: GetFn,
  cue: VoiceCue,
): void {
  playVoiceCue(cue);
  const channelId = get().activeChannelId;
  if (channelId) socket.emit("voice:cue", { channelId, cue });
}

const peers = new Map<string, RTCPeerConnection>();
const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
const stopAnalyzers = new Map<string, () => void>();
const primaryStreamIds = new Map<string, string>();
let joinToken = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;

// SFU (mediasoup) state for screen share. One Device/recv transport per voice
// channel, a send transport only if this user is the one sharing.
let sfuDevice: Device | null = null;
let sfuDeviceChannelId: string | null = null;
let sfuSendTransport: MsTypes.Transport | null = null;
let sfuRecvTransport: MsTypes.Transport | null = null;
const sfuProducers = new Map<string, MsTypes.Producer>();
const sfuConsumers = new Map<string, { consumer: MsTypes.Consumer; userId: string }>();
const sfuConsumedProducerIds = new Set<string>();
let micEnabledBeforeDeafen = true;
/** Whose screen we're actively subscribed to right now — at most one at a time (RTCHIBRIDO.mp Parte 3). */
let watchingUserId: string | null = null;

function emptyParticipant(
  userId: string,
  displayName: string,
  extras?: Partial<RemoteParticipant>,
): RemoteParticipant {
  return {
    userId,
    displayName,
    stream: null,
    connectionState: "new",
    micMuted: extras?.micMuted ?? false,
    serverMuted: extras?.serverMuted ?? false,
    screenStream: null,
    sharingScreen: false,
    screenProducers: [],
    ...extras,
  };
}

/** Unsubscribes from whoever we're currently watching, freeing the SFU consumer(s) server-side too. */
function closeWatchedConsumers(set: SetFn) {
  if (!watchingUserId) return;
  const targetUserId = watchingUserId;
  watchingUserId = null;
  const socket = getSocket();

  for (const [consumerId, entry] of sfuConsumers) {
    if (entry.userId !== targetUserId) continue;
    sfuConsumedProducerIds.delete(entry.consumer.producerId);
    entry.consumer.close();
    sfuConsumers.delete(consumerId);
    socket.emit("sfu:close_consumer", { consumerId });
  }

  set((state) => {
    const existing = state.remoteParticipants[targetUserId];
    if (!existing) return state;
    return {
      remoteParticipants: {
        ...state.remoteParticipants,
        [targetUserId]: { ...existing, screenStream: null },
      },
    };
  });
}

function upsertRoster(
  byChannel: Record<string, VoiceRosterEntry[]>,
  channelId: string,
  entry: VoiceRosterEntry,
): Record<string, VoiceRosterEntry[]> {
  const list = byChannel[channelId] ?? [];
  const idx = list.findIndex((item) => item.userId === entry.userId);
  const next = [...list];
  if (idx >= 0) next[idx] = { ...next[idx], ...entry };
  else next.push(entry);
  return { ...byChannel, [channelId]: next };
}

function patchRoster(
  byChannel: Record<string, VoiceRosterEntry[]>,
  channelId: string,
  userId: string,
  patch: Partial<VoiceRosterEntry>,
): Record<string, VoiceRosterEntry[]> {
  const list = byChannel[channelId] ?? [];
  if (!list.some((item) => item.userId === userId)) return byChannel;
  return {
    ...byChannel,
    [channelId]: list.map((item) =>
      item.userId === userId ? { ...item, ...patch } : item,
    ),
  };
}

function removeFromRoster(
  byChannel: Record<string, VoiceRosterEntry[]>,
  channelId: string,
  userId: string,
): Record<string, VoiceRosterEntry[]> {
  return {
    ...byChannel,
    [channelId]: (byChannel[channelId] ?? []).filter(
      (item) => item.userId !== userId,
    ),
  };
}

function applyRoster(
  set: SetFn,
  roster: { channelId: string; participants: VoiceRosterEntry[] }[],
) {
  if (!Array.isArray(roster)) return;
  const next: Record<string, VoiceRosterEntry[]> = {};
  for (const room of roster) {
    next[room.channelId] = room.participants;
  }
  set({ participantsByChannel: next });
}

function setMicTracks(stream: MediaStream | null, enabled: boolean) {
  stream?.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
}

function applyMicState(get: GetFn) {
  const state = get();
  const settings = useSettingsStore.getState().settings;
  const pttOn = settings?.pushToTalkEnabled ?? false;
  const open =
    Boolean(state.localStream) &&
    state.micEnabled &&
    !state.deafened &&
    !state.serverMuted &&
    (!pttOn || state.pttHeld);
  getVoicePipeline()?.setOpen(open);
  setMicTracks(state.localStream, open);
}

function stopPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

async function measurePing(set: SetFn) {
  const socket = getSocket();
  const started = Date.now();
  try {
    await emitAck(socket, "voice:ping", {});
    const serverPingMs = Date.now() - started;
    const samples: number[] = [];
    for (const pc of peers.values()) {
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          report.state === "succeeded" &&
          typeof report.currentRoundTripTime === "number"
        ) {
          samples.push(report.currentRoundTripTime * 1000);
        }
      });
    }
    const p2pPingMs =
      samples.length > 0
        ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)
        : null;
    set({ serverPingMs, p2pPingMs });
  } catch {
    set({ serverPingMs: Date.now() - started });
  }
}

function startPingLoop(set: SetFn) {
  stopPingLoop();
  measurePing(set).catch(() => {});
  pingTimer = setInterval(() => {
    measurePing(set).catch(() => {});
  }, 3000);
}

function closePeer(userId: string) {
  peers.get(userId)?.close();
  peers.delete(userId);
  pendingCandidates.delete(userId);
  stopAnalyzers.get(userId)?.();
  stopAnalyzers.delete(userId);
  primaryStreamIds.delete(userId);
}

/** Drops every SFU object — the server tore down its side of these on disconnect/leave, so stale refs can't be reused. */
function resetSfuState() {
  sfuProducers.forEach((producer) => producer.close());
  sfuProducers.clear();
  sfuConsumers.forEach(({ consumer }) => consumer.close());
  sfuConsumers.clear();
  sfuConsumedProducerIds.clear();
  sfuSendTransport?.close();
  sfuSendTransport = null;
  sfuRecvTransport?.close();
  sfuRecvTransport = null;
  sfuDevice = null;
  sfuDeviceChannelId = null;
  watchingUserId = null;
}

async function ensureSfuDevice(channelId: string): Promise<Device> {
  if (sfuDevice && sfuDeviceChannelId === channelId) return sfuDevice;
  const socket = getSocket();
  const routerRtpCapabilities = await emitAck<MsTypes.RtpCapabilities>(
    socket,
    "sfu:get_rtp_capabilities",
    { channelId },
  );
  const device = new Device();
  await device.load({ routerRtpCapabilities });
  sfuDevice = device;
  sfuDeviceChannelId = channelId;
  return device;
}

async function ensureRecvTransport(
  channelId: string,
): Promise<MsTypes.Transport> {
  if (sfuRecvTransport) return sfuRecvTransport;
  const device = await ensureSfuDevice(channelId);
  const socket = getSocket();
  const params = await emitAck<MsTypes.TransportOptions>(
    socket,
    "sfu:create_transport",
    { channelId },
  );
  const transport = device.createRecvTransport(params);
  transport.on("connect", ({ dtlsParameters }, callback, errback) => {
    emitAck(socket, "sfu:connect_transport", {
      transportId: transport.id,
      dtlsParameters,
    })
      .then(() => callback())
      .catch(errback);
  });
  transport.on("connectionstatechange", (connectionState) => {
    console.warn("[voice] SFU recv transport", connectionState);
    if (connectionState === "failed" && sfuRecvTransport === transport) {
      sfuRecvTransport = null;
    }
  });
  sfuRecvTransport = transport;
  return transport;
}

async function ensureSendTransport(
  channelId: string,
): Promise<MsTypes.Transport> {
  if (sfuSendTransport) return sfuSendTransport;
  const device = await ensureSfuDevice(channelId);
  const socket = getSocket();
  const params = await emitAck<MsTypes.TransportOptions>(
    socket,
    "sfu:create_transport",
    { channelId },
  );
  const transport = device.createSendTransport(params);
  transport.on("connect", ({ dtlsParameters }, callback, errback) => {
    emitAck(socket, "sfu:connect_transport", {
      transportId: transport.id,
      dtlsParameters,
    })
      .then(() => callback())
      .catch(errback);
  });
  transport.on("connectionstatechange", (connectionState) => {
    console.warn("[voice] SFU send transport", connectionState);
  });
  transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
    emitAck<{ id: string }>(socket, "sfu:produce", {
      channelId,
      transportId: transport.id,
      kind,
      rtpParameters,
    })
      .then(callback)
      .catch(errback);
  });
  sfuSendTransport = transport;
  return transport;
}

/** Consumes a remote screen-share producer and folds its track into that participant's screenStream. */
async function consumeProducer(
  channelId: string,
  producerId: string,
  userId: string,
  set: SetFn,
  retries = 0,
) {
  if (sfuConsumedProducerIds.has(producerId)) return;

  const rostered = useVoiceStore.getState().remoteParticipants[userId];
  if (!rostered) {
    if (retries >= 25) {
      console.warn(
        "[voice] SFU consume aborted: participant not in roster",
        userId,
      );
      return;
    }
    window.setTimeout(() => {
      consumeProducer(channelId, producerId, userId, set, retries + 1).catch(
        () => {},
      );
    }, 200);
    return;
  }

  sfuConsumedProducerIds.add(producerId);

  try {
    const device = await ensureSfuDevice(channelId);
    const transport = await ensureRecvTransport(channelId);
    const socket = getSocket();
    const params = await emitAck<{
      id: string;
      producerId: string;
      producerUserId: string;
      kind: MsTypes.MediaKind;
      rtpParameters: MsTypes.RtpParameters;
    }>(socket, "sfu:consume", {
      transportId: transport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    const consumer = await transport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters,
    });
    sfuConsumers.set(consumer.id, { consumer, userId });
    await emitAck(socket, "sfu:resume_consumer", { consumerId: consumer.id });

    if (consumer.track.muted) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        consumer.track.addEventListener("unmute", done, { once: true });
        window.setTimeout(done, 2000);
      });
    }

    set((state) => {
      const existing = state.remoteParticipants[userId];
      if (!existing) return state;
      const tracks = existing.screenStream
        ? [...existing.screenStream.getTracks()]
        : [];
      if (!tracks.includes(consumer.track)) tracks.push(consumer.track);
      return {
        remoteParticipants: {
          ...state.remoteParticipants,
          [userId]: {
            ...existing,
            // New MediaStream so React rebinds <video srcObject> when the
            // video track arrives after audio (same object would stay black).
            screenStream: new MediaStream(tracks),
            sharingScreen: true,
          },
        },
      };
    });
  } catch (err) {
    console.error("[voice] SFU consume failed", err);
    sfuConsumedProducerIds.delete(producerId);
  }
}

/**
 * Fetches screen shares already live in the channel so a viewer who joins
 * mid-broadcast knows who's sharing. Doesn't subscribe to any of them —
 * that only happens when the user actually clicks "Assistir Tela" (Parte 3:
 * subscription dinâmica in RTCHIBRIDO.mp — never receive video no one's watching).
 */
async function catchUpOnScreenShares(channelId: string, set: SetFn) {
  const socket = getSocket();
  const producers = await emitAck<
    { producerId: string; userId: string; kind: MsTypes.MediaKind }[]
  >(socket, "sfu:list_producers", { channelId });
  if (producers.length === 0) return;

  set((state) => {
    let remoteParticipants = state.remoteParticipants;
    for (const producer of producers) {
      const existing = remoteParticipants[producer.userId];
      if (!existing) continue;
      remoteParticipants = {
        ...remoteParticipants,
        [producer.userId]: {
          ...existing,
          sharingScreen: true,
          screenProducers: [
            ...existing.screenProducers,
            { producerId: producer.producerId, kind: producer.kind },
          ],
        },
      };
    }
    return { remoteParticipants };
  });
}

function onSfuProducerClosed(userId: string, producerId: string, set: SetFn) {
  for (const [id, entry] of sfuConsumers) {
    if (entry.consumer.producerId === producerId) {
      entry.consumer.close();
      sfuConsumers.delete(id);
    }
  }
  sfuConsumedProducerIds.delete(producerId);

  set((state) => {
    const existing = state.remoteParticipants[userId];
    if (!existing) return state;
    const screenProducers = existing.screenProducers.filter(
      (p) => p.producerId !== producerId,
    );
    const stillSharing = screenProducers.length > 0;
    if (!stillSharing && watchingUserId === userId) watchingUserId = null;
    return {
      remoteParticipants: {
        ...state.remoteParticipants,
        [userId]: {
          ...existing,
          sharingScreen: stillSharing,
          screenProducers,
          screenStream: stillSharing ? existing.screenStream : null,
        },
      },
    };
  });
}

function watchSpeaking(
  key: string,
  userId: string,
  channelId: string,
  stream: MediaStream,
  set: SetFn,
  get: GetFn,
) {
  stopAnalyzers.get(key)?.();
  stopAnalyzers.delete(key);
  if (stream.getAudioTracks().length === 0) return;
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;

  function tick() {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
    const state = get();
    if (state.activeChannelId === channelId) {
      const speaking = avg > SPEAKING_THRESHOLD;
      if (speaking && state.speakingUserId !== userId) {
        set({ speakingChannelId: channelId, speakingUserId: userId });
      } else if (!speaking && state.speakingUserId === userId) {
        set({ speakingChannelId: null, speakingUserId: null });
      }
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  stopAnalyzers.set(key, () => {
    cancelAnimationFrame(raf);
    source.disconnect();
    ctx.close().catch(() => {});
  });
}

function createPeerConnection(
  userId: string,
  channelId: string,
  localStream: MediaStream,
  set: SetFn,
  get: GetFn,
): RTCPeerConnection {
  const socket = getSocket();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    socket.emit("voice:signal", {
      targetUserId: userId,
      channelId,
      signal: { type: "candidate", data: event.candidate.toJSON() },
    });
  };

  pc.onnegotiationneeded = async () => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice:signal", {
        targetUserId: userId,
        channelId,
        signal: { type: "offer", data: pc.localDescription },
      });
    } catch {
      // a later track change will trigger negotiationneeded again
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    const knownPrimary = primaryStreamIds.get(userId);
    const isPrimary = !knownPrimary || knownPrimary === stream.id;
    if (isPrimary) primaryStreamIds.set(userId, stream.id);

    set((state) => {
      const existing = state.remoteParticipants[userId];
      if (!existing) return state;
      return {
        remoteParticipants: {
          ...state.remoteParticipants,
          [userId]: isPrimary
            ? { ...existing, stream }
            : { ...existing, screenStream: stream },
        },
      };
    });
    if (isPrimary) watchSpeaking(userId, userId, channelId, stream, set, get);
  };

  pc.onconnectionstatechange = () => {
    set((state) => {
      const existing = state.remoteParticipants[userId];
      if (!existing) return state;
      return {
        remoteParticipants: {
          ...state.remoteParticipants,
          [userId]: { ...existing, connectionState: pc.connectionState },
        },
      };
    });
    if (pc.connectionState === "failed") pc.restartIce();
  };

  peers.set(userId, pc);
  return pc;
}

async function flushPendingCandidates(userId: string, pc: RTCPeerConnection) {
  const queue = pendingCandidates.get(userId);
  if (!queue) return;
  pendingCandidates.delete(userId);
  for (const candidate of queue) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }
}

async function performRealJoin(
  channelId: string,
  set: SetFn,
  get: GetFn,
  options?: { reuseStream?: boolean },
) {
  const myToken = ++joinToken;
  set({ isConnecting: true });
  Array.from(peers.keys()).forEach(closePeer);

  resetSfuState();
  const me = useAuthStore.getState().user;
  const previous = get();
  const wantMic = previous.micEnabled && !previous.deafened;
  const settings = useSettingsStore.getState().settings;
  const noiseMode = settings?.noiseSuppressionMode ?? "auto";
  const pttOn = settings?.pushToTalkEnabled ?? false;

  let stream: MediaStream;
  const existing = get().localStream;
  const canReuse =
    options?.reuseStream &&
    existing?.getAudioTracks().some((track) => track.readyState === "live");
  try {
    if (canReuse && existing) {
      stream = existing;
    } else {
      const { micDeviceId } = useDeviceStore.getState();
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: audioCaptureConstraints(micDeviceId, noiseMode),
        video: false,
      });
      await unlockVoiceAudio();
      if (myToken !== joinToken) {
        raw.getTracks().forEach((track) => track.stop());
        return;
      }
      const pipeline = createVoicePipeline(raw, {
        micGain: settings?.micGain ?? 100,
        noiseMode,
        noiseGate: settings?.noiseGate ?? 40,
        open: wantMic && !pttOn,
      });
      stream = pipeline.outputStream;
    }
  } catch {
    if (myToken === joinToken) set({ isConnecting: false });
    useToastStore
      .getState()
      .push("error", "Não foi possível acessar o microfone");
    return;
  }
  if (myToken !== joinToken) {
    if (!canReuse) getVoicePipeline()?.dispose();
    return;
  }

  set({
    activeChannelId: channelId,
    localStream: stream,
    micEnabled: wantMic,
    cameraEnabled: false,
    screenSharing: false,
    screenStream: null,
    remoteParticipants: {},
    serverMuted: false,
  });
  applyMicState(get);
  if (me) watchSpeaking("local", me.id, channelId, stream, set, get);

  const socket = getSocket();
  const ack = await new Promise<{
    participants: {
      userId: string;
      displayName: string;
      micMuted?: boolean;
      serverMuted?: boolean;
    }[];
    serverMuted?: boolean;
  }>((resolve) => socket.emit("voice:join", { channelId }, resolve));
  if (myToken !== joinToken) return;

  if (ack.serverMuted) {
    set({ serverMuted: true, micEnabled: false });
    applyMicState(get);
  } else if (!wantMic || pttOn) {
    socket.emit("voice:mic_state", { channelId, muted: true });
  }

  set((state) => {
    let roster = { ...state.participantsByChannel };
    for (const participant of ack.participants) {
      roster = upsertRoster(roster, channelId, {
        userId: participant.userId,
        displayName: participant.displayName,
        micMuted: participant.micMuted ?? false,
        serverMuted: participant.serverMuted ?? false,
      });
    }
    if (me) {
      roster = upsertRoster(roster, channelId, {
        userId: me.id,
        displayName: me.displayName,
        micMuted: !get().micEnabled,
        serverMuted: ack.serverMuted ?? false,
      });
    }
    return {
      isConnecting: false,
      participantsByChannel: roster,
    };
  });

  for (const participant of ack.participants) {
    set((state) => ({
      remoteParticipants: {
        ...state.remoteParticipants,
        [participant.userId]: emptyParticipant(
          participant.userId,
          participant.displayName,
          {
            micMuted: participant.micMuted ?? false,
            serverMuted: participant.serverMuted ?? false,
          },
        ),
      },
    }));
    createPeerConnection(participant.userId, channelId, stream, set, get);
  }

  catchUpOnScreenShares(channelId, set).catch(() => {});
  startPingLoop(set);
  if (!options?.reuseStream) playVoiceCue("join");
}

export const useVoiceStore = create<VoiceState>((set, get) => {
  const socket = getSocket();

  socket.on(
    "voice:join",
    ({
      channelId,
      userId,
      displayName,
      micMuted,
      serverMuted,
    }: {
      channelId: string;
      userId: string;
      displayName: string;
      micMuted?: boolean;
      serverMuted?: boolean;
    }) => {
      set((state) => ({
        participantsByChannel: upsertRoster(
          state.participantsByChannel,
          channelId,
          {
            userId,
            displayName,
            micMuted: micMuted ?? false,
            serverMuted: serverMuted ?? false,
          },
        ),
      }));

      const state = get();
      const me = useAuthStore.getState().user?.id;
      if (
        state.activeChannelId === channelId &&
        userId !== me
      ) {
        playVoiceCue("join");
      }
      if (
        state.activeChannelId === channelId &&
        userId !== me &&
        !state.remoteParticipants[userId]
      ) {
        set((s) => ({
          remoteParticipants: {
            ...s.remoteParticipants,
            [userId]: emptyParticipant(userId, displayName, {
              micMuted: micMuted ?? false,
              serverMuted: serverMuted ?? false,
            }),
          },
        }));
      }
    },
  );

  socket.on(
    "voice:leave",
    ({ channelId, userId }: { channelId: string; userId: string }) => {
      set((state) => ({
        participantsByChannel: removeFromRoster(
          state.participantsByChannel,
          channelId,
          userId,
        ),
      }));

      const state = get();
      if (
        state.activeChannelId === channelId &&
        userId !== useAuthStore.getState().user?.id
      ) {
        playVoiceCue("leave");
      }
      if (
        state.activeChannelId === channelId &&
        state.remoteParticipants[userId]
      ) {
        closePeer(userId);
        set((s) => {
          const next = { ...s.remoteParticipants };
          delete next[userId];
          const clearSpeaking = s.speakingUserId === userId;
          return {
            remoteParticipants: next,
            speakingChannelId: clearSpeaking ? null : s.speakingChannelId,
            speakingUserId: clearSpeaking ? null : s.speakingUserId,
          };
        });
      }
    },
  );

  socket.on(
    "voice:signal",
    async ({
      channelId,
      fromUserId,
      signal,
    }: {
      channelId: string;
      fromUserId: string;
      signal: { type: string; data: unknown };
    }) => {
      const state = get();
      if (state.activeChannelId !== channelId || !state.localStream) return;
      let pc = peers.get(fromUserId);

      if (signal.type === "offer") {
        if (!pc) {
          pc = createPeerConnection(
            fromUserId,
            channelId,
            state.localStream,
            set,
            get,
          );
          set((s) => ({
            remoteParticipants: {
              ...s.remoteParticipants,
              [fromUserId]: s.remoteParticipants[fromUserId] ??
                emptyParticipant(fromUserId, "Usuário"),
            },
          }));
        }
        await pc.setRemoteDescription(
          new RTCSessionDescription(signal.data as RTCSessionDescriptionInit),
        );
        await flushPendingCandidates(fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice:signal", {
          targetUserId: fromUserId,
          channelId,
          signal: { type: "answer", data: pc.localDescription },
        });
      } else if (signal.type === "answer" && pc) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(signal.data as RTCSessionDescriptionInit),
        );
        await flushPendingCandidates(fromUserId, pc);
      } else if (signal.type === "candidate") {
        if (pc?.remoteDescription) {
          await pc
            .addIceCandidate(
              new RTCIceCandidate(signal.data as RTCIceCandidateInit),
            )
            .catch(() => {});
        } else {
          const queue = pendingCandidates.get(fromUserId) ?? [];
          queue.push(signal.data as RTCIceCandidateInit);
          pendingCandidates.set(fromUserId, queue);
        }
      }
    },
  );

  socket.on(
    "voice:mic_state",
    ({
      channelId,
      userId,
      muted,
    }: {
      channelId: string;
      userId: string;
      muted: boolean;
    }) => {
      set((s) => {
        const existing = s.remoteParticipants[userId];
        return {
          participantsByChannel: patchRoster(
            s.participantsByChannel,
            channelId,
            userId,
            { micMuted: muted },
          ),
          remoteParticipants: existing
            ? {
                ...s.remoteParticipants,
                [userId]: { ...existing, micMuted: muted },
              }
            : s.remoteParticipants,
        };
      });
      const me = useAuthStore.getState().user?.id;
      const current = get();
      if (
        current.activeChannelId === channelId &&
        userId !== me &&
        !current.remoteParticipants[userId]?.serverMuted
      ) {
        playVoiceCue(muted ? "mute" : "unmute");
      }
    },
  );

  socket.on(
    "voice:server_mute",
    ({
      channelId,
      userId,
      muted,
    }: {
      channelId: string;
      userId: string;
      muted: boolean;
    }) => {
      const me = useAuthStore.getState().user;
      if (me?.id === userId) {
        if (muted) {
          set({ serverMuted: true, micEnabled: false });
          applyMicState(get);
        } else {
          set({ serverMuted: false });
          applyMicState(get);
        }
      }
      set((s) => {
        const existing = s.remoteParticipants[userId];
        return {
          participantsByChannel: patchRoster(
            s.participantsByChannel,
            channelId,
            userId,
            muted ? { serverMuted: true, micMuted: true } : { serverMuted: false },
          ),
          remoteParticipants: existing
            ? {
                ...s.remoteParticipants,
                [userId]: {
                  ...existing,
                  serverMuted: muted,
                  micMuted: muted ? true : existing.micMuted,
                },
              }
            : s.remoteParticipants,
        };
      });
      if (get().activeChannelId === channelId) {
        playVoiceCue(muted ? "mute" : "unmute");
      }
    },
  );

  socket.on(
    "voice:moved",
    ({
      fromChannelId,
      toChannelId,
      serverId,
    }: {
      fromChannelId: string;
      toChannelId: string;
      serverId: string;
    }) => {
      playVoiceCue("move");
      get().stopScreenShare();
      set({
        pendingVoicePath: {
          serverId,
          channelId: toChannelId,
          fromChannelId,
        },
      });
      Array.from(peers.keys()).forEach(closePeer);
      resetSfuState();
      performRealJoin(toChannelId, set, get, { reuseStream: true }).catch(
        () => {},
      );
    },
  );

  socket.on(
    "sfu:new_producer",
    ({
      channelId,
      producerId,
      userId,
      kind,
    }: {
      channelId: string;
      producerId: string;
      userId: string;
      kind: MsTypes.MediaKind;
    }) => {
      const state = get();
      if (
        state.activeChannelId !== channelId ||
        userId === useAuthStore.getState().user?.id
      ) {
        return;
      }
      set((s) => {
        const existing = s.remoteParticipants[userId];
        if (!existing) return s;
        return {
          remoteParticipants: {
            ...s.remoteParticipants,
            [userId]: {
              ...existing,
              sharingScreen: true,
              screenProducers: [
                ...existing.screenProducers,
                { producerId, kind },
              ],
            },
          },
        };
      });
      if (kind === "video") playVoiceCue("stream");
      // Already watching this person (e.g. their audio producer arrived
      // after video) — subscribe to the new one too instead of waiting for
      // another click.
      if (watchingUserId === userId) {
        consumeProducer(channelId, producerId, userId, set).catch(() => {});
      }
    },
  );

  socket.on(
    "voice:cue",
    ({ channelId, cue }: { channelId: string; cue: string }) => {
      if (get().activeChannelId !== channelId || !isVoiceCue(cue)) return;
      playVoiceCue(cue);
    },
  );

  socket.on(
    "sfu:producer_closed",
    ({
      channelId,
      userId,
      producerId,
    }: {
      channelId: string;
      userId: string;
      producerId: string;
    }) => {
      if (get().activeChannelId !== channelId) return;
      onSfuProducerClosed(userId, producerId, set);
    },
  );

  socket.on("connect", () => {
    socket.emit(
      "voice:sync",
      {},
      (roster: { channelId: string; participants: VoiceRosterEntry[] }[]) => {
        applyRoster(set, roster);
      },
    );

    const state = get();
    if (state.activeChannelId) {
      Array.from(peers.keys()).forEach(closePeer);
      const channelId = state.activeChannelId;
      set({ remoteParticipants: {} });
      performRealJoin(channelId, set, get).catch(() => {});
    }
  });

  return {
    activeChannelId: null,
    participantsByChannel: {},
    speakingChannelId: null,
    speakingUserId: null,
    isConnecting: false,
    localStream: null,
    micEnabled: true,
    deafened: false,
    pttHeld: false,
    serverMuted: false,
    locallyMutedUserIds: {},
    volumesByUserId: loadUserVolumes(),
    cameraEnabled: false,
    screenSharing: false,
    screenStream: null,
    remoteParticipants: {},
    serverPingMs: null,
    p2pPingMs: null,
    pendingVoicePath: null,

    join: async (channelId) => {
      void unlockVoiceAudio();
      const current = get().activeChannelId;
      if (current === channelId) return;
      if (current && current !== channelId) get().leave();

      await performRealJoin(channelId, set, get);
    },

    leave: () => {
      const state = get();
      if (!state.activeChannelId) return;
      const channelId = state.activeChannelId;
      playVoiceCue("leave");

      joinToken++;
      stopPingLoop();
      getVoicePipeline()?.dispose();
      socket.emit("voice:leave", { channelId });
      Array.from(peers.keys()).forEach(closePeer);
      stopAnalyzers.get("local")?.();
      stopAnalyzers.delete("local");
      state.localStream?.getTracks().forEach((track) => track.stop());
      state.screenStream?.getTracks().forEach((track) => track.stop());
      resetSfuState();

      const myId = useAuthStore.getState().user?.id;
      set((s) => ({
        activeChannelId: null,
        localStream: null,
        isConnecting: false,
        cameraEnabled: false,
        screenSharing: false,
        screenStream: null,
        serverMuted: false,
        locallyMutedUserIds: {},
        remoteParticipants: {},
        serverPingMs: null,
        p2pPingMs: null,
        pendingVoicePath: null,
        pttHeld: false,
        speakingChannelId:
          s.speakingChannelId === channelId ? null : s.speakingChannelId,
        speakingUserId:
          s.speakingChannelId === channelId ? null : s.speakingUserId,
        participantsByChannel: myId
          ? removeFromRoster(s.participantsByChannel, channelId, myId)
          : s.participantsByChannel,
      }));
    },

    toggleMic: () => {
      void unlockVoiceAudio();
      const state = get();
      if (state.serverMuted) {
        useToastStore
          .getState()
          .push("error", "Você foi silenciado por um administrador");
        return;
      }

      if (state.deafened) {
        set({ deafened: false, micEnabled: true });
        micEnabledBeforeDeafen = true;
        applyMicState(get);
        playVoiceCue("unmute");
        if (state.activeChannelId) {
          socket.emit("voice:mic_state", {
            channelId: state.activeChannelId,
            muted: false,
          });
        }
        return;
      }

      const next = !state.micEnabled;
      set({ micEnabled: next });
      applyMicState(get);
      playVoiceCue(next ? "unmute" : "mute");
      if (state.activeChannelId) {
        socket.emit("voice:mic_state", {
          channelId: state.activeChannelId,
          muted: !next,
        });
      }
    },

    toggleDeafen: () => {
      void unlockVoiceAudio();
      const state = get();
      if (state.deafened) {
        const restoreMic = micEnabledBeforeDeafen && !state.serverMuted;
        set({ deafened: false, micEnabled: restoreMic });
        applyMicState(get);
        playVoiceCue("unmute");
        if (restoreMic && state.activeChannelId) {
          socket.emit("voice:mic_state", {
            channelId: state.activeChannelId,
            muted: false,
          });
        }
        return;
      }

      const wasMicOn = state.micEnabled;
      micEnabledBeforeDeafen = state.micEnabled;
      if (state.micEnabled && state.activeChannelId) {
        socket.emit("voice:mic_state", {
          channelId: state.activeChannelId,
          muted: true,
        });
      }
      set({ deafened: true, micEnabled: false });
      applyMicState(get);
      playVoiceCue("deafen");
      if (!wasMicOn && state.activeChannelId) {
        socket.emit("voice:cue", {
          channelId: state.activeChannelId,
          cue: "deafen",
        });
      }
    },

    setPttHeld: (held) => {
      if (get().pttHeld === held) return;
      set({ pttHeld: held });
      applyMicState(get);
      const state = get();
      const pttOn =
        useSettingsStore.getState().settings?.pushToTalkEnabled ?? false;
      if (
        !pttOn ||
        !state.activeChannelId ||
        !state.micEnabled ||
        state.deafened ||
        state.serverMuted
      ) {
        return;
      }
      socket.emit("voice:mic_state", {
        channelId: state.activeChannelId,
        muted: !held,
      });
    },

    syncMic: () => applyMicState(get),

    toggleLocalMute: (userId) => {
      const currentlyMuted = Boolean(get().locallyMutedUserIds[userId]);
      playLocalAndBroadcast(socket, get, currentlyMuted ? "unmute" : "mute");
      set((state) => {
        const next = { ...state.locallyMutedUserIds };
        if (next[userId]) delete next[userId];
        else next[userId] = true;
        return { locallyMutedUserIds: next };
      });
    },

    setUserVolume: (userId, volume) => {
      const clamped = Math.max(0, Math.min(300, Math.round(volume)));
      set((state) => {
        const volumesByUserId = { ...state.volumesByUserId, [userId]: clamped };
        saveUserVolumes(volumesByUserId);
        return { volumesByUserId };
      });
    },

    toggleServerMute: (channelId, userId, muted) => {
      socket.emit("voice:server_mute", {
        channelId,
        targetUserId: userId,
        muted,
      });
    },

    moveMember: (channelId, targetUserId, destinationChannelId) => {
      socket.emit("voice:move", {
        channelId,
        targetUserId,
        destinationChannelId,
      });
    },

    clearPendingVoicePath: () => set({ pendingVoicePath: null }),

    toggleCamera: async () => {
      const state = get();
      if (!state.localStream || !state.activeChannelId) return;

      const existingTrack = state.localStream.getVideoTracks()[0];
      if (existingTrack) {
        const next = !state.cameraEnabled;
        existingTrack.enabled = next;
        set({ cameraEnabled: next });
        return;
      }

      try {
        const { cameraDeviceId } = useDeviceStore.getState();
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
        });
        const [videoTrack] = camStream.getVideoTracks();
        state.localStream.addTrack(videoTrack);
        peers.forEach((pc) => pc.addTrack(videoTrack, state.localStream!));
        set({ cameraEnabled: true });
      } catch {
        useToastStore
          .getState()
          .push("error", "Não foi possível acessar a câmera");
      }
    },

    startScreenShare: async () => {
      const state = get();
      if (!state.activeChannelId || state.screenSharing) return;
      const channelId = state.activeChannelId;

      let screenStream: MediaStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } catch {
        return;
      }
      await unlockVoiceAudio();
      if (get().activeChannelId !== channelId) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenStream
        .getVideoTracks()[0]
        ?.addEventListener("ended", () => get().stopScreenShare());

      // Show the local preview right away — it doesn't depend on the SFU
      // handshake below, only on the capture itself having succeeded.
      set({ screenStream, screenSharing: true });
      playVoiceCue("stream");

      try {
        const transport = await ensureSendTransport(channelId);
        // Each track is produced independently — one track failing (e.g. no
        // system audio available) shouldn't stop the other from publishing.
        let publishedAny = false;
        const tracks = [...screenStream.getTracks()].sort((a, b) => {
          if (a.kind === b.kind) return 0;
          return a.kind === "video" ? -1 : 1;
        });
        for (const track of tracks) {
          try {
            if (track.kind === "video") {
              track.contentHint = "detail";
            }
            const producer = await transport.produce({
              track,
              encodings:
                track.kind === "video"
                  ? [{ maxBitrate: 3_000_000 }]
                  : undefined,
              codecOptions:
                track.kind === "video"
                  ? { videoGoogleStartBitrate: 1000 }
                  : undefined,
            });
            sfuProducers.set(producer.id, producer);
            publishedAny = true;
          } catch (trackErr) {
            console.error(
              `[voice] falha ao publicar track de ${track.kind} do compartilhamento de tela`,
              trackErr,
            );
          }
        }
        if (!publishedAny) {
          throw new Error("nenhuma track publicada");
        }
      } catch (err) {
        console.error("[voice] falha ao publicar compartilhamento de tela", err);
        useToastStore
          .getState()
          .push(
            "error",
            "Sua tela está sendo exibida só para você — falha ao transmitir para os outros participantes",
          );
      }
    },

    stopScreenShare: () => {
      const state = get();
      if (!state.screenStream) return;

      sfuProducers.forEach((producer) => producer.close());
      sfuProducers.clear();
      if (state.activeChannelId) {
        socket.emit("sfu:stop_producing", { channelId: state.activeChannelId });
      }

      state.screenStream.getTracks().forEach((track) => track.stop());
      set({ screenStream: null, screenSharing: false });
    },

    watchScreen: (userId) => {
      const state = get();
      const channelId = state.activeChannelId;
      const participant = state.remoteParticipants[userId];
      if (!channelId || !participant?.sharingScreen) return;
      if (watchingUserId === userId) return;

      closeWatchedConsumers(set); // at most one screen watched at a time
      watchingUserId = userId;
      for (const producer of participant.screenProducers) {
        consumeProducer(channelId, producer.producerId, userId, set).catch(
          (err) => console.error("[voice] SFU watch failed", err),
        );
      }
    },

    stopWatchingScreen: () => {
      closeWatchedConsumers(set);
    },

    notifyWatching: () => {
      playLocalAndBroadcast(socket, get, "watch");
    },

    syncRoster: () => {
      socket.emit(
        "voice:sync",
        {},
        (roster: { channelId: string; participants: VoiceRosterEntry[] }[]) => {
          applyRoster(set, roster);
        },
      );
    },
  };
});
