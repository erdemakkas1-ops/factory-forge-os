import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/arizalar")({
  head: () => ({
    meta: [
      { title: "Arıza Bildirimleri | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Makine ve ekipman arıza bildirimlerini yönetin.",
      },
    ],
  }),
  component: FaultsPage,
});

type FaultPriority = "low" | "normal" | "high" | "critical";
type FaultStatus = "open" | "in_progress" | "resolved" | "cancelled";

type MachineOption = {
  id: string;
  code: string;
  name: string;
};

type FaultRow = {
  id: string;
  fault_no: string;
  machine_id: string;
  title: string;
  description: string | null;
  priority: FaultPriority;
  status: FaultStatus;
  reported_by: string | null;
  reported_at: string;
  resolved_at: string | null;
  created_at: string;
};

type FaultFormValues = {
  id?: string;
  fault_no: string;
  machine_id: string;
  title: string;
  description: string | null;
  priority: FaultPriority;
  status: FaultStatus;
  resolved_at: string | null;
};

const db = supabase as any;

function priorityLabel(priority: FaultPriority) {
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
  priority: FaultPriority,
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

function statusLabel(status: FaultStatus) {
  switch (status) {
    case "open":
      return "Açık";
    case "in_progress":
      return "İşlemde";
    case "resolved":
      return "Çözüldü";
    case "cancelled":
      return "İptal";
    default:
      return status;
  }
}

function statusVariant(
  status: FaultStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "resolved":
      return "default";
    case "in_progress":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function FaultsPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFault, setEditingFault] = useState<FaultRow | null>(null);

  const machines = useQuery<MachineOption[]>({
    queryKey: ["fault-machines"],
    queryFn: async () => {
      const { data, error } = await db
        .from("machines")
        .select(`
          id,
          code,
          name
        `)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return (data ?? []) as MachineOption[];
    },
  });

  const faults = useQuery<FaultRow[]>({
    queryKey: ["machine-faults"],
    queryFn: async () => {
      const { data, error } = await db
        .from("machine_faults")
        .select(`
          id,
          fault_no,
          machine_id,
          title,
          description,
          priority,
          status,
          reported_by,
          reported_at,
          resolved_at,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map(
        (item: any): FaultRow => ({
          id: item.id,
          fault_no: item.fault_no,
          machine_id: item.machine_id,
          title: item.title,
          description: item.description ?? null,
          priority: item.priority as FaultPriority,
          status: item.status as FaultStatus,
          reported_by: item.reported_by ?? null,
          reported_at: item.reported_at,
          resolved_at: item.resolved_at ?? null,
          created_at: item.created_at,
        }),
      );
    },
  });

  const saveFault = useMutation({
    mutationFn: async (values: FaultFormValues) => {
      const payload = {
        fault_no: values.fault_no.trim().toUpperCase(),
        machine_id: values.machine_id,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        priority: values.priority,
        status: values.status,
        resolved_at: values.status === "resolved"
          ? values.resolved_at ?? new Date().toISOString()
          : null,
      };

      if (values.id) {
        const { error } = await db
          .from("machine_faults")
          .update(payload)
          .eq("id", values.id);

        if (error) throw error;

        await writeAudit({
          action: "update",
          module: "arizalar",
          recordId: values.id,
          newData: payload,
          description: `${payload.fault_no} arıza kaydı güncellendi`,
        });

        return;
      }

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const { data, error } = await db
        .from("machine_faults")
        .insert({
          ...payload,
          reported_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();

      if (error) throw error;

      await writeAudit({
        action: "create",
        module: "arizalar",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.fault_no} arıza kaydı oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Arıza kaydı kaydedildi.");
      setDialogOpen(false);
      setEditingFault(null);

      void queryClient.invalidateQueries({
        queryKey: ["machine-faults"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  const machineMap = new Map(
    (machines.data ?? []).map((machine) => [machine.id, machine]),
  );

  const columns: Column<FaultRow>[] = [
    {
      id: "fault_no",
      header: "Arıza No",
      cell: (row) => (
        <span className="font-mono text-sm">
          {row.fault_no}
        </span>
      ),
      value: (row) => row.fault_no,
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
      header: "Başlık",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>

          {row.description ? (
            <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">
              {row.description}
            </div>
          ) : null}
        </div>
      ),
      value: (row) => row.title,
      sortable: true,
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
      id: "reported_at",
      header: "Bildirim Tarihi",
      cell: (row) =>
        new Date(row.reported_at).toLocaleString("tr-TR"),
      value: (row) => row.reported_at,
      sortable: true,
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Düzenle"
            onClick={() => {
              setEditingFault(row);
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

  if (faults.isError || machines.isError) {
    return (
      <>
        <PageHeader
          title="Arıza Bildirimleri"
          description="Makine arıza kayıtlarını yönetin."
        />

        <ErrorState
          onRetry={() => {
            void faults.refetch();
            void machines.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Arıza Bildirimleri"
        description="Makine ve ekipmanlarda oluşan arızaları kaydedin ve durumlarını takip edin."
      />

      <DataTable
        columns={columns}
        rows={faults.data ?? []}
        rowKey={(row) => row.id}
        loading={faults.isLoading || machines.isLoading}
        searchPlaceholder="Arıza no, makine, başlık veya durum ara..."
        mobileTitle={(row) => row.fault_no}
        emptyTitle="Henüz arıza kaydı yok"
        emptyDescription="İlk arıza bildiriminizi oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingFault(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Yeni Arıza
          </Button>
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingFault(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFault
                ? "Arıza kaydını düzenle"
                : "Yeni arıza bildirimi"}
            </DialogTitle>

            <DialogDescription>
              Makine, öncelik ve arıza durum bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="fault-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const form = new FormData(event.currentTarget);

              const faultNo =
                String(form.get("fault_no") ?? "").trim();

              const machineId =
                String(form.get("machine_id") ?? "");

              const title =
                String(form.get("title") ?? "").trim();

              const status =
                String(
                  form.get("status") ?? "open",
                ) as FaultStatus;

              if (!faultNo) {
                toast.error("Arıza numarası zorunludur.");
                return;
              }

              if (!machineId) {
                toast.error("Makine seçmelisiniz.");
                return;
              }

              if (!title) {
                toast.error("Arıza başlığı zorunludur.");
                return;
              }

              saveFault.mutate({
                ...(editingFault
                  ? { id: editingFault.id }
                  : {}),

                fault_no: faultNo,
                machine_id: machineId,
                title,

                description:
                  String(
                    form.get("description") ?? "",
                  ) || null,

                priority:
                  String(
                    form.get("priority") ?? "normal",
                  ) as FaultPriority,

                status,

                resolved_at:
                  status === "resolved"
                    ? editingFault?.resolved_at ??
                      new Date().toISOString()
                    : null,
              });
            }}
          >
            <div className="space-y-2">
              <Label>Arıza No</Label>

              <Input
                name="fault_no"
                required
                placeholder="Örn. ARZ-001"
                defaultValue={
                  editingFault?.fault_no ?? ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>

              <Select
                name="status"
                defaultValue={
                  editingFault?.status ?? "open"
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="open">
                    Açık
                  </SelectItem>

                  <SelectItem value="in_progress">
                    İşlemde
                  </SelectItem>

                  <SelectItem value="resolved">
                    Çözüldü
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
                defaultValue={
                  editingFault?.machine_id ?? ""
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Makine seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(machines.data ?? []).map(
                    (machine) => (
                      <SelectItem
                        key={machine.id}
                        value={machine.id}
                      >
                        {machine.code} - {machine.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Arıza Başlığı</Label>

              <Input
                name="title"
                required
                placeholder="Örn. Motor aşırı ısınıyor"
                defaultValue={
                  editingFault?.title ?? ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Öncelik</Label>

              <Select
                name="priority"
                defaultValue={
                  editingFault?.priority ?? "normal"
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
              <Label>Bildirim</Label>

              <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                {editingFault
                  ? new Date(
                      editingFault.reported_at,
                    ).toLocaleString("tr-TR")
                  : "Şimdi"}
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Açıklama</Label>

              <Textarea
                name="description"
                rows={4}
                placeholder="Arızanın belirtilerini ve gözlemleri yazın..."
                defaultValue={
                  editingFault?.description ?? ""
                }
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
              }}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="fault-form"
              disabled={saveFault.isPending}
            >
              <AlertTriangle className="mr-2 size-4" />

              {saveFault.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}