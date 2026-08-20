import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  checkAndInstallUpdate,
  type UpdateProgress,
} from "@/lib/desktopUpdater";
import LandingPage from "@/pages/Landing";
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

const UPDATE_MESSAGES: Record<UpdateProgress["phase"], string | null> = {
  checking: "Verificando atualizações...",
  downloading: "Baixando atualização...",
  installing: "Instalando atualização...",
  done: "Reiniciando...",
  none: null,
  error: null,
};

export default function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const [update, setUpdate] = useState<UpdateProgress>({ phase: "checking" });

  useEffect(() => {
    checkAndInstallUpdate(setUpdate);
  }, []);

  useEffect(() => {
    // Only start the normal app once we know there's nothing to install —
    // an update that's about to relaunch the app has no reason to also pay
    // for a login round trip that's seconds away from being thrown away.
    if (update.phase === "none" || update.phase === "error") bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update.phase]);

  const updateMessage = UPDATE_MESSAGES[update.phase];
  if (updateMessage) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        <p className="text-small text-text-secondary">
          {updateMessage}
          {update.phase === "downloading" && update.percent != null
            ? ` ${update.percent}%`
            : ""}
        </p>
      </div>
    );
  }

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
        <Route path="/" element={<LandingPage />} />
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
