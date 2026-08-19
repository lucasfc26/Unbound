import { create, type StoreApi } from "zustand";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "./useAuthStore";
import { useToastStore } from "./useToastStore";
import { useDeviceStore } from "./useDeviceStore";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAKING_THRESHOLD = 12;

export interface RemoteParticipant {
  userId: string;
  displayName: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  micMuted: boolean;
  screenStream: MediaStream | null;
  sharingScreen: boolean;
}

interface VoiceState {
  /** Who's in which voice channel across the whole app — feeds the channel sidebar roster. */
  participantsByChannel: Record<string, string[]>;
  speakingChannelId: string | null;
  speakingUserId: string | null;

  activeChannelId: string | null;
  isConnecting: boolean;
  localStream: MediaStream | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  screenStream: MediaStream | null;
  remoteParticipants: Record<string, RemoteParticipant>;

  join: (channelId: string) => Promise<void>;
  leave: () => void;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

type SetFn = StoreApi<VoiceState>["setState"];
type GetFn = StoreApi<VoiceState>["getState"];

const peers = new Map<string, RTCPeerConnection>();
const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
const stopAnalyzers = new Map<string, () => void>();
const primaryStreamIds = new Map<string, string>();
const screenSenders = new Map<string, RTCRtpSender[]>();
let joinToken = 0;

function closePeer(userId: string) {
  peers.get(userId)?.close();
  peers.delete(userId);
  pendingCandidates.delete(userId);
  stopAnalyzers.get(userId)?.();
  stopAnalyzers.delete(userId);
  primaryStreamIds.delete(userId);
  screenSenders.delete(userId);
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

async function performRealJoin(channelId: string, set: SetFn, get: GetFn) {
  const myToken = ++joinToken;
  set({ isConnecting: true });

  let stream: MediaStream;
  try {
    const { micDeviceId } = useDeviceStore.getState();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      video: false,
    });
  } catch {
    if (myToken === joinToken) set({ isConnecting: false });
    useToastStore
      .getState()
      .push("error", "Não foi possível acessar o microfone");
    return;
  }
  if (myToken !== joinToken) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }

  const me = useAuthStore.getState().user;
  set({
    activeChannelId: channelId,
    localStream: stream,
    micEnabled: true,
    cameraEnabled: false,
    screenSharing: false,
    screenStream: null,
    remoteParticipants: {},
  });
  if (me) watchSpeaking("local", me.id, channelId, stream, set, get);

  const socket = getSocket();
  const ack = await new Promise<{
    participants: { userId: string; displayName: string }[];
  }>((resolve) => socket.emit("voice:join", { channelId }, resolve));
  if (myToken !== joinToken) return;

  set((state) => {
    const myId = me?.id;
    const list = state.participantsByChannel[channelId] ?? [];
    return {
      isConnecting: false,
      participantsByChannel: {
        ...state.participantsByChannel,
        [channelId]: myId && !list.includes(myId) ? [...list, myId] : list,
      },
    };
  });

  for (const participant of ack.participants) {
    set((state) => ({
      remoteParticipants: {
        ...state.remoteParticipants,
        [participant.userId]: {
          userId: participant.userId,
          displayName: participant.displayName,
          stream: null,
          connectionState: "new",
          micMuted: false,
          screenStream: null,
          sharingScreen: false,
        },
      },
    }));
    createPeerConnection(participant.userId, channelId, stream, set, get);
  }
}

export const useVoiceStore = create<VoiceState>((set, get) => {
  const socket = getSocket();

  socket.on(
    "voice:join",
    ({
      channelId,
      userId,
      displayName,
    }: {
      channelId: string;
      userId: string;
      displayName: string;
    }) => {
      set((state) => {
        const list = state.participantsByChannel[channelId] ?? [];
        if (list.includes(userId)) return state;
        return {
          participantsByChannel: {
            ...state.participantsByChannel,
            [channelId]: [...list, userId],
          },
        };
      });

      const state = get();
      if (
        state.activeChannelId === channelId &&
        userId !== useAuthStore.getState().user?.id &&
        !state.remoteParticipants[userId]
      ) {
        set((s) => ({
          remoteParticipants: {
            ...s.remoteParticipants,
            [userId]: {
              userId,
              displayName,
              stream: null,
              connectionState: "new",
              micMuted: false,
              screenStream: null,
              sharingScreen: false,
            },
          },
        }));
      }
    },
  );

  socket.on(
    "voice:leave",
    ({ channelId, userId }: { channelId: string; userId: string }) => {
      set((state) => ({
        participantsByChannel: {
          ...state.participantsByChannel,
          [channelId]: (state.participantsByChannel[channelId] ?? []).filter(
            (id) => id !== userId,
          ),
        },
      }));

      const state = get();
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
              [fromUserId]: s.remoteParticipants[fromUserId] ?? {
                userId: fromUserId,
                displayName: "Usuário",
                stream: null,
                connectionState: "new",
                micMuted: false,
                screenStream: null,
                sharingScreen: false,
              },
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
      const state = get();
      if (state.activeChannelId !== channelId) return;
      set((s) => {
        const existing = s.remoteParticipants[userId];
        if (!existing) return s;
        return {
          remoteParticipants: {
            ...s.remoteParticipants,
            [userId]: { ...existing, micMuted: muted },
          },
        };
      });
    },
  );

  socket.on(
    "voice:screen_share",
    ({
      channelId,
      userId,
      sharing,
    }: {
      channelId: string;
      userId: string;
      sharing: boolean;
    }) => {
      const state = get();
      if (state.activeChannelId !== channelId) return;
      set((s) => {
        const existing = s.remoteParticipants[userId];
        if (!existing) return s;
        return {
          remoteParticipants: {
            ...s.remoteParticipants,
            [userId]: {
              ...existing,
              sharingScreen: sharing,
              screenStream: sharing ? existing.screenStream : null,
            },
          },
        };
      });
    },
  );

  socket.on("connect", () => {
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
    cameraEnabled: false,
    screenSharing: false,
    screenStream: null,
    remoteParticipants: {},

    join: async (channelId) => {
      const current = get().activeChannelId;
      if (current && current !== channelId) get().leave();

      await performRealJoin(channelId, set, get);
    },

    leave: () => {
      const state = get();
      if (!state.activeChannelId) return;
      const channelId = state.activeChannelId;

      joinToken++;
      socket.emit("voice:leave", { channelId });
      Array.from(peers.keys()).forEach(closePeer);
      stopAnalyzers.get("local")?.();
      stopAnalyzers.delete("local");
      state.localStream?.getTracks().forEach((track) => track.stop());
      state.screenStream?.getTracks().forEach((track) => track.stop());
      screenSenders.clear();

      const myId = useAuthStore.getState().user?.id;
      set((s) => ({
        activeChannelId: null,
        localStream: null,
        micEnabled: true,
        cameraEnabled: false,
        screenSharing: false,
        screenStream: null,
        remoteParticipants: {},
        speakingChannelId:
          s.speakingChannelId === channelId ? null : s.speakingChannelId,
        speakingUserId:
          s.speakingChannelId === channelId ? null : s.speakingUserId,
        participantsByChannel: {
          ...s.participantsByChannel,
          [channelId]: (s.participantsByChannel[channelId] ?? []).filter(
            (id) => id !== myId,
          ),
        },
      }));
    },

    toggleMic: () => {
      const state = get();
      if (!state.localStream || !state.activeChannelId) return;
      const next = !state.micEnabled;
      state.localStream.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      set({ micEnabled: next });
      socket.emit("voice:mic_state", {
        channelId: state.activeChannelId,
        muted: !next,
      });
    },

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
      if (get().activeChannelId !== channelId) {
        screenStream.getTracks().forEach((track) => track.stop());
        return;
      }

      screenStream
        .getVideoTracks()[0]
        ?.addEventListener("ended", () => get().stopScreenShare());

      peers.forEach((pc, userId) => {
        const senders = screenStream
          .getTracks()
          .map((track) => pc.addTrack(track, screenStream));
        screenSenders.set(userId, senders);
      });

      set({ screenStream, screenSharing: true });
      socket.emit("voice:screen_share", { channelId, sharing: true });
    },

    stopScreenShare: () => {
      const state = get();
      if (!state.screenStream) return;

      peers.forEach((pc, userId) => {
        const senders = screenSenders.get(userId) ?? [];
        senders.forEach((sender) => {
          try {
            pc.removeTrack(sender);
          } catch {
            // connection may already be closed
          }
        });
        screenSenders.delete(userId);
      });

      state.screenStream.getTracks().forEach((track) => track.stop());
      set({ screenStream: null, screenSharing: false });

      if (state.activeChannelId) {
        socket.emit("voice:screen_share", {
          channelId: state.activeChannelId,
          sharing: false,
        });
      }
    },
  };
});
