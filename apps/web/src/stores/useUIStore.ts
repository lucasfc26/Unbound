import { create } from "zustand";

interface UIState {
  memberSidebarOpen: boolean;
  serverDrawerOpen: boolean;
  channelDrawerOpen: boolean;
  toggleMemberSidebar: () => void;
  openServerDrawer: () => void;
  closeServerDrawer: () => void;
  openChannelDrawer: () => void;
  closeChannelDrawer: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  memberSidebarOpen: true,
  serverDrawerOpen: false,
  channelDrawerOpen: false,
  toggleMemberSidebar: () =>
    set((state) => ({ memberSidebarOpen: !state.memberSidebarOpen })),
  openServerDrawer: () => set({ serverDrawerOpen: true }),
  closeServerDrawer: () => set({ serverDrawerOpen: false }),
  openChannelDrawer: () => set({ channelDrawerOpen: true }),
  closeChannelDrawer: () => set({ channelDrawerOpen: false }),
}));
