import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/shared/data-table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/organizasyon")({
  head: () => ({
    meta: [
      { title: "Organizasyon | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Fabrika departmanlarını ve üretim birimlerini tanımlayın, düzenleyin ve yönetin.",
      },
      { property: "og:title", content: "Organizasyon | Fabrika Yönetim Sistemi" },
      { property: "og:description", content: "Departman ve birim yapınızı yönetin." },
    ],
  }),
  component: OrganizationPage,
});

type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

type Unit = Department & { department_id: string };

function OrganizationPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("org.manage");

  const [deptOpen, setDeptOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code, description, is_active")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as Department[];
    },
  });

  const units = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, code, description, is_active, department_id")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data as Unit[];
    },
  });

  const deptNameById = new Map((departments.data ?? []).map((d) => [d.id, d.name]));

  const saveDept = useMutation({
    mutationFn: async (values: Omit<Department, "id"> & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase
          .from("departments")
          .update({
            name: values.name,
            code: values.code,
            description: values.description,
            is_active: values.is_active,
          })
          .eq("id", values.id);
        if (error) throw error;
        await writeAudit({
          action: "update",
          module: "organizasyon",
          recordId: values.id,
          newData: values,
          description: `${values.name} departmanı güncellendi`,
        });
      } else {
        const { data, error } = await supabase
          .from("departments")
          .insert({
            name: values.name,
            code: values.code,
            description: values.description,
            is_active: values.is_active,
          })
          .select("id")
          .single();
        if (error) throw error;
        await writeAudit({
          action: "create",
          module: "organizasyon",
          recordId: data.id,
          newData: values,
          description: `${values.name} departmanı oluşturuldu`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Departman kaydedildi.");
      setDeptOpen(false);
      setEditingDept(null);
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const saveUnit = useMutation({
    mutationFn: async (values: Omit<Unit, "id"> & { id?: string }) => {
      const payload = {
        name: values.name,
        code: values.code,
        description: values.description,
        is_active: values.is_active,
        department_id: values.department_id,
      };
      if (values.id) {
        const { error } = await supabase.from("units").update(payload).eq("id", values.id);
        if (error) throw error;
        await writeAudit({
          action: "update",
          module: "organizasyon",
          recordId: values.id,
          newData: payload,
          description: `${values.name} birimi güncellendi`,
        });
      } else {
        const { data, error } = await supabase.from("units").insert(payload).select("id").single();
        if (error) throw error;
        await writeAudit({
          action: "create",
          module: "organizasyon",
          recordId: data.id,
          newData: payload,
          description: `${values.name} birimi oluşturuldu`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Birim kaydedildi.");
      setUnitOpen(false);
      setEditingUnit(null);
      void queryClient.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const softDelete = useMutation({
    mutationFn: async ({ table, id, name }: { table: "departments" | "units"; id: string; name: string }) => {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
      await writeAudit({
        action: "delete",
        module: "organizasyon",
        recordId: id,
        description: `${name} kaydı arşivlendi`,
      });
      return table;
    },
    onSuccess: (table) => {
      toast.success("Kayıt arşivlendi.");
      void queryClient.invalidateQueries({ queryKey: [table] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const deptColumns: Column<Department>[] = [
    {
      id: "name",
      header: "Departman",
      cell: (r) => <span className="font-medium">{r.name}</span>,
      value: (r) => r.name,
      sortable: true,
    },
    { id: "code", header: "Kod", cell: (r) => r.code, value: (r) => r.code, sortable: true },
    {
      id: "units",
      header: "Birim",
      cell: (r) => (units.data ?? []).filter((u) => u.department_id === r.id).length,
      value: (r) => (units.data ?? []).filter((u) => u.department_id === r.id).length,
      sortable: true,
    },
    {
      id: "description",
      header: "Açıklama",
      cell: (r) => <span className="text-muted-foreground">{r.description ?? "—"}</span>,
      value: (r) => r.description,
    },
    {
      id: "status",
      header: "Durum",
      cell: (r) => <ActiveBadge active={r.is_active} />,
      value: (r) => (r.is_active ? "aktif" : "pasif"),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            cell: (r: Department) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingDept(r);
                    setDeptOpen(true);
                  }}
                >
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Arşivle"
                  onClick={() => softDelete.mutate({ table: "departments", id: r.id, name: r.name })}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ),
            className: "text-right",
          } satisfies Column<Department>,
        ]
      : []),
  ];

  const unitColumns: Column<Unit>[] = [
    {
      id: "name",
      header: "Birim",
      cell: (r) => <span className="font-medium">{r.name}</span>,
      value: (r) => r.name,
      sortable: true,
    },
    { id: "code", header: "Kod", cell: (r) => r.code, value: (r) => r.code, sortable: true },
    {
      id: "department",
      header: "Departman",
      cell: (r) => deptNameById.get(r.department_id) ?? "—",
      value: (r) => deptNameById.get(r.department_id),
      sortable: true,
    },
    {
      id: "status",
      header: "Durum",
      cell: (r) => <ActiveBadge active={r.is_active} />,
      value: (r) => (r.is_active ? "aktif" : "pasif"),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            cell: (r: Unit) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingUnit(r);
                    setUnitOpen(true);
                  }}
                >
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Arşivle"
                  onClick={() => softDelete.mutate({ table: "units", id: r.id, name: r.name })}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ),
            className: "text-right",
          } satisfies Column<Unit>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Organizasyon Yapısı"
        description="Departmanlar ve bağlı üretim birimlerini yönetin."
      />

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departmanlar</TabsTrigger>
          <TabsTrigger value="units">Birimler</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="mt-4">
          {departments.isError ? (
            <ErrorState onRetry={() => void departments.refetch()} />
          ) : (
            <DataTable
              columns={deptColumns}
              rows={departments.data ?? []}
              rowKey={(r) => r.id}
              loading={departments.isLoading}
              searchPlaceholder="Departman ara..."
              mobileTitle={(r) => r.name}
              emptyTitle="Departman yok"
              emptyDescription="İlk departmanı ekleyerek organizasyon yapınızı oluşturun."
              toolbar={
                canManage ? (
                  <Button
                    onClick={() => {
                      setEditingDept(null);
                      setDeptOpen(true);
                    }}
                  >
                    <Plus className="mr-2 size-4" /> Yeni departman
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          {units.isError ? (
            <ErrorState onRetry={() => void units.refetch()} />
          ) : (
            <DataTable
              columns={unitColumns}
              rows={units.data ?? []}
              rowKey={(r) => r.id}
              loading={units.isLoading}
              searchPlaceholder="Birim ara..."
              mobileTitle={(r) => r.name}
              emptyTitle="Birim yok"
              emptyDescription="Departmanlara bağlı üretim birimlerini ekleyin."
              toolbar={
                canManage ? (
                  <Button
                    onClick={() => {
                      setEditingUnit(null);
                      setUnitOpen(true);
                    }}
                  >
                    <Plus className="mr-2 size-4" /> Yeni birim
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Departmanı düzenle" : "Yeni departman"}</DialogTitle>
            <DialogDescription>
              Departman adı ve kısa kodu fabrika genelinde benzersiz olmalıdır.
            </DialogDescription>
          </DialogHeader>
          <form
            id="dept-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveDept.mutate({
                ...(editingDept ? { id: editingDept.id } : {}),
                name: String(f.get("name")).trim(),
                code: String(f.get("code")).trim().toUpperCase(),
                description: String(f.get("description") ?? "").trim() || null,
                is_active: f.get("is_active") === "true",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="dept-name">Departman adı</Label>
              <Input id="dept-name" name="name" required defaultValue={editingDept?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-code">Kod</Label>
              <Input
                id="dept-code"
                name="code"
                required
                placeholder="URT"
                defaultValue={editingDept?.code ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Açıklama</Label>
              <Textarea
                id="dept-desc"
                name="description"
                rows={3}
                defaultValue={editingDept?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-status">Durum</Label>
              <Select
                name="is_active"
                defaultValue={String(editingDept?.is_active ?? true)}
              >
                <SelectTrigger id="dept-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" form="dept-form" disabled={saveDept.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unitOpen} onOpenChange={setUnitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Birimi düzenle" : "Yeni birim"}</DialogTitle>
            <DialogDescription>Her birim bir departmana bağlı olmalıdır.</DialogDescription>
          </DialogHeader>
          <form
            id="unit-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const departmentId = String(f.get("department_id") ?? "");
              if (!departmentId) {
                toast.error("Departman seçin.");
                return;
              }
              saveUnit.mutate({
                ...(editingUnit ? { id: editingUnit.id } : {}),
                name: String(f.get("name")).trim(),
                code: String(f.get("code")).trim().toUpperCase(),
                description: String(f.get("description") ?? "").trim() || null,
                is_active: f.get("is_active") === "true",
                department_id: departmentId,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="unit-name">Birim adı</Label>
              <Input id="unit-name" name="name" required defaultValue={editingUnit?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-code">Kod</Label>
              <Input id="unit-code" name="code" required defaultValue={editingUnit?.code ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-dept">Departman</Label>
              <Select name="department_id" defaultValue={editingUnit?.department_id ?? ""}>
                <SelectTrigger id="unit-dept">
                  <SelectValue placeholder="Departman seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(departments.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-status">Durum</Label>
              <Select name="is_active" defaultValue={String(editingUnit?.is_active ?? true)}>
                <SelectTrigger id="unit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktif</SelectItem>
                  <SelectItem value="false">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" form="unit-form" disabled={saveUnit.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
