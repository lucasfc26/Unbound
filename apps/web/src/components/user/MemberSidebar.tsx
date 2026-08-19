import { useEffect, useRef, useState } from "react";
import { useServerStore } from "@/stores/useServerStore";
import { Avatar } from "@/components/ui/Avatar";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { UserPopover } from "./UserPopover";
import type { Server, User } from "@/types";

export function MemberSidebar({ server }: { server: Server }) {
  const membersByServer = useServerStore((state) => state.membersByServer);
  const fetchMembers = useServerStore((state) => state.fetchMembers);

  useEffect(() => {
    fetchMembers(server.id);
  }, [server.id, fetchMembers]);

  const members: User[] = (membersByServer[server.id] ?? []).map(
    (entry) => entry.user,
  );

  const online = members.filter(
    (user) => user.status !== "OFFLINE" && user.status !== "INVISIBLE",
  );
  const offline = members.filter(
    (user) => user.status === "OFFLINE" || user.status === "INVISIBLE",
  );

  const [openUser, setOpenUser] = useState<User | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(containerRef, () => setOpenUser(null));

  return (
    <aside className="relative hidden h-full w-60 shrink-0 flex-col overflow-y-auto bg-bg-secondary px-3 py-4 lg:flex">
      <MemberGroup
        label={`Online — ${online.length}`}
        users={online}
        onSelect={setOpenUser}
      />
      <MemberGroup
        label={`Offline — ${offline.length}`}
        users={offline}
        onSelect={setOpenUser}
      />

      {openUser && (
        <div ref={containerRef} className="absolute right-full top-4 mr-2 z-40">
          <UserPopover user={openUser} />
        </div>
      )}
    </aside>
  );
}

function MemberGroup({
  label,
  users,
  onSelect,
}: {
  label: string;
  users: User[];
  onSelect: (user: User) => void;
}) {
  if (users.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="mb-1 px-1 text-caption font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </h3>
      <ul className="flex flex-col gap-0.5">
        {users.map((user) => (
          <li key={user.id}>
            <button
              onClick={() => onSelect(user)}
              className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-hover"
            >
              <Avatar
                name={user.displayName}
                color={user.avatarColor}
                status={user.status}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-small font-medium ${
                    user.status === "OFFLINE"
                      ? "text-text-muted"
                      : "text-text-primary"
                  }`}
                >
                  {user.displayName}
                </span>
                {user.customStatus && (
                  <span className="block truncate text-caption text-text-muted">
                    {user.customStatus}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
