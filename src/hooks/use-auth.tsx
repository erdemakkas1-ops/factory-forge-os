import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole, PermissionKey } from "@/lib/permissions";

export type Profile = {
  id: string;
  employee_no: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  avatar_url: string | null;
  department_id: string | null;
  unit_id: string | null;
  shift: string | null;
  hired_at: string | null;
  is_active: boolean;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: Set<string>;
  hasPermission: (key: PermissionKey) => boolean;
  hasRole: (...roles: AppRole[]) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    setProfile((profileRes.data as Profile | null) ?? null);
    const userRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
    setRoles(userRoles);

    if (userRoles.length > 0) {
      const permRes = await supabase
        .from("role_permissions")
        .select("permission_key")
        .in("role", userRoles);
      setPermissions(new Set((permRes.data ?? []).map((p) => p.permission_key)));
    } else {
      setPermissions(new Set());
    }
  }, []);

  const applySession = useCallback(
    async (next: Session | null) => {
      setSession(next);
      if (next?.user) {
        await loadUserData(next.user.id);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions(new Set());
      }
      setLoading(false);
    },
    [loadUserData],
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) void applySession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "TOKEN_REFRESHED") {
        setSession(next);
        return;
      }
      void applySession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setPermissions(new Set());
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      permissions,
      hasPermission: (key) => permissions.has(key),
      hasRole: (...wanted) => wanted.some((r) => roles.includes(r)),
      refresh,
      signOut,
    }),
    [loading, session, profile, roles, permissions, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  return ctx;
}
