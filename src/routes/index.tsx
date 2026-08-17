import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/states";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content:
          "Üretim, stok, sipariş ve personel süreçlerini rol bazlı yetkilerle yöneten fabrika yönetim sistemi.",
      },
      { property: "og:title", content: "Fabrika Yönetim Sistemi" },
      {
        property: "og:description",
        content: "Üretim, stok, sipariş ve personel süreçlerini tek panelden yönetin.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/panel" : "/giris" });
  },
  component: () => <LoadingState />,
});
