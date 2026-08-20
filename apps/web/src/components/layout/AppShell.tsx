import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ServerSidebar } from "@/components/server/ServerSidebar";
import { Toaster } from "@/components/toast/Toaster";
import { useIdlePresence } from "@/hooks/useIdlePresence";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useFriendsStore } from "@/stores/useFriendsStore";

export function AppShell() {
  useIdlePresence();

  const settings = useSettingsStore((state) => state.settings);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const fetchFriends = useFriendsStore((state) => state.fetchAll);
  useEffect(() => {
    if (!settings) fetchSettings().catch(() => {});
    fetchFriends().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      <ServerSidebar />
      <Outlet />
      <Toaster />
    </div>
  );
}
