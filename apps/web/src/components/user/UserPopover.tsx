import { useNavigate } from "react-router-dom";
import { MessageSquare, UserPlus } from "lucide-react";
import type { User } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { statusLabels } from "@/lib/status";
import { useFriendsStore } from "@/stores/useFriendsStore";

export function UserPopover({ user }: { user: User }) {
  const navigate = useNavigate();
  const isFriend = useFriendsStore((state) =>
    state.friends.some((entry) => entry.user.id === user.id),
  );

  return (
    <div className="w-64 overflow-hidden rounded-lg border border-border bg-elevated shadow-popover animate-scale-in">
      <div className="h-14" style={{ backgroundColor: user.avatarColor }} />
      <div className="px-4 pb-4">
        <Avatar
          name={user.displayName}
          color={user.avatarColor}
          imageUrl={user.avatarUrl}
          status={user.status}
          size="lg"
          className="-mt-7 ring-4 ring-elevated rounded-full"
        />

        <p className="mt-2 text-subheading text-text-primary">
          {user.displayName}
        </p>
        <p className="text-small text-text-secondary">@{user.username}</p>

        <div className="mt-3 flex items-center gap-1.5 text-small text-text-secondary">
          <StatusDot status={user.status} />
          {user.customStatus ?? statusLabels[user.status]}
        </div>

        {user.bio && (
          <p className="mt-3 text-small text-text-secondary">{user.bio}</p>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => navigate(`/app/dm/${user.id}`)}
          >
            <MessageSquare className="h-4 w-4" />
            Mensagem
          </Button>
          {!isFriend && (
            <Button size="sm" variant="secondary" className="flex-1">
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
