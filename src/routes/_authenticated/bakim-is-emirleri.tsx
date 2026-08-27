import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Pencil, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/shared/data-table";
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
import { writeAudit } from "@/lib/audit";
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/bakim-is-emirleri")({
  head: () => ({
    meta: [
      { title: "Bakım İş Emirleri | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Planlı, periyodik ve arıza kaynaklı bakım iş emirlerini yönetin.",
      },
    ],
  }),
  component: MaintenanceOrdersPage,
});

type MaintenanceType = "corrective" | "preventive" | "periodic";
type MaintenancePriority = "low" | "normal" | "high" | "critical";
type MaintenanceStatus = "planned" | "in_progress" | "completed" | "cancelled";

type MachineOption = {
  id: string;
  code: string;
  name: string;
};

type FaultOption = {
  id: string;
  fault_no: string;
  machine_id: string;
  title: string;
  status: string;
};

type UserOption = {
  id: string;
  label: string;
};

type MaintenanceOrderRow = {
  id: string;
  order_no: string;
  machine_id: string;
  fault_id: string | null;
  maintenance_type: MaintenanceType;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_to: string | null;
  planned_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  resolution_notes: string | null;
  created_by: string | null;
  created_at: string;
};

type MaintenanceOrderFormValues = {
  id?: string;
  order_no: string;
  machine_id: string;
  fault_id: string | null;
  maintenance_type: MaintenanceType;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_to: string | null;
  planned_date: string | null;
  resolution_notes: string | null;
};

const db = supabase as any;

function typeLabel(type: MaintenanceType) {
  switch (type) {
    case "corrective":
      return "Arıza Bakımı";
    case "preventive":
      return "Önleyici Bakım";
    case "periodic":
      return "Periyodik Bakım";
    default:
      return type;
  }
}

function priorityLabel(priority: MaintenancePriority) {
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
): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "default";
  }
}

function statusLabel(status: MaintenanceStatus) {
  switch (status) {
    case "planned":
      return "Planlandı";
    case "in_progress":
      return "İşlemde";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
    default:
      return status;
  }
}

function statusVariant(
  status: MaintenanceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "in_progress":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function MaintenanceOrdersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] =
    useState<MaintenanceOrderRow | null>(null);

  const [completeDialogOpen, setCompleteDialogOpen] =
    useState(false);
  const [completingOrder, setCompletingOrder] =
    useState<MaintenanceOrderRow | null>(null);

  const machines = useQuery<MachineOption[]>({
    queryKey: ["maintenance-machines"],
    queryFn: async () => {
      const { data, error } = await db
        .from("machines")
        .select("id, code, name")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data ?? []) as MachineOption[];
    },
  });

  const faults = useQuery<FaultOption[]>({
    queryKey: ["maintenance-faults"],
    queryFn: async () => {
      const { data, error } = await db
        .from("machine_faults")
        .select("id, fault_no, machine_id, title, status")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as FaultOption[];
    },
  });

  /*
   * Personel ataması için auth.users doğrudan tarayıcıdan okunamaz.
   * Mevcut projedeki profiles tablosu varsa kullanıcıları oradan alıyoruz.
   * Tablo/kolon yapısı farklıysa sorgu hata vermesin diye bu sorgu
   * başarısız olduğunda boş listeye düşer.
   */
  const users = useQuery<UserOption[]>({
    queryKey: ["maintenance-assignees"],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (error) return [];

      return (data ?? []).map((item: any) => ({
        id: item.id,
        label:
          item.full_name?.trim() ||
          item.email?.trim() ||
          item.id,
      }));
    },
  });

  const orders = useQuery<MaintenanceOrderRow[]>({
    queryKey: ["maintenance-orders"],
    queryFn: async () => {
      const { data, error } = await db
        .from("maintenance_orders")
        .select(`
          id,
          order_no,
          machine_id,
          fault_id,
          maintenance_type,
          title,
          description,
          priority,
          status,
          assigned_to,
          planned_date,
          started_at,
          completed_at,
          resolution_notes,
          created_by,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MaintenanceOrderRow[];
    },
  });

  const saveOrder = useMutation({
    mutationFn: async (values: MaintenanceOrderFormValues) => {
      const now = new Date().toISOString();

      const basePayload = {
        order_no: values.order_no.trim().toUpperCase(),
        machine_id: values.machine_id,
        fault_id: values.fault_id,
        maintenance_type: values.maintenance_type,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        priority: values.priority,
        status: values.status,
        assigned_to: values.assigned_to,
        planned_date: values.planned_date,
        resolution_notes: values.resolution_notes?.trim() || null,
      };

      if (values.id) {
        const current = editingOrder;

        const payload = {
          ...basePayload,
          started_at:
            values.status === "in_progress"
              ? current?.started_at ?? now
              : current?.started_at ?? null,
          completed_at:
            values.status === "completed"
              ? current?.completed_at ?? now
              : values.status === "cancelled"
                ? current?.completed_at ?? null
                : null,
        };

        const { error } = await db
          .from("maintenance_orders")
          .update(payload)
          .eq("id", values.id);

        if (error) throw error;

        if (values.fault_id) {
          if (values.status === "in_progress") {
            const { error: faultError } = await db
              .from("machine_faults")
              .update({ status: "in_progress" })
              .eq("id", values.fault_id);

            if (faultError) throw faultError;
          }

          if (values.status === "completed") {
            const { error: faultError } = await db
              .from("machine_faults")
              .update({
                status: "resolved",
                resolved_at: now,
              })
              .eq("id", values.fault_id);

            if (faultError) throw faultError;
          }
        }

        if (values.status === "in_progress") {
          const { error: machineError } = await db
            .from("machines")
            .update({ status: "maintenance" })
            .eq("id", values.machine_id);

          if (machineError) throw machineError;
        }

        if (values.status === "completed") {
          const { error: machineError } = await db
            .from("machines")
            .update({ status: "active" })
            .eq("id", values.machine_id);

          if (machineError) throw machineError;
        }

        await writeAudit({
          action: "update",
          module: "bakim",
          recordId: values.id,
          newData: payload,
          description: `${payload.order_no} bakım iş emri güncellendi`,
        });

        return;
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const { data, error } = await db
        .from("maintenance_orders")
        .insert({
          ...basePayload,
          created_by: userData.user?.id ?? null,
          started_at:
            values.status === "in_progress" ? now : null,
          completed_at:
            values.status === "completed" ? now : null,
        })
        .select("id")
        .single();

      if (error) throw error;

      await writeAudit({
        action: "create",
        module: "bakim",
        recordId: String(data.id),
        newData: basePayload,
        description: `${basePayload.order_no} bakım iş emri oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Bakım iş emri kaydedildi.");
      setDialogOpen(false);
      setEditingOrder(null);

      void queryClient.invalidateQueries({
        queryKey: ["maintenance-orders"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["machine-faults"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["maintenance-faults"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["machines"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["maintenance-machines"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["maintenance-plans"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  const completeOrder = useMutation({
    mutationFn: async ({
      order,
      resolutionNotes,
    }: {
      order: MaintenanceOrderRow;
      resolutionNotes: string;
    }) => {
      const now = new Date().toISOString();

      const { error: orderError } = await db
        .from("maintenance_orders")
        .update({
          status: "completed",
          completed_at: now,
          resolution_notes: resolutionNotes.trim(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      if (order.fault_id) {
        const { error: faultError } = await db
          .from("machine_faults")
          .update({
            status: "resolved",
            resolved_at: now,
          })
          .eq("id", order.fault_id);

        if (faultError) throw faultError;
      }

      const { error: machineError } = await db
        .from("machines")
        .update({
          status: "active",
          is_active: true,
        })
        .eq("id", order.machine_id);

      if (machineError) throw machineError;

      /*
       * =====================================================
       * PERİYODİK BAKIM PLANI TARİHLERİNİ İLERLET
       * =====================================================
       *
       * Bu iş emri periyodik bakım kaynaklıysa, aynı makine ve
       * bakım başlığına ait aktif planı bul. Bakım tamamlandığı
       * günü son bakım tarihi yap ve sonraki tarihi periyot kadar
       * ileri taşı.
       */
      if (order.maintenance_type === "periodic") {
        const completedDate = now.slice(0, 10);

        const {
          data: planData,
          error: planFindError,
        } = await db
          .from("maintenance_plans")
          .select(`
            id,
            interval_days
          `)
          .eq("machine_id", order.machine_id)
          .eq("name", order.title)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planFindError) throw planFindError;

        if (planData) {
          const intervalDays = Number(planData.interval_days ?? 0);

          if (intervalDays > 0) {
            const nextDate = new Date(`${completedDate}T00:00:00`);
            nextDate.setDate(nextDate.getDate() + intervalDays);

            const nextMaintenanceDate = nextDate
              .toISOString()
              .slice(0, 10);

            const { error: planUpdateError } = await db
              .from("maintenance_plans")
              .update({
                last_maintenance_date: completedDate,
                next_maintenance_date: nextMaintenanceDate,
              })
              .eq("id", planData.id);

            if (planUpdateError) throw planUpdateError;
          }
        }
      }

      await writeAudit({
        action: "update",
        module: "bakim",
        recordId: order.id,
        newData: {
          status: "completed",
          completed_at: now,
          resolution_notes: resolutionNotes.trim(),
        },
        description: `${order.order_no} bakım iş emri tamamlandı`,
      });
    },

    onSuccess: () => {
      toast.success("Bakım başarıyla tamamlandı.");
      setCompleteDialogOpen(false);
      setCompletingOrder(null);

      void queryClient.invalidateQueries({
        queryKey: ["maintenance-orders"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["machine-faults"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["maintenance-faults"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["machines"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["maintenance-machines"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  const machineMap = useMemo(
    () =>
      new Map(
        (machines.data ?? []).map((machine) => [
          machine.id,
          machine,
        ]),
      ),
    [machines.data],
  );

  const faultMap = useMemo(
    () =>
      new Map(
        (faults.data ?? []).map((fault) => [
          fault.id,
          fault,
        ]),
      ),
    [faults.data],
  );

  const userMap = useMemo(
    () =>
      new Map(
        (users.data ?? []).map((user) => [
          user.id,
          user.label,
        ]),
      ),
    [users.data],
  );

  const columns: Column<MaintenanceOrderRow>[] = [
    {
      id: "order_no",
      header: "İş Emri No",
      cell: (row) => (
        <span className="font-mono text-sm">
          {row.order_no}
        </span>
      ),
      value: (row) => row.order_no,
      sortable: true,
    },
    {
      id: "machine",
      header: "Makine",
      cell: (row) => {
        const machine = machineMap.get(row.machine_id);
        return machine
          ? `${machine.code} - ${machine.name}`
          : "—";
      },
      value: (row) => {
        const machine = machineMap.get(row.machine_id);
        return machine
          ? `${machine.code} ${machine.name}`
          : "";
      },
      sortable: true,
    },
    {
      id: "title",
      header: "Bakım",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>
          <div className="text-xs text-muted-foreground">
            {typeLabel(row.maintenance_type)}
            {row.fault_id
              ? ` • ${faultMap.get(row.fault_id)?.fault_no ?? "Arıza"}`
              : ""}
          </div>
        </div>
      ),
      value: (row) => row.title,
      sortable: true,
    },
    {
      id: "assigned",
      header: "Atanan",
      cell: (row) =>
        row.assigned_to
          ? userMap.get(row.assigned_to) ?? "Atanmış kullanıcı"
          : "—",
      value: (row) =>
        row.assigned_to
          ? userMap.get(row.assigned_to) ?? row.assigned_to
          : "",
    },
    {
      id: "priority",
      header: "Öncelik",
      cell: (row) => (
        <Badge variant={priorityVariant(row.priority)}>
          {priorityLabel(row.priority)}
        </Badge>
      ),
      value: (row) => priorityLabel(row.priority),
      sortable: true,
    },
    {
      id: "status",
      header: "Durum",
      cell: (row) => (
        <Badge variant={statusVariant(row.status)}>
          {statusLabel(row.status)}
        </Badge>
      ),
      value: (row) => statusLabel(row.status),
      sortable: true,
    },
    {
      id: "planned_date",
      header: "Planlanan",
      cell: (row) =>
        row.planned_date
          ? new Date(`${row.planned_date}T00:00:00`).toLocaleDateString("tr-TR")
          : "—",
      value: (row) => row.planned_date ?? "",
      sortable: true,
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === "planned" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Bakımı Başlat"
              disabled={saveOrder.isPending}
              onClick={() => {
                saveOrder.mutate({
                  id: row.id,
                  order_no: row.order_no,
                  machine_id: row.machine_id,
                  fault_id: row.fault_id,
                  maintenance_type: row.maintenance_type,
                  title: row.title,
                  description: row.description,
                  priority: row.priority,
                  status: "in_progress",
                  assigned_to: row.assigned_to,
                  planned_date: row.planned_date,
                  resolution_notes: row.resolution_notes,
                });
              }}
            >
              <Play className="size-4" />
            </Button>
          ) : null}

          {row.status === "in_progress" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Bakımı Tamamla"
              onClick={() => {
                setCompletingOrder(row);
                setCompleteDialogOpen(true);
              }}
            >
              <ClipboardCheck className="size-4" />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Düzenle"
            onClick={() => {
              setEditingOrder(row);
              setDialogOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  if (
    machines.isError ||
    faults.isError ||
    orders.isError
  ) {
    return (
      <>
        <PageHeader
          title="Bakım İş Emirleri"
          description="Bakım ve onarım iş emirlerini yönetin."
        />

        <ErrorState
          onRetry={() => {
            void machines.refetch();
            void faults.refetch();
            void orders.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Bakım İş Emirleri"
        description="Arıza, önleyici ve periyodik bakım işlerini planlayın, atayın ve takip edin."
      />

      <DataTable
        columns={columns}
        rows={orders.data ?? []}
        rowKey={(row) => row.id}
        loading={orders.isLoading || machines.isLoading}
        searchPlaceholder="İş emri, makine, bakım başlığı veya durum ara..."
        mobileTitle={(row) => row.order_no}
        emptyTitle="Henüz bakım iş emri yok"
        emptyDescription="İlk bakım iş emrinizi oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingOrder(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Yeni Bakım İş Emri
          </Button>
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingOrder(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingOrder
                ? "Bakım iş emrini düzenle"
                : "Yeni bakım iş emri"}
            </DialogTitle>
            <DialogDescription>
              Makine, bakım türü, arıza, sorumlu ve planlama bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="maintenance-order-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);

              const orderNo =
                String(form.get("order_no") ?? "").trim();
              const machineId =
                String(form.get("machine_id") ?? "");
              const title =
                String(form.get("title") ?? "").trim();
              const status =
                String(
                  form.get("status") ?? "planned",
                ) as MaintenanceStatus;
              const resolutionNotes =
                String(
                  form.get("resolution_notes") ?? "",
                ).trim();

              if (!orderNo) {
                toast.error("İş emri numarası zorunludur.");
                return;
              }

              if (!machineId) {
                toast.error("Makine seçmelisiniz.");
                return;
              }

              if (!title) {
                toast.error("Bakım başlığı zorunludur.");
                return;
              }

              if (
                status === "completed" &&
                !resolutionNotes
              ) {
                toast.error(
                  "Tamamlanan bakım için çözüm notu yazmalısınız.",
                );
                return;
              }

              const faultValue =
                String(form.get("fault_id") ?? "");

              const assignedValue =
                String(form.get("assigned_to") ?? "");

              saveOrder.mutate({
                ...(editingOrder
                  ? { id: editingOrder.id }
                  : {}),
                order_no: orderNo,
                machine_id: machineId,
                fault_id:
                  faultValue && faultValue !== "none"
                    ? faultValue
                    : null,
                maintenance_type:
                  String(
                    form.get("maintenance_type") ??
                      "corrective",
                  ) as MaintenanceType,
                title,
                description:
                  String(
                    form.get("description") ?? "",
                  ) || null,
                priority:
                  String(
                    form.get("priority") ?? "normal",
                  ) as MaintenancePriority,
                status,
                assigned_to:
                  assignedValue &&
                  assignedValue !== "none"
                    ? assignedValue
                    : null,
                planned_date:
                  String(
                    form.get("planned_date") ?? "",
                  ) || null,
                resolution_notes:
                  resolutionNotes || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label>İş Emri No</Label>
              <Input
                name="order_no"
                required
                placeholder="Örn. BKM-001"
                defaultValue={editingOrder?.order_no ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                name="status"
                defaultValue={editingOrder?.status ?? "planned"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">
                    Planlandı
                  </SelectItem>
                  <SelectItem value="in_progress">
                    İşlemde
                  </SelectItem>
                  <SelectItem value="completed">
                    Tamamlandı
                  </SelectItem>
                  <SelectItem value="cancelled">
                    İptal
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Makine</Label>
              <Select
                name="machine_id"
                defaultValue={editingOrder?.machine_id ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Makine seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(machines.data ?? []).map((machine) => (
                    <SelectItem
                      key={machine.id}
                      value={machine.id}
                    >
                      {machine.code} - {machine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bakım Türü</Label>
              <Select
                name="maintenance_type"
                defaultValue={
                  editingOrder?.maintenance_type ??
                  "corrective"
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrective">
                    Arıza Bakımı
                  </SelectItem>
                  <SelectItem value="preventive">
                    Önleyici Bakım
                  </SelectItem>
                  <SelectItem value="periodic">
                    Periyodik Bakım
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Öncelik</Label>
              <Select
                name="priority"
                defaultValue={
                  editingOrder?.priority ?? "normal"
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Düşük</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Yüksek</SelectItem>
                  <SelectItem value="critical">Kritik</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Bağlı Arıza</Label>
              <Select
                name="fault_id"
                defaultValue={editingOrder?.fault_id ?? "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Arıza seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Arızaya bağlı değil
                  </SelectItem>
                  {(faults.data ?? []).map((fault) => (
                    <SelectItem
                      key={fault.id}
                      value={fault.id}
                    >
                      {fault.fault_no} - {fault.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Bakım Başlığı</Label>
              <Input
                name="title"
                required
                placeholder="Örn. Motor soğutma sistemi kontrolü"
                defaultValue={editingOrder?.title ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Atanan Personel</Label>
              <Select
                name="assigned_to"
                defaultValue={
                  editingOrder?.assigned_to ?? "none"
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Personel seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Atama yapılmadı
                  </SelectItem>
                  {(users.data ?? []).map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                    >
                      {user.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Planlanan Tarih</Label>
              <Input
                name="planned_date"
                type="date"
                defaultValue={
                  editingOrder?.planned_date ?? ""
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Açıklama</Label>
              <Textarea
                name="description"
                rows={3}
                placeholder="Yapılacak bakım işlemleri..."
                defaultValue={
                  editingOrder?.description ?? ""
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Çözüm / Tamamlama Notu</Label>
              <Textarea
                name="resolution_notes"
                rows={3}
                placeholder="Bakım tamamlandığında yapılan işlemleri yazın..."
                defaultValue={
                  editingOrder?.resolution_notes ?? ""
                }
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="maintenance-order-form"
              disabled={saveOrder.isPending}
            >
              <ClipboardCheck className="mr-2 size-4" />
              {saveOrder.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={completeDialogOpen}
        onOpenChange={(open) => {
          setCompleteDialogOpen(open);

          if (!open) {
            setCompletingOrder(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bakımı Tamamla</DialogTitle>

            <DialogDescription>
              {completingOrder
                ? `${completingOrder.order_no} iş emri için yapılan işlemleri yazın. Kaydettiğinizde iş emri tamamlanacak, bağlı arıza çözülecek ve makine tekrar aktif duruma alınacak.`
                : "Tamamlama bilgilerini girin."}
            </DialogDescription>
          </DialogHeader>

          <form
            id="maintenance-complete-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();

              if (!completingOrder) {
                return;
              }

              const form = new FormData(event.currentTarget);
              const resolutionNotes = String(
                form.get("resolution_notes") ?? "",
              ).trim();

              if (!resolutionNotes) {
                toast.error("Yapılan işlem / çözüm notu zorunludur.");
                return;
              }

              completeOrder.mutate({
                order: completingOrder,
                resolutionNotes,
              });
            }}
          >
            <div className="space-y-2">
              <Label>Yapılan İşlem / Çözüm Notu</Label>

              <Textarea
                name="resolution_notes"
                rows={5}
                required
                placeholder="Örn. Motor soğutma sistemi kontrol edildi, bağlantılar sıkıldı ve test başarılı tamamlandı."
                defaultValue={
                  completingOrder?.resolution_notes ?? ""
                }
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCompleteDialogOpen(false);
                setCompletingOrder(null);
              }}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="maintenance-complete-form"
              disabled={completeOrder.isPending}
            >
              <ClipboardCheck className="mr-2 size-4" />
              {completeOrder.isPending
                ? "Tamamlanıyor..."
                : "Bakımı Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}