import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import HomePage from "@/pages/Home";
import FriendsPage from "@/pages/Friends";
import ServerPage from "@/pages/Server";
import VoicePage from "@/pages/Voice";
import SettingsPage from "@/pages/Settings";
import InvitePage from "@/pages/Invite";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useAuthStore } from "@/stores/useAuthStore";
import { VoiceSessionRoot } from "@/components/voice/VoiceSessionRoot";
import { KeybindLayer } from "@/components/settings/KeybindLayer";

export default function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isBootstrapping) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="server/:serverId" element={<ServerPage />} />
          <Route
            path="server/:serverId/channel/:channelId"
            element={<ServerPage />}
          />
          <Route
            path="server/:serverId/voice/:channelId"
            element={<VoicePage />}
          />
        </Route>

        <Route
          path="/app/settings/*"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invite/:code"
          element={
            <ProtectedRoute>
              <InvitePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <VoiceSessionRoot />
      <KeybindLayer />
    </>
  );
}
