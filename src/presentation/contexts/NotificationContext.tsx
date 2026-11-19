import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useServices } from "./ServicesContext";

interface NotificationContextValue {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
  refreshUnreadCount: async () => {},
});

/** Provides the member's unread notification count to both the sidebar badge and NotificationsPage. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { repos } = useServices();
  const memberId = session?.kind === "member" ? session.member.id : null;
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!memberId) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await repos.member.listNotificationsPage({
        page: 1,
        per_page: 1,
      });
      setUnreadCount(res.meta.unread_count);
    } catch {
      // Non-blocking badge fetch; ignore transient failures.
    }
  }, [memberId, repos]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, setUnreadCount, refreshUnreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationUnread() {
  return useContext(NotificationContext);
}
