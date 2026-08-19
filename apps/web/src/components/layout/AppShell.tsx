import { Outlet } from "react-router-dom";
import { ServerSidebar } from "@/components/server/ServerSidebar";
import { Toaster } from "@/components/toast/Toaster";
import { useIdlePresence } from "@/hooks/useIdlePresence";

export function AppShell() {
  useIdlePresence();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      <ServerSidebar />
      <Outlet />
      <Toaster />
    </div>
  );
}
