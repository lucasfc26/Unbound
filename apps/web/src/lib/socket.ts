import { io, type Socket } from "socket.io-client";
import { API_URL, getAccessToken } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: (callback) => callback({ token: getAccessToken() }),
    });
  }
  return socket;
}
