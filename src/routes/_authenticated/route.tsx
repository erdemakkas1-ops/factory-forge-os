import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/giris", search: { redirect: location.href } });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profileError && profile?.is_active === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/giris", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AppShell,
});
