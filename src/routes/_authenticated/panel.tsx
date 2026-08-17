import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Boxes, ScrollText, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, fullName } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Fabrika genel durumu: personel, departman, birim ve son sistem hareketleri.",
      },
      { property: "og:title", content: "Panel | Fabrika Yönetim Sistemi" },
      { property: "og:description", content: "Fabrika genel durum özeti ve son hareketler." },
    ],
  }),
  component: PanelPage,
});

function PanelPage() {
  const { profile, roles, hasPermission } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [employees, departments, units, activeEmployees] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("departments").select("*", { count: "exact", head: true }),
        supabase.from("units").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
      ]);
      return {
        employees: employees.count ?? 0,
        departments: departments.count ?? 0,
        units: units.count ?? 0,
        activeEmployees: activeEmployees.count ?? 0,
      };
    },
  });

  const audit = useQuery({
    queryKey: ["dashboard-audit"],
    enabled: hasPermission("audit.view"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, module, description, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const cards = [
    {
      label: "Toplam Personel",
      value: stats.data?.employees,
      icon: Users,
      to: "/personel" as const,
    },
    {
      label: "Aktif Personel",
      value: stats.data?.activeEmployees,
      icon: ShieldCheck,
      to: "/personel" as const,
    },
    {
      label: "Departman",
      value: stats.data?.departments,
      icon: Building2,
      to: "/organizasyon" as const,
    },
    { label: "Birim", value: stats.data?.units, icon: Boxes, to: "/organizasyon" as const },
  ];

  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${fullName(profile) || "kullanıcı"}`}
        description="Fabrikanızın güncel organizasyon ve sistem durumu."
        actions={
          <div className="flex flex-wrap gap-2">
            {roles.length ? (
              roles.map((r) => (
                <Badge key={r} variant="secondary">
                  {ROLE_LABELS[r]}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Rol atanmadı</Badge>
            )}
          </div>
        }
      />

      {stats.isError ? (
        <ErrorState message="Özet veriler yüklenemedi." onRetry={() => void stats.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} to={card.to} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <card.icon className="size-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-semibold tabular-nums">
                    {stats.isLoading ? "—" : (card.value ?? 0)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasPermission("audit.view") ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ScrollText className="size-4 text-primary" />
            <CardTitle className="text-base">Son sistem hareketleri</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.isLoading ? (
              <LoadingState />
            ) : audit.isError ? (
              <ErrorState onRetry={() => void audit.refetch()} />
            ) : !audit.data?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Henüz kayıtlı hareket yok.
              </p>
            ) : (
              <ul className="divide-y">
                {audit.data.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <Badge variant="outline" className="uppercase">
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground">{log.module}</span>
                    <span className="min-w-0 flex-1 truncate">{log.description ?? "—"}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
