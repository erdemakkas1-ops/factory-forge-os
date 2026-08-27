import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute(
  "/_authenticated/denetim",
)({
  head: () => ({
    meta: [
      {
        title:
          "Denetim Kayıtları | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Sistem hareketlerini ve kullanıcı işlemlerini görüntüleyin.",
      },
    ],
  }),

  component: AuditPage,
});

const db = supabase as any;

type AuditRow = {
  id: string;
  action: string;
  module: string;
  description: string | null;
  created_at: string;
};

function AuditPage() {
  const audit = useQuery<AuditRow[]>({
    queryKey: ["audit-logs-page"],

    queryFn: async () => {
      const { data, error } = await db
        .from("audit_logs")
        .select(`
          id,
          action,
          module,
          description,
          created_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return (data ?? []) as AuditRow[];
    },
  });

  const columns: Column<AuditRow>[] = [
    {
      id: "date",
      header: "Tarih",
      cell: (row) =>
        new Date(
          row.created_at,
        ).toLocaleString("tr-TR"),
      value: (row) =>
        row.created_at,
      sortable: true,
    },

    {
      id: "action",
      header: "İşlem",
      cell: (row) => (
        <Badge variant="outline">
          {row.action}
        </Badge>
      ),
      value: (row) =>
        row.action,
      sortable: true,
    },

    {
      id: "module",
      header: "Modül",
      cell: (row) =>
        row.module,
      value: (row) =>
        row.module,
      sortable: true,
    },

    {
      id: "description",
      header: "Açıklama",
      cell: (row) =>
        row.description ?? "—",
      value: (row) =>
        row.description ?? "",
    },
  ];

  if (audit.isError) {
    return (
      <>
        <PageHeader
          title="Denetim Kayıtları"
          description="Sistemde yapılan işlemleri takip edin."
        />

        <ErrorState
          onRetry={() =>
            void audit.refetch()
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Denetim Kayıtları"
        description="Sistemde yapılan önemli işlemleri ve değişiklikleri görüntüleyin."
      />

      <DataTable
        columns={columns}
        rows={audit.data ?? []}
        rowKey={(row) => row.id}
        loading={audit.isLoading}
        searchPlaceholder="İşlem, modül veya açıklama ara..."
        mobileTitle={(row) =>
          row.module
        }
        emptyTitle="Denetim kaydı bulunamadı"
        emptyDescription="Sistemde henüz kayıtlı işlem yok."
      />
    </>
  );
}