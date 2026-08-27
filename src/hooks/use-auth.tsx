import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

  // =========================================================
  // PROFİL + ROL + YETKİLER
  // =========================================================

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),

        // Rolleri doğrudan tablo üzerinden okumak yerine yalnızca
        // oturum açmış kullanıcıyı döndüren RPC'yi kullanıyoruz. Bu,
        // user_roles RLS politikaları değişse bile kullanıcının kendi
        // rolünün boş görünmesini engeller.
        supabase.rpc("current_user_roles"),
      ]);

      // -----------------------------
      // PROFİL
      // -----------------------------

      if (profileResult.error) {
        console.error("Profil yüklenemedi:", profileResult.error);

        setProfile(null);
      } else {
        setProfile((profileResult.data as Profile | null) ?? null);
      }

      // -----------------------------
      // ROLLER
      // -----------------------------

      if (rolesResult.error) {
        console.error("Roller yüklenemedi:", rolesResult.error);

        setRoles([]);
        setPermissions(new Set());

        return;
      }

      const userRoles = (rolesResult.data ?? []).map((role) => role as AppRole).filter(Boolean);

      setRoles(userRoles);

      console.log("Kullanıcı rolleri:", userRoles);

      // Rol yoksa yetki de yok.
      if (userRoles.length === 0) {
        setPermissions(new Set());

        return;
      }

      // -----------------------------
      // YETKİLER
      // -----------------------------

      const permissionResult = await supabase
        .from("role_permissions")
        .select("permission_key")
        .in("role", userRoles);

      if (permissionResult.error) {
        console.error("Yetkiler yüklenemedi:", permissionResult.error);

        setPermissions(new Set());

        return;
      }

      const userPermissions = new Set<string>(
        (permissionResult.data ?? []).map((row) => row.permission_key).filter(Boolean),
      );

      setPermissions(userPermissions);

      console.log("Kullanıcı yetkileri:", Array.from(userPermissions));
    } catch (error) {
      console.error("Kullanıcı bilgileri yüklenirken hata:", error);

      setProfile(null);
      setRoles([]);
      setPermissions(new Set());
    }
  }, []);

  // =========================================================
  // SESSION UYGULA
  // =========================================================

  const applySession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);

      if (nextSession?.user) {
        await loadUserData(nextSession.user.id);
      } else {
        setProfile(null);

        setRoles([]);

        setPermissions(new Set());
      }

      setLoading(false);
    },
    [loadUserData],
  );

  // =========================================================
  // AUTH BAŞLAT
  // =========================================================

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (error) {
          console.error("Oturum alınamadı:", error);
        }

        await applySession(data.session);
      } catch (error) {
        console.error("Auth başlatılamadı:", error);

        if (active) {
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    // =======================================================
    // AUTH DEĞİŞİKLİKLERİNİ DİNLE
    // =======================================================

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) {
        return;
      }

      // Session state hemen güncellenebilir.
      setSession(nextSession);

      // Token yenilenmesinde profil/rol/yetkileri
      // tekrar sorgulamaya gerek yok.
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      /*
       * ÖNEMLİ:
       *
       * onAuthStateChange callback'i içinde doğrudan
       * Supabase sorgusu çalıştırmıyoruz.
       *
       * Callback bittikten sonra çalıştırıyoruz.
       */

      setTimeout(() => {
        if (!active) {
          return;
        }

        void applySession(nextSession);
      }, 0);
    });

    return () => {
      active = false;

      data.subscription.unsubscribe();
    };
  }, [applySession]);

  // =========================================================
  // MANUEL YENİLEME
  // =========================================================

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      await applySession(data.session);
    } catch (error) {
      console.error("Kullanıcı bilgileri yenilenemedi:", error);

      setLoading(false);
    }
  }, [applySession]);

  // =========================================================
  // ÇIKIŞ
  // =========================================================

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Çıkış yapılamadı:", error);
    } finally {
      setProfile(null);

      setRoles([]);

      setPermissions(new Set());

      setSession(null);
    }
  }, []);

  // =========================================================
  // CONTEXT VALUE
  // =========================================================

  const value = useMemo<AuthState>(
    () => ({
      loading,

      session,

      user: session?.user ?? null,

      profile,

      roles,

      permissions,

      hasPermission: (key) => permissions.has(key),

      hasRole: (...wantedRoles) => wantedRoles.some((role) => roles.includes(role)),

      refresh,

      signOut,
    }),
    [loading, session, profile, roles, permissions, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }

  return context;
}
