import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminRole, Member, Session } from "@/domain/entities";
import { useServices } from "./ServicesContext";

interface AuthState {
  session: Session | null;
  login: (identifier: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
  updateMember: (m: Member) => void;
  switchAdminRole: (role: AdminRole) => Promise<void>; // demo of maker-checker only
}
const AuthContext = createContext<AuthState | null>(null);
const KEY = "iwh.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { repos } = useServices();
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  });
  const persist = useCallback((s: Session | null) => {
    setSession(s);
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  }, []);
  const login = useCallback(
    async (id: string, pw: string) => {
      const s = await repos.auth.login(id, pw);
      persist(s);
      return s;
    },
    [repos, persist],
  );
  const logout = useCallback(async () => {
    await repos.auth.logout();
    persist(null);
  }, [repos, persist]);
  const updateMember = useCallback(
    (m: Member) => persist({ kind: "member", member: m }),
    [persist],
  );
  const switchAdminRole = useCallback(
    async (role: AdminRole) =>
      persist({ kind: "admin", admin: await repos.admin.currentAdmin(role) }),
    [repos, persist],
  );
  const value = useMemo(
    () => ({ session, login, logout, updateMember, switchAdminRole }),
    [session, login, logout, updateMember, switchAdminRole],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
