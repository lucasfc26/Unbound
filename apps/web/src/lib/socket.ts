import { io, type Socket } from "socket.io-client";
import { PUBLIC_ORIGIN, getAccessToken } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(PUBLIC_ORIGIN, {
      autoConnect: false,
      withCredentials: true,
      auth: (callback) => callback({ token: getAccessToken() }),
    });
  }
  return socket;
}
