import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil } from "lucide-react";
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

import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/depo-konumlari")({
  head: () => ({
    meta: [
      {
        title: "Depo Konumları | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Depo raf ve konumlarını yönetin.",
      },
    ],
  }),

  component: WarehouseLocationsPage,
});

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type WarehouseLocationRow = {
  id: string;
  warehouse_id: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

type WarehouseLocationFormValues = {
  id?: string;
  warehouse_id: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

const db = supabase as any;

function WarehouseLocationsPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingLocation, setEditingLocation] =
    useState<WarehouseLocationRow | null>(null);

  /*
   * =====================================================
   * DEPOLAR
   * =====================================================
   */

  const warehouses = useQuery<WarehouseOption[]>({
    queryKey: ["warehouse-location-warehouses"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouses")
        .select(`
          id,
          code,
          name
        `)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []) as WarehouseOption[];
    },
  });

  /*
   * =====================================================
   * KONUM / RAF LİSTESİ
   * =====================================================
   */

  const locations = useQuery<WarehouseLocationRow[]>({
    queryKey: ["warehouse-locations"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouse_locations")
        .select(`
          id,
          warehouse_id,
          code,
          description,
          is_active
        `)
        .order("code");

      if (error) {
        throw error;
      }

      return (data ?? []) as WarehouseLocationRow[];
    },
  });

  const warehouseNameById = new Map(
    (warehouses.data ?? []).map((warehouse) => [
      warehouse.id,
      `${warehouse.code} - ${warehouse.name}`,
    ]),
  );

  /*
   * =====================================================
   * KAYDET / GÜNCELLE
   * =====================================================
   */

  const saveLocation = useMutation({
    mutationFn: async (
      values: WarehouseLocationFormValues,
    ) => {
      const payload = {
        warehouse_id:
          values.warehouse_id,

        code:
          values.code
            .trim()
            .toUpperCase(),

        description:
          values.description?.trim() ||
          null,

        is_active:
          values.is_active,
      };

      if (values.id) {
        const { error } = await db
          .from("warehouse_locations")
          .update(payload)
          .eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "depo_konumlari",
          recordId: values.id,
          newData: payload,
          description: `${payload.code} depo konumu güncellendi`,
        });

        return;
      }

      const { data, error } = await db
        .from("warehouse_locations")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "depo_konumlari",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.code} depo konumu oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success(
        "Depo konumu kaydedildi.",
      );

      setDialogOpen(false);
      setEditingLocation(null);

      void queryClient.invalidateQueries({
        queryKey: ["warehouse-locations"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-entry-locations"],
      });
    },

    onError: (error) => {
      toast.error(
        friendlyError(error),
      );
    },
  });

  /*
   * =====================================================
   * TABLO
   * =====================================================
   */

  const columns: Column<WarehouseLocationRow>[] = [
    {
      id: "warehouse",
      header: "Depo",

      cell: (row) =>
        warehouseNameById.get(
          row.warehouse_id,
        ) ?? "—",

      value: (row) =>
        warehouseNameById.get(
          row.warehouse_id,
        ) ?? "",

      sortable: true,
    },

    {
      id: "code",
      header: "Raf / Konum Kodu",

      cell: (row) => (
        <span className="font-mono text-sm">
          {row.code}
        </span>
      ),

      value: (row) =>
        row.code,

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

    {
      id: "actions",
      header: "",

      cell: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Konumu düzenle"
            onClick={() => {
              setEditingLocation(
                row,
              );

              setDialogOpen(
                true,
              );
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),

      className: "text-right",
    },
  ];

  /*
   * =====================================================
   * SAYFA
   * =====================================================
   */

  return (
    <>
      <PageHeader
        title="Depo Konumları"
        description="Depolar için raf, koridor ve stok konumları oluşturun."
      />

      {locations.isError ||
      warehouses.isError ? (
        <ErrorState
          onRetry={() => {
            void locations.refetch();
            void warehouses.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={
            locations.data ?? []
          }
          rowKey={(row) =>
            row.id
          }
          loading={
            locations.isLoading ||
            warehouses.isLoading
          }
          searchPlaceholder="Depo, raf kodu veya açıklama ara..."
          mobileTitle={(row) =>
            row.code
          }
          emptyTitle="Henüz depo konumu yok"
          emptyDescription="İlk raf veya depo konumunuzu oluşturarak başlayın."
          toolbar={
            <Button
              onClick={() => {
                setEditingLocation(
                  null,
                );

                setDialogOpen(
                  true,
                );
              }}
            >
              <MapPin className="mr-2 size-4" />

              Yeni Konum
            </Button>
          }
        />
      )}

      {/*
       * =================================================
       * FORM
       * =================================================
       */}

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
            setEditingLocation(
              null,
            );
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLocation
                ? "Depo konumunu düzenle"
                : "Yeni depo konumu"}
            </DialogTitle>

            <DialogDescription>
              Raf, koridor veya stok alanı bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="warehouse-location-form"
            className="space-y-4"
            onSubmit={(
              event,
            ) => {
              event.preventDefault();

              const form =
                new FormData(
                  event.currentTarget,
                );

              const warehouseId =
                String(
                  form.get(
                    "warehouse_id",
                  ) ?? "",
                );

              const code =
                String(
                  form.get(
                    "code",
                  ) ?? "",
                ).trim();

              if (!warehouseId) {
                toast.error(
                  "Depo seçmelisiniz.",
                );

                return;
              }

              if (!code) {
                toast.error(
                  "Raf / konum kodu zorunludur.",
                );

                return;
              }

              saveLocation.mutate({
                ...(editingLocation
                  ? {
                      id:
                        editingLocation.id,
                    }
                  : {}),

                warehouse_id:
                  warehouseId,

                code,

                description:
                  String(
                    form.get(
                      "description",
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
              <Label htmlFor="location-warehouse">
                Depo
              </Label>

              <Select
                name="warehouse_id"
                defaultValue={
                  editingLocation?.warehouse_id ??
                  ""
                }
              >
                <SelectTrigger id="location-warehouse">
                  <SelectValue placeholder="Depo seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(warehouses.data ?? []).map(
                    (warehouse) => (
                      <SelectItem
                        key={
                          warehouse.id
                        }
                        value={
                          warehouse.id
                        }
                      >
                        {warehouse.code} - {warehouse.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-code">
                Raf / Konum Kodu
              </Label>

              <Input
                id="location-code"
                name="code"
                required
                placeholder="Örn. A-01"
                defaultValue={
                  editingLocation?.code ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location-status">
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={String(
                  editingLocation?.is_active ??
                    true,
                )}
              >
                <SelectTrigger id="location-status">
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

            <div className="space-y-2">
              <Label htmlFor="location-description">
                Açıklama
              </Label>

              <Textarea
                id="location-description"
                name="description"
                rows={3}
                placeholder="Örn. A koridoru, üst raf..."
                defaultValue={
                  editingLocation?.description ??
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
              form="warehouse-location-form"
              disabled={
                saveLocation.isPending
              }
            >
              {saveLocation.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}