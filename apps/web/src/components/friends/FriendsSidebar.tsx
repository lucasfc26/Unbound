import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Users } from "lucide-react";
import {
  useFriendsStore,
  type FriendEntry,
} from "@/stores/useFriendsStore";
import { useDmStore } from "@/stores/useDmStore";
import { Avatar } from "@/components/ui/Avatar";
import { UnreadDot } from "@/components/ui/UnreadDot";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { useFriendMenuItems } from "@/hooks/useFriendMenuItems";
import { statusLabels } from "@/lib/status";
import { cn } from "@/lib/cn";

export function FriendsSidebar() {
  const friends = useFriendsStore((state) => state.friends);
  const incomingRequests = useFriendsStore((state) => state.incomingRequests);
  const fetchAll = useFriendsStore((state) => state.fetchAll);

  useEffect(() => {
    fetchAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const online = friends.filter(
    (entry) =>
      entry.user.status !== "OFFLINE" && entry.user.status !== "INVISIBLE",
  );
  const offline = friends.filter(
    (entry) =>
      entry.user.status === "OFFLINE" || entry.user.status === "INVISIBLE",
  );

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col bg-bg-secondary">
      <NavLink
        to="/app/friends"
        className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-4 text-body font-semibold text-text-primary hover:bg-hover"
      >
        <Users className="h-4.5 w-4.5 text-text-secondary" />
        Amigos
        {incomingRequests.length > 0 && (
          <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-caption font-semibold text-white">
            {incomingRequests.length}
          </span>
        )}
      </NavLink>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <FriendGroup label={`Online — ${online.length}`} entries={online} />
        <FriendGroup label={`Offline — ${offline.length}`} entries={offline} />
      </div>
    </aside>
  );
}

function FriendGroup({
  label,
  entries,
}: {
  label: string;
  entries: FriendEntry[];
}) {
  const { itemsFor } = useFriendMenuItems();
  const conversations = useDmStore((state) => state.conversations);
  if (entries.length === 0) return null;
  return (
    <div className="mb-3">
      <h3 className="mb-1 px-1 text-caption font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </h3>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => {
          const unread =
            conversations.find((item) => item.user.id === entry.user.id)
              ?.unreadCount ?? 0;
          return (
            <li key={entry.user.id}>
              <ContextMenu items={itemsFor(entry.user)}>
                <NavLink
                  to={`/app/dm/${entry.user.id}`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-hover",
                      isActive && "bg-active",
                    )
                  }
                >
                  <div className="relative shrink-0">
                    <Avatar
                      name={entry.user.displayName}
                      color={entry.user.avatarColor}
                      imageUrl={entry.user.avatarUrl}
                      status={entry.user.status}
                      size="sm"
                    />
                    {unread > 0 && <UnreadDot />}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium text-text-primary">
                      {entry.user.displayName}
                    </span>
                    <span className="block truncate text-caption text-text-muted">
                      {entry.user.customStatus ??
                        statusLabels[entry.user.status]}
                    </span>
                  </span>
                </NavLink>
              </ContextMenu>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
