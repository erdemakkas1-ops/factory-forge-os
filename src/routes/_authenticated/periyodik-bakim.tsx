import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarClock,
  Pencil,
  Plus,
  Power,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute(
  "/_authenticated/periyodik-bakim",
)({
  head: () => ({
    meta: [
      {
        title:
          "Periyodik Bakım | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Makine ve ekipmanların periyodik bakım planlarını yönetin.",
      },
    ],
  }),

  component: PeriodicMaintenancePage,
});

type MaintenancePriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

type MachineOption = {
  id: string;
  code: string;
  name: string;
};

type UserOption = {
  id: string;
  label: string;
};

type MaintenancePlanRow = {
  id: string;
  machine_id: string;
  name: string;
  description: string | null;
  interval_days: number;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  assigned_to: string | null;
  priority: MaintenancePriority;
  is_active: boolean;
  created_at: string;
};

type MaintenancePlanFormValues = {
  id?: string;
  machine_id: string;
  name: string;
  description: string | null;
  interval_days: number;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  assigned_to: string | null;
  priority: MaintenancePriority;
  is_active: boolean;
};

const db = supabase as any;

function priorityLabel(
  priority: MaintenancePriority,
) {
  switch (priority) {
    case "low":
      return "Düşük";

    case "normal":
      return "Normal";

    case "high":
      return "Yüksek";

    case "critical":
      return "Kritik";

    default:
      return priority;
  }
}

function priorityVariant(
  priority: MaintenancePriority,
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline" {
  switch (priority) {
    case "critical":
      return "destructive";

    case "high":
      return "secondary";

    case "normal":
      return "default";

    default:
      return "outline";
  }
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Date(
    `${value}T00:00:00`,
  ).toLocaleDateString("tr-TR");
}

function maintenanceDateStatus(
  nextDate: string,
  active: boolean,
) {
  if (!active) {
    return {
      label: "Pasif",
      variant: "outline" as const,
    };
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  const target = new Date(
    `${nextDate}T00:00:00`,
  );

  target.setHours(
    0,
    0,
    0,
    0,
  );

  const difference =
    Math.ceil(
      (
        target.getTime() -
        today.getTime()
      ) /
        (
          1000 *
          60 *
          60 *
          24
        ),
    );

  if (difference < 0) {
    return {
      label: "Gecikmiş",
      variant: "destructive" as const,
    };
  }

  if (difference === 0) {
    return {
      label: "Bugün",
      variant: "secondary" as const,
    };
  }

  if (difference <= 7) {
    return {
      label: "Yaklaşıyor",
      variant: "secondary" as const,
    };
  }

  return {
    label: "Planlı",
    variant: "outline" as const,
  };
}

function PeriodicMaintenancePage() {
  const queryClient =
    useQueryClient();

  const [
    dialogOpen,
    setDialogOpen,
  ] = useState(false);

  const [
    editingPlan,
    setEditingPlan,
  ] =
    useState<MaintenancePlanRow | null>(
      null,
    );

  /*
   * =====================================================
   * MAKİNELER
   * =====================================================
   */

  const machines =
    useQuery<MachineOption[]>({
      queryKey: [
        "periodic-maintenance-machines",
      ],

      queryFn: async () => {
        const { data, error } =
          await db
            .from("machines")
            .select(`
              id,
              code,
              name
            `)
            .is(
              "deleted_at",
              null,
            )
            .eq(
              "is_active",
              true,
            )
            .order("name");

        if (error) {
          throw error;
        }

        return (
          data ?? []
        ) as MachineOption[];
      },
    });

  /*
   * =====================================================
   * PERSONEL
   * =====================================================
   */

  const users =
    useQuery<UserOption[]>({
      queryKey: [
        "periodic-maintenance-users",
      ],

      queryFn: async () => {
        const { data, error } =
          await db
            .from("profiles")
            .select(`
              id,
              full_name,
              email
            `)
            .order("full_name");

        if (error) {
          return [];
        }

        return (
          data ?? []
        ).map(
          (
            item: any,
          ): UserOption => ({
            id:
              item.id,

            label:
              item.full_name?.trim() ||
              item.email?.trim() ||
              item.id,
          }),
        );
      },
    });

  /*
   * =====================================================
   * BAKIM PLANLARI
   * =====================================================
   */

  const plans =
    useQuery<
      MaintenancePlanRow[]
    >({
      queryKey: [
        "maintenance-plans",
      ],

      queryFn: async () => {
        const { data, error } =
          await db
            .from(
              "maintenance_plans",
            )
            .select(`
              id,
              machine_id,
              name,
              description,
              interval_days,
              last_maintenance_date,
              next_maintenance_date,
              assigned_to,
              priority,
              is_active,
              created_at
            `)
            .is(
              "deleted_at",
              null,
            )
            .order(
              "next_maintenance_date",
            );

        if (error) {
          throw error;
        }

        return (
          data ?? []
        ).map(
          (
            item: any,
          ): MaintenancePlanRow => ({
            id:
              item.id,

            machine_id:
              item.machine_id,

            name:
              item.name,

            description:
              item.description ??
              null,

            interval_days:
              Number(
                item.interval_days ??
                  0,
              ),

            last_maintenance_date:
              item.last_maintenance_date ??
              null,

            next_maintenance_date:
              item.next_maintenance_date,

            assigned_to:
              item.assigned_to ??
              null,

            priority:
              item.priority as MaintenancePriority,

            is_active:
              Boolean(
                item.is_active,
              ),

            created_at:
              item.created_at,
          }),
        );
      },
    });

  /*
   * =====================================================
   * PLAN KAYDET / GÜNCELLE
   * =====================================================
   */

  const savePlan =
    useMutation({
      mutationFn: async (
        values:
          MaintenancePlanFormValues,
      ) => {
        const payload = {
          machine_id:
            values.machine_id,

          name:
            values.name.trim(),

          description:
            values.description
              ?.trim() ||
            null,

          interval_days:
            values.interval_days,

          last_maintenance_date:
            values.last_maintenance_date,

          next_maintenance_date:
            values.next_maintenance_date,

          assigned_to:
            values.assigned_to,

          priority:
            values.priority,

          is_active:
            values.is_active,
        };

        if (values.id) {
          const { error } =
            await db
              .from(
                "maintenance_plans",
              )
              .update(
                payload,
              )
              .eq(
                "id",
                values.id,
              );

          if (error) {
            throw error;
          }

          return;
        }

        const {
          data: userData,
        } =
          await supabase.auth.getUser();

        const { error } =
          await db
            .from(
              "maintenance_plans",
            )
            .insert({
              ...payload,

              created_by:
                userData.user?.id ??
                null,
            });

        if (error) {
          throw error;
        }
      },

      onSuccess: () => {
        toast.success(
          editingPlan
            ? "Bakım planı güncellendi."
            : "Bakım planı oluşturuldu.",
        );

        setDialogOpen(
          false,
        );

        setEditingPlan(
          null,
        );

        void queryClient.invalidateQueries({
          queryKey: [
            "maintenance-plans",
          ],
        });
      },

      onError: (error) => {
        toast.error(
          friendlyError(
            error,
          ),
        );
      },
    });

  /*
   * =====================================================
   * AKTİF / PASİF
   * =====================================================
   */

  const togglePlan =
    useMutation({
      mutationFn: async (
        plan:
          MaintenancePlanRow,
      ) => {
        const { error } =
          await db
            .from(
              "maintenance_plans",
            )
            .update({
              is_active:
                !plan.is_active,
            })
            .eq(
              "id",
              plan.id,
            );

        if (error) {
          throw error;
        }
      },

      onSuccess: () => {
        toast.success(
          "Bakım planı durumu güncellendi.",
        );

        void queryClient.invalidateQueries({
          queryKey: [
            "maintenance-plans",
          ],
        });
      },

      onError: (error) => {
        toast.error(
          friendlyError(
            error,
          ),
        );
      },
    });

  /*
   * =====================================================
   * BAKIM İŞ EMRİ OLUŞTUR
   * =====================================================
   */

  const createWorkOrder =
    useMutation({
      mutationFn: async (
        plan:
          MaintenancePlanRow,
      ) => {
        /*
         * =====================================================
         * AYNI PLAN İÇİN AÇIK İŞ EMRİ KONTROLÜ
         * =====================================================
         */

        const {
          data: existingOrders,
          error: checkError,
        } =
          await db
            .from(
              "maintenance_orders",
            )
            .select(`
              id,
              order_no,
              status
            `)
            .eq(
              "machine_id",
              plan.machine_id,
            )
            .eq(
              "maintenance_type",
              "periodic",
            )
            .eq(
              "title",
              plan.name,
            )
            .eq(
              "planned_date",
              plan.next_maintenance_date,
            )
            .in(
              "status",
              [
                "planned",
                "in_progress",
              ],
            )
            .limit(1);

        if (checkError) {
          throw checkError;
        }

        if (
          existingOrders &&
          existingOrders.length >
            0
        ) {
          throw new Error(
            `Bu bakım planı için zaten açık bir iş emri var: ${existingOrders[0].order_no}`,
          );
        }

        const now =
          new Date();

        const orderNo =
          `BKM-${now.getFullYear()}-${String(
            now.getTime(),
          ).slice(-6)}`;

        const {
          data: userData,
        } =
          await supabase.auth.getUser();

        const {
          error,
        } =
          await db
            .from(
              "maintenance_orders",
            )
            .insert({
              order_no:
                orderNo,

              machine_id:
                plan.machine_id,

              fault_id:
                null,

              maintenance_type:
                "periodic",

              title:
                plan.name,

              description:
                plan.description,

              priority:
                plan.priority,

              status:
                "planned",

              assigned_to:
                plan.assigned_to,

              planned_date:
                plan.next_maintenance_date,

              created_by:
                userData.user?.id ??
                null,
            });

        if (error) {
          throw error;
        }

        return orderNo;
      },

      onSuccess: (
        orderNo,
      ) => {
        toast.success(
          `${orderNo} bakım iş emri oluşturuldu.`,
        );

        void queryClient.invalidateQueries({
          queryKey: [
            "maintenance-orders",
          ],
        });
      },

      onError: (
        error,
      ) => {
        if (
          error instanceof
          Error
        ) {
          toast.error(
            error.message,
          );

          return;
        }

        toast.error(
          friendlyError(
            error,
          ),
        );
      },
    });

  /*
   * =====================================================
   * MAPLER
   * =====================================================
   */

  const machineMap =
    useMemo(
      () =>
        new Map(
          (
            machines.data ??
            []
          ).map(
            (
              machine,
            ) => [
              machine.id,
              machine,
            ],
          ),
        ),
      [
        machines.data,
      ],
    );

  const userMap =
    useMemo(
      () =>
        new Map(
          (
            users.data ??
            []
          ).map(
            (
              user,
            ) => [
              user.id,
              user.label,
            ],
          ),
        ),
      [
        users.data,
      ],
    );

  /*
   * =====================================================
   * TABLO
   * =====================================================
   */

  const columns:
    Column<MaintenancePlanRow>[] =
    [
      {
        id: "machine",
        header:
          "Makine",

        cell: (
          row,
        ) => {
          const machine =
            machineMap.get(
              row.machine_id,
            );

          return machine
            ? `${machine.code} - ${machine.name}`
            : "—";
        },

        value: (
          row,
        ) => {
          const machine =
            machineMap.get(
              row.machine_id,
            );

          return machine
            ? `${machine.code} ${machine.name}`
            : "";
        },

        sortable:
          true,
      },

      {
        id: "name",
        header:
          "Bakım",

        cell: (
          row,
        ) => (
          <div>
            <div className="font-medium">
              {row.name}
            </div>

            <div className="text-xs text-muted-foreground">
              Her{" "}
              {
                row.interval_days
              }{" "}
              günde bir
            </div>
          </div>
        ),

        value: (
          row,
        ) =>
          row.name,

        sortable:
          true,
      },

      {
        id: "last",
        header:
          "Son Bakım",

        cell: (
          row,
        ) =>
          formatDate(
            row.last_maintenance_date,
          ),

        value: (
          row,
        ) =>
          row.last_maintenance_date ??
          "",

        sortable:
          true,
      },

      {
        id: "next",
        header:
          "Sonraki Bakım",

        cell: (
          row,
        ) =>
          formatDate(
            row.next_maintenance_date,
          ),

        value: (
          row,
        ) =>
          row.next_maintenance_date,

        sortable:
          true,
      },

      {
        id: "assigned",
        header:
          "Sorumlu",

        cell: (
          row,
        ) =>
          row.assigned_to
            ? userMap.get(
                row.assigned_to,
              ) ??
              "Atanmış kullanıcı"
            : "—",

        value: (
          row,
        ) =>
          row.assigned_to
            ? userMap.get(
                row.assigned_to,
              ) ??
              row.assigned_to
            : "",
      },

      {
        id: "priority",
        header:
          "Öncelik",

        cell: (
          row,
        ) => (
          <Badge
            variant={priorityVariant(
              row.priority,
            )}
          >
            {priorityLabel(
              row.priority,
            )}
          </Badge>
        ),

        value: (
          row,
        ) =>
          priorityLabel(
            row.priority,
          ),

        sortable:
          true,
      },

      {
        id: "status",
        header:
          "Durum",

        cell: (
          row,
        ) => {
          const status =
            maintenanceDateStatus(
              row.next_maintenance_date,
              row.is_active,
            );

          return (
            <Badge
              variant={
                status.variant
              }
            >
              {status.label}
            </Badge>
          );
        },

        value: (
          row,
        ) =>
          maintenanceDateStatus(
            row.next_maintenance_date,
            row.is_active,
          ).label,

        sortable:
          true,
      },

      {
        id: "actions",
        header:
          "",

        cell: (
          row,
        ) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="İş Emri Oluştur"
              disabled={
                !row.is_active ||
                createWorkOrder.isPending
              }
              onClick={() => {
                createWorkOrder.mutate(
                  row,
                );
              }}
            >
              <Wrench className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Düzenle"
              onClick={() => {
                setEditingPlan(
                  row,
                );

                setDialogOpen(
                  true,
                );
              }}
            >
              <Pencil className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={
                row.is_active
                  ? "Pasife Al"
                  : "Aktif Et"
              }
              disabled={
                togglePlan.isPending
              }
              onClick={() => {
                togglePlan.mutate(
                  row,
                );
              }}
            >
              <Power className="size-4" />
            </Button>
          </div>
        ),

        className:
          "text-right",
      },
    ];

  /*
   * =====================================================
   * HATA
   * =====================================================
   */

  if (
    plans.isError ||
    machines.isError
  ) {
    return (
      <>
        <PageHeader
          title="Periyodik Bakım Planları"
          description="Makine bakım planlarını yönetin."
        />

        <ErrorState
          onRetry={() => {
            void plans.refetch();
            void machines.refetch();
            void users.refetch();
          }}
        />
      </>
    );
  }

  /*
   * =====================================================
   * SAYFA
   * =====================================================
   */

  return (
    <>
      <PageHeader
        title="Periyodik Bakım Planları"
        description="Makinelerin bakım tarihlerini takip edin ve zamanı gelen planlardan iş emri oluşturun."
      />

      <DataTable
        columns={
          columns
        }
        rows={
          plans.data ??
          []
        }
        rowKey={(
          row,
        ) =>
          row.id
        }
        loading={
          plans.isLoading ||
          machines.isLoading
        }
        searchPlaceholder="Makine, bakım, sorumlu veya durum ara..."
        mobileTitle={(
          row,
        ) =>
          row.name
        }
        emptyTitle="Henüz periyodik bakım planı yok"
        emptyDescription="İlk bakım planınızı oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingPlan(
                null,
              );

              setDialogOpen(
                true,
              );
            }}
          >
            <Plus className="mr-2 size-4" />

            Yeni Bakım Planı
          </Button>
        }
      />

      <Dialog
        open={
          dialogOpen
        }
        onOpenChange={(
          open,
        ) => {
          setDialogOpen(
            open,
          );

          if (!open) {
            setEditingPlan(
              null,
            );
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlan
                ? "Bakım planını düzenle"
                : "Yeni periyodik bakım planı"}
            </DialogTitle>

            <DialogDescription>
              Makineyi, bakım periyodunu ve sonraki bakım tarihini belirleyin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="periodic-maintenance-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(
              event,
            ) => {
              event.preventDefault();

              const form =
                new FormData(
                  event.currentTarget,
                );

              const machineId =
                String(
                  form.get(
                    "machine_id",
                  ) ?? "",
                );

              const name =
                String(
                  form.get(
                    "name",
                  ) ?? "",
                ).trim();

              const intervalDays =
                Number(
                  form.get(
                    "interval_days",
                  ) ?? 0,
                );

              const nextDate =
                String(
                  form.get(
                    "next_maintenance_date",
                  ) ?? "",
                );

              if (
                !machineId
              ) {
                toast.error(
                  "Makine seçmelisiniz.",
                );

                return;
              }

              if (
                !name
              ) {
                toast.error(
                  "Bakım adı zorunludur.",
                );

                return;
              }

              if (
                !Number.isInteger(
                  intervalDays,
                ) ||
                intervalDays <=
                  0
              ) {
                toast.error(
                  "Bakım periyodu 1 veya daha büyük tam sayı olmalıdır.",
                );

                return;
              }

              if (
                !nextDate
              ) {
                toast.error(
                  "Sonraki bakım tarihi zorunludur.",
                );

                return;
              }

              const assigned =
                String(
                  form.get(
                    "assigned_to",
                  ) ?? "",
                );

              savePlan.mutate({
                ...(editingPlan
                  ? {
                      id:
                        editingPlan.id,
                    }
                  : {}),

                machine_id:
                  machineId,

                name,

                description:
                  String(
                    form.get(
                      "description",
                    ) ?? "",
                  ).trim() ||
                  null,

                interval_days:
                  intervalDays,

                last_maintenance_date:
                  String(
                    form.get(
                      "last_maintenance_date",
                    ) ?? "",
                  ) ||
                  null,

                next_maintenance_date:
                  nextDate,

                assigned_to:
                  assigned &&
                  assigned !==
                    "none"
                    ? assigned
                    : null,

                priority:
                  String(
                    form.get(
                      "priority",
                    ) ?? "normal",
                  ) as MaintenancePriority,

                is_active:
                  String(
                    form.get(
                      "is_active",
                    ) ?? "true",
                  ) ===
                  "true",
              });
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label>
                Makine
              </Label>

              <Select
                name="machine_id"
                defaultValue={
                  editingPlan?.machine_id ??
                  ""
                }
                key={
                  editingPlan?.id ??
                  "new-machine"
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Makine seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(machines.data ?? []).map(
                    (
                      machine,
                    ) => (
                      <SelectItem
                        key={
                          machine.id
                        }
                        value={
                          machine.id
                        }
                      >
                        {machine.code} -{" "}
                        {machine.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Bakım Adı
              </Label>

              <Input
                name="name"
                required
                placeholder="Örn. Motor genel kontrolü"
                defaultValue={
                  editingPlan?.name ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Bakım Periyodu (Gün)
              </Label>

              <Input
                name="interval_days"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={
                  editingPlan?.interval_days ??
                  30
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Öncelik
              </Label>

              <Select
                name="priority"
                defaultValue={
                  editingPlan?.priority ??
                  "normal"
                }
                key={
                  editingPlan?.id
                    ? `priority-${editingPlan.id}`
                    : "new-priority"
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="low">
                    Düşük
                  </SelectItem>

                  <SelectItem value="normal">
                    Normal
                  </SelectItem>

                  <SelectItem value="high">
                    Yüksek
                  </SelectItem>

                  <SelectItem value="critical">
                    Kritik
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Son Bakım Tarihi
              </Label>

              <Input
                name="last_maintenance_date"
                type="date"
                defaultValue={
                  editingPlan?.last_maintenance_date ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Sonraki Bakım Tarihi
              </Label>

              <Input
                name="next_maintenance_date"
                type="date"
                required
                defaultValue={
                  editingPlan?.next_maintenance_date ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Sorumlu Personel
              </Label>

              <Select
                name="assigned_to"
                defaultValue={
                  editingPlan?.assigned_to ??
                  "none"
                }
                key={
                  editingPlan?.id
                    ? `assigned-${editingPlan.id}`
                    : "new-assigned"
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Personel seçin" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="none">
                    Atanmadı
                  </SelectItem>

                  {(users.data ?? []).map(
                    (
                      user,
                    ) => (
                      <SelectItem
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        {user.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={
                  String(
                    editingPlan?.is_active ??
                      true,
                  )
                }
                key={
                  editingPlan?.id
                    ? `active-${editingPlan.id}`
                    : "new-active"
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="true">
                    Aktif
                  </SelectItem>

                  <SelectItem value="false">
                    Pasif
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Açıklama
              </Label>

              <Textarea
                name="description"
                rows={4}
                placeholder="Bakım sırasında yapılacak kontroller..."
                defaultValue={
                  editingPlan?.description ??
                  ""
                }
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(
                  false,
                );
              }}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="periodic-maintenance-form"
              disabled={
                savePlan.isPending
              }
            >
              <CalendarClock className="mr-2 size-4" />

              {savePlan.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}