import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Warehouse, Pencil } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/depolar")({
  head: () => ({
    meta: [
      {
        title: "Depolar | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Fabrika depo ve stok alanlarını yönetin.",
      },
    ],
  }),

  component: WarehousesPage,
});

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  location_description: string | null;
  manager_id: string | null;
  is_active: boolean;
};

type ProfileOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type WarehouseFormValues = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  location_description: string | null;
  manager_id: string | null;
  is_active: boolean;
};

// Lovable Cloud tarafındaki Faz 2 tabloları henüz yerel
// Supabase types.ts içine işlenmediği için geçici olarak any kullanıyoruz.
const db = supabase as any;

function WarehousesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const canCreate =
    hasPermission("warehouses.create") ||
    hasPermission("stock.manage");

  const canUpdate =
    hasPermission("warehouses.update") ||
    hasPermission("stock.manage");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseRow | null>(null);

  /*
   * =====================================================
   * DEPOLAR
   * =====================================================
   */

  const warehouses = useQuery<WarehouseRow[]>({
    queryKey: ["warehouses"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouses")
        .select(`
          id,
          code,
          name,
          description,
          location_description,
          manager_id,
          is_active
        `)
        .is("deleted_at", null)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []) as WarehouseRow[];
    },
  });

  /*
   * =====================================================
   * PERSONEL / DEPO SORUMLUSU SEÇENEKLERİ
   * =====================================================
   */

  const profiles = useQuery<ProfileOption[]>({
    queryKey: ["warehouse-manager-options"],

    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name
        `)
        .eq("is_active", true)
        .order("first_name");

      if (error) {
        throw error;
      }

      return (data ?? []) as ProfileOption[];
    },
  });

  const managerNameById = new Map(
    (profiles.data ?? []).map((profile) => [
      profile.id,
      `${profile.first_name} ${profile.last_name}`.trim(),
    ]),
  );

  /*
   * =====================================================
   * KAYDET / GÜNCELLE
   * =====================================================
   */

  const saveWarehouse = useMutation({
    mutationFn: async (values: WarehouseFormValues) => {
      const payload = {
        code: values.code.trim().toUpperCase(),

        name: values.name.trim(),

        description:
          values.description?.trim() || null,

        location_description:
          values.location_description?.trim() || null,

        manager_id:
          values.manager_id && values.manager_id.length > 0
            ? values.manager_id
            : null,

        is_active:
          values.is_active,
      };

      /*
       * GÜNCELLEME
       */

      if (values.id) {
        const { error } = await db
          .from("warehouses")
          .update(payload)
          .eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "depolar",
          recordId: values.id,
          newData: payload,
          description: `${payload.name} deposu güncellendi`,
        });

        return;
      }

      /*
       * YENİ DEPO
       */

      const { data, error } = await db
        .from("warehouses")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "depolar",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.name} deposu oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Depo kaydedildi.");

      setDialogOpen(false);
      setEditingWarehouse(null);

      void queryClient.invalidateQueries({
        queryKey: ["warehouses"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * TABLO
   * =====================================================
   */

  const columns: Column<WarehouseRow>[] = [
    {
      id: "code",
      header: "Depo Kodu",

      cell: (row) => (
        <span className="font-mono text-sm">
          {row.code}
        </span>
      ),

      value: (row) => row.code,
      sortable: true,
    },

    {
      id: "name",
      header: "Depo",

      cell: (row) => (
        <div>
          <div className="font-medium">
            {row.name}
          </div>

          {row.location_description ? (
            <div className="text-xs text-muted-foreground">
              {row.location_description}
            </div>
          ) : null}
        </div>
      ),

      value: (row) => row.name,
      sortable: true,
    },

    {
      id: "manager",
      header: "Sorumlu",

      cell: (row) =>
        row.manager_id
          ? managerNameById.get(row.manager_id) ?? "—"
          : "—",

      value: (row) =>
        row.manager_id
          ? managerNameById.get(row.manager_id) ?? ""
          : "",
    },

    {
      id: "description",
      header: "Açıklama",

      cell: (row) =>
        row.description || "—",

      value: (row) =>
        row.description ?? "",
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

    ...(canUpdate
      ? [
          {
            id: "actions",
            header: "",

            cell: (row: WarehouseRow) => (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Depoyu düzenle"
                  onClick={() => {
                    setEditingWarehouse(row);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            ),

            className: "text-right",
          } satisfies Column<WarehouseRow>,
        ]
      : []),
  ];

  /*
   * =====================================================
   * SAYFA
   * =====================================================
   */

  return (
    <>
      <PageHeader
        title="Depolar"
        description="Ana depo, hammadde deposu ve diğer stok alanlarını yönetin."
      />

      {warehouses.isError || profiles.isError ? (
        <ErrorState
          onRetry={() => {
            void warehouses.refetch();
            void profiles.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={warehouses.data ?? []}
          rowKey={(row) => row.id}
          loading={
            warehouses.isLoading ||
            profiles.isLoading
          }
          searchPlaceholder="Depo adı veya kodu ara..."
          mobileTitle={(row) => row.name}
          emptyTitle="Henüz depo yok"
          emptyDescription="İlk deponuzu oluşturarak stok yapısını kurmaya başlayın."
          toolbar={
            canCreate ? (
              <Button
                onClick={() => {
                  setEditingWarehouse(null);
                  setDialogOpen(true);
                }}
              >
                <Warehouse className="mr-2 size-4" />
                Yeni Depo
              </Button>
            ) : undefined
          }
        />
      )}

      {/*
       * =================================================
       * DEPO FORMU
       * =================================================
       */}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingWarehouse(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingWarehouse
                ? "Depoyu düzenle"
                : "Yeni depo"}
            </DialogTitle>

            <DialogDescription>
              Depo bilgilerini ve sorumlu personeli belirleyin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="warehouse-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const form = new FormData(
                event.currentTarget,
              );

              const name = String(
                form.get("name") ?? "",
              ).trim();

              const code = String(
                form.get("code") ?? "",
              ).trim();

              if (!name) {
                toast.error(
                  "Depo adı zorunludur.",
                );
                return;
              }

              if (!code) {
                toast.error(
                  "Depo kodu zorunludur.",
                );
                return;
              }

              saveWarehouse.mutate({
                ...(editingWarehouse
                  ? {
                      id:
                        editingWarehouse.id,
                    }
                  : {}),

                name,

                code,

                description:
                  String(
                    form.get(
                      "description",
                    ) ?? "",
                  ) || null,

                location_description:
                  String(
                    form.get(
                      "location_description",
                    ) ?? "",
                  ) || null,

                manager_id:
                  String(
                    form.get(
                      "manager_id",
                    ) ?? "",
                  ) || null,

                is_active:
                  String(
                    form.get(
                      "is_active",
                    ) ?? "true",
                  ) === "true",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="warehouse-name">
                Depo adı
              </Label>

              <Input
                id="warehouse-name"
                name="name"
                required
                placeholder="Örn. Ana Depo"
                defaultValue={
                  editingWarehouse?.name ?? ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse-code">
                Depo kodu
              </Label>

              <Input
                id="warehouse-code"
                name="code"
                required
                placeholder="Örn. DEP-001"
                defaultValue={
                  editingWarehouse?.code ?? ""
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-location">
                Konum
              </Label>

              <Input
                id="warehouse-location"
                name="location_description"
                placeholder="Örn. Fabrika A Blok - Giriş Kat"
                defaultValue={
                  editingWarehouse?.location_description ?? ""
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="warehouse-manager">
                Depo sorumlusu
              </Label>

              <Select
                name="manager_id"
                defaultValue={
                  editingWarehouse?.manager_id ?? ""
                }
              >
                <SelectTrigger id="warehouse-manager">
                  <SelectValue placeholder="Sorumlu personel seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(profiles.data ?? []).map(
                    (profile) => (
                      <SelectItem
                        key={profile.id}
                        value={profile.id}
                      >
                        {profile.first_name} {profile.last_name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse-status">
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={String(
                  editingWarehouse?.is_active ??
                    true,
                )}
              >
                <SelectTrigger id="warehouse-status">
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
              <Label htmlFor="warehouse-description">
                Açıklama
              </Label>

              <Textarea
                id="warehouse-description"
                name="description"
                rows={3}
                placeholder="Depo hakkında açıklama..."
                defaultValue={
                  editingWarehouse?.description ?? ""
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
              form="warehouse-form"
              disabled={saveWarehouse.isPending}
            >
              {saveWarehouse.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}