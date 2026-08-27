import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory, Pencil, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/makineler")({
  head: () => ({
    meta: [
      { title: "Makineler | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Fabrika makine ve ekipman kayıtlarını yönetin.",
      },
    ],
  }),
  component: MachinesPage,
});

type MachineStatus = "active" | "maintenance" | "fault" | "inactive";

type MachineRow = {
  id: string;
  code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  department: string | null;
  installation_date: string | null;
  status: MachineStatus;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type MachineFormValues = {
  id?: string;
  code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  department: string | null;
  installation_date: string | null;
  status: MachineStatus;
  description: string | null;
  is_active: boolean;
};

const db = supabase as any;

function statusLabel(status: MachineStatus) {
  switch (status) {
    case "active":
      return "Aktif";
    case "maintenance":
      return "Bakımda";
    case "fault":
      return "Arızalı";
    case "inactive":
      return "Pasif";
    default:
      return status;
  }
}

function statusVariant(
  status: MachineStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "maintenance":
      return "secondary";
    case "fault":
      return "destructive";
    default:
      return "outline";
  }
}

function MachinesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineRow | null>(null);

  const machines = useQuery<MachineRow[]>({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await db
        .from("machines")
        .select(`
          id,
          code,
          name,
          manufacturer,
          model,
          serial_number,
          location,
          department,
          installation_date,
          status,
          description,
          is_active,
          created_at
        `)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return (data ?? []) as MachineRow[];
    },
  });

  const saveMachine = useMutation({
    mutationFn: async (values: MachineFormValues) => {
      const payload = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        manufacturer: values.manufacturer?.trim() || null,
        model: values.model?.trim() || null,
        serial_number: values.serial_number?.trim() || null,
        location: values.location?.trim() || null,
        department: values.department?.trim() || null,
        installation_date: values.installation_date || null,
        status: values.status,
        description: values.description?.trim() || null,
        is_active: values.is_active,
      };

      if (values.id) {
        const { error } = await db
          .from("machines")
          .update(payload)
          .eq("id", values.id);

        if (error) throw error;

        await writeAudit({
          action: "update",
          module: "makineler",
          recordId: values.id,
          newData: payload,
          description: `${payload.name} makinesi güncellendi`,
        });
        return;
      }

      const { data, error } = await db
        .from("machines")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      await writeAudit({
        action: "create",
        module: "makineler",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.name} makinesi oluşturuldu`,
      });
    },
    onSuccess: () => {
      toast.success("Makine kaydedildi.");
      setDialogOpen(false);
      setEditingMachine(null);
      void queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const deleteMachine = useMutation({
    mutationFn: async (machine: MachineRow) => {
      const { error } = await db
        .from("machines")
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
          status: "inactive",
        })
        .eq("id", machine.id);

      if (error) throw error;

      await writeAudit({
        action: "delete",
        module: "makineler",
        recordId: machine.id,
        description: `${machine.name} makinesi silindi`,
      });
    },
    onSuccess: () => {
      toast.success("Makine silindi.");
      void queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const columns: Column<MachineRow>[] = [
    {
      id: "code",
      header: "Kod",
      cell: (row) => <span className="font-mono text-sm">{row.code}</span>,
      value: (row) => row.code,
      sortable: true,
    },
    {
      id: "name",
      header: "Makine",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {(row.manufacturer || row.model) && (
            <div className="text-xs text-muted-foreground">
              {[row.manufacturer, row.model].filter(Boolean).join(" / ")}
            </div>
          )}
        </div>
      ),
      value: (row) => row.name,
      sortable: true,
    },
    {
      id: "serial",
      header: "Seri No",
      cell: (row) => row.serial_number ?? "—",
      value: (row) => row.serial_number ?? "",
    },
    {
      id: "department",
      header: "Departman",
      cell: (row) => row.department ?? "—",
      value: (row) => row.department ?? "",
      sortable: true,
    },
    {
      id: "location",
      header: "Konum",
      cell: (row) => row.location ?? "—",
      value: (row) => row.location ?? "",
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
      id: "actions",
      header: "",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Düzenle"
            onClick={() => {
              setEditingMachine(row);
              setDialogOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Sil"
            disabled={deleteMachine.isPending}
            onClick={() => {
              if (window.confirm(`${row.name} makinesini silmek istediğinize emin misiniz?`)) {
                deleteMachine.mutate(row);
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  if (machines.isError) {
    return (
      <>
        <PageHeader
          title="Makineler"
          description="Fabrika makine ve ekipman kayıtlarını yönetin."
        />
        <ErrorState onRetry={() => void machines.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Makineler"
        description="Bakım ve arıza süreçlerinde kullanılacak makine ve ekipman kayıtlarını yönetin."
      />

      <DataTable
        columns={columns}
        rows={machines.data ?? []}
        rowKey={(row) => row.id}
        loading={machines.isLoading}
        searchPlaceholder="Makine adı, kod, üretici, model veya seri no ara..."
        mobileTitle={(row) => row.name}
        emptyTitle="Henüz makine yok"
        emptyDescription="İlk makine veya ekipman kaydınızı oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingMachine(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Yeni Makine
          </Button>
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMachine(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMachine ? "Makineyi düzenle" : "Yeni makine"}
            </DialogTitle>
            <DialogDescription>
              Makine kimlik, konum ve çalışma durumu bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="machine-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);

              const code = String(form.get("code") ?? "").trim();
              const name = String(form.get("name") ?? "").trim();

              if (!code) {
                toast.error("Makine kodu zorunludur.");
                return;
              }
              if (!name) {
                toast.error("Makine adı zorunludur.");
                return;
              }

              saveMachine.mutate({
                ...(editingMachine ? { id: editingMachine.id } : {}),
                code,
                name,
                manufacturer: String(form.get("manufacturer") ?? "") || null,
                model: String(form.get("model") ?? "") || null,
                serial_number: String(form.get("serial_number") ?? "") || null,
                location: String(form.get("location") ?? "") || null,
                department: String(form.get("department") ?? "") || null,
                installation_date:
                  String(form.get("installation_date") ?? "") || null,
                status: String(form.get("status") ?? "active") as MachineStatus,
                description: String(form.get("description") ?? "") || null,
                is_active: String(form.get("is_active") ?? "true") === "true",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="machine-code">Makine Kodu</Label>
              <Input
                id="machine-code"
                name="code"
                required
                placeholder="Örn. MAK-001"
                defaultValue={editingMachine?.code ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                name="status"
                defaultValue={editingMachine?.status ?? "active"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="maintenance">Bakımda</SelectItem>
                  <SelectItem value="fault">Arızalı</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="machine-name">Makine Adı</Label>
              <Input
                id="machine-name"
                name="name"
                required
                placeholder="Örn. CNC Torna 1"
                defaultValue={editingMachine?.name ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Üretici</Label>
              <Input
                name="manufacturer"
                placeholder="Örn. Siemens"
                defaultValue={editingMachine?.manufacturer ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                name="model"
                placeholder="Model"
                defaultValue={editingMachine?.model ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Seri Numarası</Label>
              <Input
                name="serial_number"
                defaultValue={editingMachine?.serial_number ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Kurulum Tarihi</Label>
              <Input
                name="installation_date"
                type="date"
                defaultValue={editingMachine?.installation_date ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Departman</Label>
              <Input
                name="department"
                placeholder="Örn. Üretim"
                defaultValue={editingMachine?.department ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Konum</Label>
              <Input
                name="location"
                placeholder="Örn. Hat 1"
                defaultValue={editingMachine?.location ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Kayıt Durumu</Label>
              <Select
                name="is_active"
                defaultValue={String(editingMachine?.is_active ?? true)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Açıklama</Label>
              <Textarea
                name="description"
                rows={3}
                placeholder="Makine hakkında notlar..."
                defaultValue={editingMachine?.description ?? ""}
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
              form="machine-form"
              disabled={saveMachine.isPending}
            >
              <Factory className="mr-2 size-4" />
              {saveMachine.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}