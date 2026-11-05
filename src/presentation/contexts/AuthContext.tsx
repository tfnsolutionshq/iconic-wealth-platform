import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminRole, AdminUser, Member, Session } from "@/domain/entities";
import { useServices } from "./ServicesContext";

interface AuthState {
  session: Session | null;
  token: string | null;
  user: unknown | null;
  login: (identifier: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
  updateMember: (m: Member) => void;
  switchAdminRole: (role: AdminRole) => Promise<void>; // demo of maker-checker only
}

interface AuthPayload {
  token: string;
  /** The raw user object exactly as returned by the auth repository/API. */
  user: unknown;
  /** The mapped domain session used by the app. */
  session: Session;
}

const AuthContext = createContext<AuthState | null>(null);

/** Keys used to persist the token, the raw API user and the app session. */
const TOKEN_KEY = "iwh.token";
const USER_KEY = "iwh.user";
const SESSION_KEY = "iwh.session";

/**
 * Reads a value from localStorage, returning fallback when the key is
 * missing or the stored JSON cannot be parsed.
 */
function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Recovers the session from localStorage on refresh. The session is stored
 * separately from the raw user so the user object can stay in the exact
 * snake_case shape returned by the login endpoint.
 */
function restoreSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (!readStored<string>(TOKEN_KEY, "")) return null;

  const stored = readStored<Session | null>(SESSION_KEY, null);
  if (stored?.kind === "member" || stored?.kind === "admin") return stored;

  // Legacy fallback: older builds persisted a mapped user with a `kind` field
  // and no separate session. Keep those users signed in until their next login.
  const legacy = readStored<unknown>(USER_KEY, null);
  const kind = (legacy as { kind?: string } | null)?.kind;
  if (kind === "member") return { kind: "member", member: legacy as Member };
  if (kind === "admin") return { kind: "admin", admin: legacy as AdminUser };
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { repos } = useServices();

  const [session, setSession] = useState<Session | null>(() => restoreSession());
  const [token, setToken] = useState<string | null>(() => {
    if (session?.kind === "member" || session?.kind === "admin") {
      return readStored<string>(TOKEN_KEY, "");
    }
    return null;
  });
  const [user, setUser] = useState<unknown | null>(() => {
    if (session?.kind !== "member" && session?.kind !== "admin") return null;
    // Only keep the raw user when the new format (separate session) was stored.
    // Otherwise the stored user is the old mapped duplicate and is discarded.
    return readStored<Session | null>(SESSION_KEY, null)
      ? readStored<unknown>(USER_KEY, null)
      : null;
  });

  // Keep localStorage in lockstep with state. When a session is active the
  // token, raw user and mapped session are stored; when it ends they are removed.
  useEffect(() => {
    if (session?.kind === "member" || session?.kind === "admin") {
      window.localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
      if (user === null) window.localStorage.removeItem(USER_KEY);
      else window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [session, token, user]);

  const persist = useCallback((next: AuthPayload) => {
    setToken(next.token);
    // Store the repository's user object as-is (snake_case for the live API).
    setUser(next.user);
    setSession(next.session);
  }, []);

  const login = useCallback(
    async (id: string, pw: string): Promise<Session> => {
      const result = await repos.auth.login(id, pw);
      persist(result);
      return result.session;
    },
    [repos, persist],
  );

  const logout = useCallback(async () => {
    await repos.auth.logout();
    // Remove the token, raw user and session from localStorage. The UI clears
    // immediately via the state setters above.
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
    setSession(null);
  }, [repos]);

  const updateMember = useCallback((m: Member) => {
    // Update the domain session only: the raw user object stays exactly as the
    // API returned it at login.
    setSession({ kind: "member", member: m });
  }, []);

  const switchAdminRole = useCallback(
    async (role: AdminRole) => {
      // Demo-only role switching updates the session, not the raw login user.
      const admin = await repos.admin.currentAdmin(role);
      setSession({ kind: "admin", admin });
    },
    [repos],
  );

  const value = useMemo(
    () => ({ session, token, user, login, logout, updateMember, switchAdminRole }),
    [session, token, user, login, logout, updateMember, switchAdminRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
