import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ServerSidebar } from "@/components/server/ServerSidebar";
import { ChannelSidebar } from "@/components/channel/ChannelSidebar";
import { FriendsSidebar } from "@/components/friends/FriendsSidebar";
import { UserArea } from "@/components/user/UserArea";
import { Toaster } from "@/components/toast/Toaster";
import { useIdlePresence } from "@/hooks/useIdlePresence";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useFriendsStore } from "@/stores/useFriendsStore";

export function AppShell() {
  useIdlePresence();

  const location = useLocation();
  const inServer = location.pathname.startsWith("/app/server/");
  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const fetchFriends = useFriendsStore((state) => state.fetchAll);
  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
    fetchFriends().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings?.theme ?? "dark";
    root.dataset.density = settings?.density ?? "normal";
  }, [settings?.theme, settings?.density]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      <div className="flex min-h-0 shrink-0 flex-col bg-bg-secondary">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ServerSidebar />
          {inServer ? <ChannelSidebar /> : <FriendsSidebar />}
        </div>
        <UserArea />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
      <Toaster />
    </div>
  );
}
