import { UserMinus, UserPlus, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFriendsStore } from "@/stores/useFriendsStore";
import { useToastStore } from "@/stores/useToastStore";
import { ApiError } from "@/lib/api";
import type { ContextMenuEntry } from "@/components/ui/ContextMenu";

export function useFriendMenuItems() {
  const navigate = useNavigate();
  const friends = useFriendsStore((state) => state.friends);
  const outgoingRequests = useFriendsStore((state) => state.outgoingRequests);
  const incomingRequests = useFriendsStore((state) => state.incomingRequests);
  const sendRequest = useFriendsStore((state) => state.sendRequest);
  const removeFriend = useFriendsStore((state) => state.removeFriend);
  const pushToast = useToastStore((state) => state.push);

  function isFriend(userId: string) {
    return friends.some((entry) => entry.user.id === userId);
  }

  function hasPendingRequest(userId: string) {
    return (
      outgoingRequests.some((entry) => entry.user.id === userId) ||
      incomingRequests.some((entry) => entry.user.id === userId)
    );
  }

  async function handleAdd(username: string, displayName: string) {
    try {
      await sendRequest(username);
      pushToast("success", `Solicitação enviada para ${displayName}`);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível enviar a solicitação",
      );
    }
  }

  async function handleRemove(userId: string, displayName: string) {
    if (
      !window.confirm(`Remover ${displayName} da sua lista de amigos?`)
    ) {
      return;
    }
    try {
      await removeFriend(userId);
      pushToast("success", `${displayName} removido dos seus amigos`);
    } catch (error) {
      pushToast(
        "error",
        error instanceof ApiError
          ? error.message
          : "Não foi possível remover o amigo",
      );
    }
  }

  function itemsFor(user: {
    id: string;
    username?: string;
    displayName: string;
  }): ContextMenuEntry[] {
    if (isFriend(user.id)) {
      return [
        {
          label: "Enviar mensagem",
          icon: MessageSquare,
          onSelect: () => {
            navigate(`/app/dm/${user.id}`);
          },
        },
        {
          label: "Remover amigo",
          icon: UserMinus,
          variant: "danger",
          onSelect: () => {
            void handleRemove(user.id, user.displayName);
          },
        },
      ];
    }

    if (hasPendingRequest(user.id) || !user.username) {
      return [];
    }

    return [
      {
        label: "Adicionar amigo",
        icon: UserPlus,
        onSelect: () => {
          void handleAdd(user.username!, user.displayName);
        },
      },
    ];
  }

  return { itemsFor };
}
