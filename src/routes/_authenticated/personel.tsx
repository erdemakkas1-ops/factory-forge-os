import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/states";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fullName } from "@/lib/permissions";

export const Route = createFileRoute(
  "/_authenticated/personel",
)({
  head: () => ({
    meta: [
      {
        title:
          "Personel | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Fabrika personel listesi ve personel yönetimi.",
      },
      {
        property: "og:title",
        content:
          "Personel | Fabrika Yönetim Sistemi",
      },
      {
        property: "og:description",
        content:
          "Personel kayıtlarını görüntüleyin ve yönetin.",
      },
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
  hired_at: string | null;
  is_active: boolean;

  departments: {
    name: string;
  } | null;

  units: {
    name: string;
  } | null;
};

type Department = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  department_id: string;
  name: string;
};

type Role = {
  role: string;
  label: string;
};

type EmployeeForm = {
  first_name: string;
  last_name: string;
  email: string;
  employee_no: string;
  phone: string;
  position: string;
  shift: string;
  department_id: string;
  unit_id: string;
  hired_at: string;
  role: string;
};

const EMPTY_FORM: EmployeeForm = {
  first_name: "",
  last_name: "",
  email: "",
  employee_no: "",
  phone: "",
  position: "",
  shift: "",
  department_id: "",
  unit_id: "",
  hired_at: "",
  role: "staff",
};

function EmployeesPage() {
  const queryClient = useQueryClient();

  const { hasPermission } = useAuth();

  const canManage =
    hasPermission("employees.manage");

  const [createOpen, setCreateOpen] =
    useState(false);

  const [form, setForm] =
    useState<EmployeeForm>(EMPTY_FORM);

  // ============================================================
  // PERSONEL LİSTESİ
  // ============================================================

  const employees = useQuery({
    queryKey: ["employees"],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("profiles")
          .select(
            `
            id,
            employee_no,
            first_name,
            last_name,
            email,
            phone,
            position,
            shift,
            hired_at,
            is_active,
            departments:department_id(name),
            units:unit_id(name)
            `,
          )
          .order("first_name");

      if (error) {
        throw error;
      }

      return data as unknown as Row[];
    },
  });

  // ============================================================
  // DEPARTMANLAR
  // ============================================================

  const departments = useQuery({
    queryKey: ["employee-departments"],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("departments")
          .select("id, name")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name");

      if (error) {
        throw error;
      }

      return data as Department[];
    },
  });

  // ============================================================
  // BİRİMLER
  // ============================================================

  const units = useQuery({
    queryKey: ["employee-units"],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("units")
          .select(
            "id, department_id, name",
          )
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name");

      if (error) {
        throw error;
      }

      return data as Unit[];
    },
  });

  // ============================================================
  // ROLLER
  // ============================================================

  const roles = useQuery({
    queryKey: ["employee-roles"],

    queryFn: async () => {
      const { data, error } =
        await supabase
          .from("roles")
          .select("role, label")
          .order("label");

      if (error) {
        throw error;
      }

      return data as Role[];
    },
  });

  const filteredUnits = useMemo(() => {
    if (!form.department_id) {
      return [];
    }

    return (
      units.data?.filter(
        (unit) =>
          unit.department_id ===
          form.department_id,
      ) ?? []
    );
  }, [
    units.data,
    form.department_id,
  ]);

  // ============================================================
  // YENİ PERSONEL
  // ============================================================

  const createEmployee = useMutation({
    mutationFn: async () => {
      const firstName =
        form.first_name.trim();

      const lastName =
        form.last_name.trim();

      const email =
        form.email
          .trim()
          .toLowerCase();

      if (!firstName) {
        throw new Error(
          "Personelin adı zorunludur.",
        );
      }

      if (!lastName) {
        throw new Error(
          "Personelin soyadı zorunludur.",
        );
      }

      if (!email) {
        throw new Error(
          "E-posta adresi zorunludur.",
        );
      }

      const { data, error } =
        await supabase.functions.invoke(
          "invite-employee",
          {
            body: {
              first_name: firstName,
              last_name: lastName,
              email,
              employee_no:
                form.employee_no.trim() ||
                null,

              phone:
                form.phone.trim() || null,

              position:
                form.position.trim() ||
                null,

              shift:
                form.shift || null,

              department_id:
                form.department_id ||
                null,

              unit_id:
                form.unit_id || null,

              hired_at:
                form.hired_at || null,

              role:
                form.role || "staff",
            },
          },
        );

      if (error) {
        throw error;
      }

      if (
        data &&
        typeof data === "object" &&
        "error" in data
      ) {
        throw new Error(
          String(data.error),
        );
      }

      return data;
    },

    onSuccess: async () => {
      toast.success(
        "Personel başarıyla oluşturuldu.",
      );

      setCreateOpen(false);
      setForm(EMPTY_FORM);

      await queryClient.invalidateQueries({
        queryKey: ["employees"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["dashboard-stats"],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Personel oluşturulamadı.",
      );
    },
  });

  // ============================================================
  // AKTİF / PASİF
  // ============================================================

  const changeEmployeeStatus =
    useMutation({
      mutationFn: async ({
        employee,
        active,
      }: {
        employee: Row;
        active: boolean;
      }) => {
        const { error } =
          await supabase
            .from("profiles")
            .update({
              is_active: active,
            })
            .eq("id", employee.id);

        if (error) {
          throw error;
        }

      },

      onSuccess: async (
        _,
        variables,
      ) => {
        toast.success(
          variables.active
            ? "Personel aktif edildi."
            : "Personel pasife alındı.",
        );

        await queryClient.invalidateQueries({
          queryKey: ["employees"],
        });

        await queryClient.invalidateQueries({
          queryKey: [
            "dashboard-stats",
          ],
        });
      },

      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Personel durumu değiştirilemedi.",
        );
      },
    });

  // ============================================================
  // AKTİF / PASİF ONAYI
  // ============================================================

  function handleStatusChange(
    employee: Row,
  ) {
    const willActivate =
      !employee.is_active;

    const message =
      willActivate
        ? `${fullName(
            employee,
          )} personelini tekrar aktif etmek istiyor musunuz?`
        : `${fullName(
            employee,
          )} personelini pasife almak istiyor musunuz?`;

    const confirmed =
      window.confirm(message);

    if (!confirmed) {
      return;
    }

    changeEmployeeStatus.mutate({
      employee,
      active: willActivate,
    });
  }

  // ============================================================
  // TABLO
  // ============================================================

  const columns: Column<Row>[] = [
    {
      id: "name",

      header: "Ad Soyad",

      cell: (row) => (
        <span className="font-medium">
          {fullName(row)}
        </span>
      ),

      value: (row) =>
        fullName(row),

      sortable: true,
    },

    {
      id: "employee_no",

      header: "Personel No",

      cell: (row) =>
        row.employee_no ?? "—",

      value: (row) =>
        row.employee_no,

      sortable: true,
    },

    {
      id: "position",

      header: "Görev",

      cell: (row) =>
        row.position ?? "—",

      value: (row) =>
        row.position,

      sortable: true,
    },

    {
      id: "department",

      header: "Departman",

      cell: (row) =>
        row.departments?.name ??
        "—",

      value: (row) =>
        row.departments?.name,

      sortable: true,
    },

    {
      id: "unit",

      header: "Birim",

      cell: (row) =>
        row.units?.name ?? "—",

      value: (row) =>
        row.units?.name,
    },

    {
      id: "shift",

      header: "Vardiya",

      cell: (row) =>
        row.shift ?? "—",

      value: (row) =>
        row.shift,
    },

    {
      id: "contact",

      header: "İletişim",

      cell: (row) => (
        <span className="text-muted-foreground">
          {row.email ??
            row.phone ??
            "—"}
        </span>
      ),

      value: (row) =>
        `${row.email ?? ""} ${
          row.phone ?? ""
        }`,
    },

    {
      id: "status",

      header: "Durum",

      cell: (row) => (
        <ActiveBadge
          active={row.is_active}
        />
      ),

      value: (row) =>
        row.is_active
          ? "aktif"
          : "pasif",
    },

    ...(canManage
      ? [
          {
            id: "actions",

            header: "İşlem",

            cell: (row: Row) => (
              <Button
                type="button"
                size="sm"
                variant={
                  row.is_active
                    ? "outline"
                    : "default"
                }
                disabled={
                  changeEmployeeStatus.isPending
                }
                onClick={() =>
                  handleStatusChange(
                    row,
                  )
                }
              >
                {row.is_active ? (
                  <>
                    <UserX className="mr-2 size-4" />
                    Pasife Al
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 size-4" />
                    Aktif Et
                  </>
                )}
              </Button>
            ),

            value: () => "",
          },
        ]
      : []),
  ];

  // ============================================================
  // SAYFA
  // ============================================================

  return (
    <>
      <PageHeader
        title="Personel"
        description="Fabrikada kayıtlı personeli görüntüleyin ve yönetin."
        actions={
          canManage ? (
            <Button
              onClick={() =>
                setCreateOpen(true)
              }
            >
              <Plus className="mr-2 size-4" />
              Yeni Personel
            </Button>
          ) : null
        }
      />

      {employees.isError ? (
        <ErrorState
          message="Personel listesi yüklenemedi."
          onRetry={() =>
            void employees.refetch()
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={
            employees.data ?? []
          }
          rowKey={(row) =>
            row.id
          }
          loading={
            employees.isLoading
          }
          searchPlaceholder="Ad, personel no, görev veya departman ara..."
          mobileTitle={(row) =>
            fullName(row)
          }
          emptyTitle="Personel kaydı yok"
          emptyDescription="Yeni Personel butonuyla fabrikanızdaki personeli sisteme ekleyebilirsiniz."
        />
      )}

      {/* ===================================================== */}
      {/* YENİ PERSONEL DIALOG */}
      {/* ===================================================== */}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (
            createEmployee.isPending
          ) {
            return;
          }

          setCreateOpen(open);

          if (!open) {
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Yeni Personel
            </DialogTitle>

            <DialogDescription>
              Personel kartı oluşturulur ve çalışanın e-posta adresine güvenli hesap daveti
              gönderilir.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {/* AD */}

            <div className="space-y-2">
              <Label htmlFor="employee-first-name">
                Ad *
              </Label>

              <Input
                id="employee-first-name"
                value={
                  form.first_name
                }
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      first_name:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Ahmet"
              />
            </div>

            {/* SOYAD */}

            <div className="space-y-2">
              <Label htmlFor="employee-last-name">
                Soyad *
              </Label>

              <Input
                id="employee-last-name"
                value={
                  form.last_name
                }
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      last_name:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Yılmaz"
              />
            </div>

            {/* EMAIL */}

            <div className="space-y-2">
              <Label htmlFor="employee-email">
                E-posta *
              </Label>

              <Input
                id="employee-email"
                type="email"
                value={form.email}
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      email:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="personel@firma.com"
              />
            </div>

            {/* PERSONEL NO */}

            <div className="space-y-2">
              <Label htmlFor="employee-number">
                Personel No
              </Label>

              <Input
                id="employee-number"
                value={
                  form.employee_no
                }
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      employee_no:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Boş bırakılırsa otomatik"
              />
            </div>

            {/* TELEFON */}

            <div className="space-y-2">
              <Label htmlFor="employee-phone">
                Telefon
              </Label>

              <Input
                id="employee-phone"
                value={
                  form.phone
                }
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      phone:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="05xx xxx xx xx"
              />
            </div>

            {/* GÖREV */}

            <div className="space-y-2">
              <Label htmlFor="employee-position">
                Görev
              </Label>

              <Input
                id="employee-position"
                value={
                  form.position
                }
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      position:
                        event.target
                          .value,
                    }),
                  )
                }
                placeholder="Bakım Teknisyeni"
              />
            </div>

            {/* İŞE GİRİŞ */}

            <div className="space-y-2">
              <Label htmlFor="employee-hired-at">
                İşe Giriş Tarihi
              </Label>

              <Input
                id="employee-hired-at"
                type="date"
                value={
                  form.hired_at
                }
                disabled={
                  createEmployee.isPending
                }
                onChange={(event) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      hired_at:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </div>

            {/* DEPARTMAN */}

            <div className="space-y-2">
              <Label>
                Departman
              </Label>

              <Select
                value={
                  form.department_id ||
                  "__none__"
                }
                disabled={
                  createEmployee.isPending
                }
                onValueChange={(
                  value,
                ) => {
                  setForm(
                    (previous) => ({
                      ...previous,

                      department_id:
                        value ===
                        "__none__"
                          ? ""
                          : value,

                      unit_id: "",
                    }),
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Departman seçin" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__none__">
                    Departman yok
                  </SelectItem>

                  {departments.data?.map(
                    (department) => (
                      <SelectItem
                        key={
                          department.id
                        }
                        value={
                          department.id
                        }
                      >
                        {
                          department.name
                        }
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* BİRİM */}

            <div className="space-y-2">
              <Label>
                Birim
              </Label>

              <Select
                value={
                  form.unit_id ||
                  "__none__"
                }
                disabled={
                  createEmployee.isPending ||
                  !form.department_id
                }
                onValueChange={(
                  value,
                ) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      unit_id:
                        value ===
                        "__none__"
                          ? ""
                          : value,
                    }),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Birim seçin" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__none__">
                    Birim yok
                  </SelectItem>

                  {filteredUnits.map(
                    (unit) => (
                      <SelectItem
                        key={
                          unit.id
                        }
                        value={
                          unit.id
                        }
                      >
                        {unit.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* VARDİYA */}

            <div className="space-y-2">
              <Label>
                Vardiya
              </Label>

              <Select
                value={
                  form.shift ||
                  "__none__"
                }
                disabled={
                  createEmployee.isPending
                }
                onValueChange={(
                  value,
                ) =>
                  setForm(
                    (previous) => ({
                      ...previous,

                      shift:
                        value ===
                        "__none__"
                          ? ""
                          : value,
                    }),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vardiya seçin" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="__none__">
                    Vardiya yok
                  </SelectItem>

                  <SelectItem value="Gündüz">
                    Gündüz
                  </SelectItem>

                  <SelectItem value="Gece">
                    Gece
                  </SelectItem>

                  <SelectItem value="1. Vardiya">
                    1. Vardiya
                  </SelectItem>

                  <SelectItem value="2. Vardiya">
                    2. Vardiya
                  </SelectItem>

                  <SelectItem value="3. Vardiya">
                    3. Vardiya
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ROL */}

            <div className="space-y-2">
              <Label>
                Sistem Rolü
              </Label>

              <Select
                value={form.role}
                disabled={
                  createEmployee.isPending
                }
                onValueChange={(
                  value,
                ) =>
                  setForm(
                    (previous) => ({
                      ...previous,
                      role: value,
                    }),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>

                <SelectContent>
                  {roles.data?.map(
                    (role) => (
                      <SelectItem
                        key={
                          role.role
                        }
                        value={
                          role.role
                        }
                      >
                        {role.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                createEmployee.isPending
              }
              onClick={() =>
                setCreateOpen(false)
              }
            >
              İptal
            </Button>

            <Button
              type="button"
              disabled={
                createEmployee.isPending
              }
              onClick={() =>
                createEmployee.mutate()
              }
            >
              {createEmployee.isPending
                ? "Davet gönderiliyor..."
                : "Daveti Gönder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
