import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/states";
import { supabase } from "@/integrations/supabase/client";
import { fullName } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/personel")({
  head: () => ({
    meta: [
      { title: "Personel | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Fabrika personel listesi: departman, birim, vardiya ve iletişim bilgileri.",
      },
      { property: "og:title", content: "Personel | Fabrika Yönetim Sistemi" },
      { property: "og:description", content: "Personel kayıtlarını görüntüleyin ve arayın." },
    ],
  }),
  component: EmployeesPage,
});

type Row = {
  id: string;
  employee_no: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  shift: string | null;
  is_active: boolean;
  departments: { name: string } | null;
  units: { name: string } | null;
};

function EmployeesPage() {
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, employee_no, first_name, last_name, email, phone, position, shift, is_active, departments:department_id(name), units:unit_id(name)",
        )
        .order("first_name");
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const columns: Column<Row>[] = [
    {
      id: "name",
      header: "Ad Soyad",
      cell: (r) => <span className="font-medium">{fullName(r)}</span>,
      value: (r) => fullName(r),
      sortable: true,
    },
    {
      id: "employee_no",
      header: "Personel No",
      cell: (r) => r.employee_no ?? "—",
      value: (r) => r.employee_no,
      sortable: true,
    },
    {
      id: "position",
      header: "Görev",
      cell: (r) => r.position ?? "—",
      value: (r) => r.position,
      sortable: true,
    },
    {
      id: "department",
      header: "Departman",
      cell: (r) => r.departments?.name ?? "—",
      value: (r) => r.departments?.name,
      sortable: true,
    },
    {
      id: "unit",
      header: "Birim",
      cell: (r) => r.units?.name ?? "—",
      value: (r) => r.units?.name,
    },
    {
      id: "contact",
      header: "İletişim",
      cell: (r) => (
        <span className="text-muted-foreground">{r.email ?? r.phone ?? "—"}</span>
      ),
      value: (r) => `${r.email ?? ""} ${r.phone ?? ""}`,
    },
    {
      id: "status",
      header: "Durum",
      cell: (r) => <ActiveBadge active={r.is_active} />,
      value: (r) => (r.is_active ? "aktif" : "pasif"),
    },
  ];

  return (
    <>
      <PageHeader
        title="Personel"
        description="Fabrikada kayıtlı tüm personeli görüntüleyin ve arayın."
      />
      {employees.isError ? (
        <ErrorState onRetry={() => void employees.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={employees.data ?? []}
          rowKey={(r) => r.id}
          loading={employees.isLoading}
          searchPlaceholder="Ad, personel no veya departman ara..."
          mobileTitle={(r) => fullName(r)}
          emptyTitle="Personel kaydı yok"
          emptyDescription="Kullanıcılar sisteme kaydolduğunda personel kartları otomatik oluşur."
        />
      )}
    </>
  );
}
