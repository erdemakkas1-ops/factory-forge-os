import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Factory, Pencil, Play } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/uretim-emirleri")({
  head: () => ({
    meta: [
      {
        title: "Üretim Emirleri | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Üretim emirlerini oluşturun ve takip edin.",
      },
    ],
  }),

  component: ProductionOrdersPage,
});

type ProductOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type RecipeOption = {
  id: string;
  product_id: string;
  code: string;
  name: string;
  version: number;
  output_quantity: number;
};

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type LocationOption = {
  id: string;
  warehouse_id: string;
  code: string;
};

type ProductionOrderStatus = "draft" | "planned" | "in_progress" | "completed" | "cancelled";

type ProductionPriority = "low" | "normal" | "high" | "urgent";

type ProductionOrderRow = {
  id: string;
  order_no: string;
  product_id: string;
  bill_of_material_id: string | null;

  planned_quantity: number;
  produced_quantity: number;

  status: ProductionOrderStatus;
  priority: ProductionPriority;

  planned_start_at: string | null;
  planned_end_at: string | null;

  output_warehouse_id: string | null;
  output_location_id: string | null;

  description: string | null;

  created_at: string;
};

type ProductionOrderFormValues = {
  id?: string;

  order_no: string;
  product_id: string;
  bill_of_material_id: string | null;

  planned_quantity: number;

  priority: ProductionPriority;

  planned_start_at: string | null;
  planned_end_at: string | null;

  output_warehouse_id: string | null;
  output_location_id: string | null;

  description: string | null;
};

const db = supabase as any;

function statusLabel(status: ProductionOrderStatus) {
  switch (status) {
    case "draft":
      return "Taslak";

    case "planned":
      return "Planlandı";

    case "in_progress":
      return "Üretimde";

    case "completed":
      return "Tamamlandı";

    case "cancelled":
      return "İptal";

    default:
      return status;
  }
}

function priorityLabel(priority: ProductionPriority) {
  switch (priority) {
    case "low":
      return "Düşük";

    case "normal":
      return "Normal";

    case "high":
      return "Yüksek";

    case "urgent":
      return "Acil";

    default:
      return priority;
  }
}

function StatusBadge({ status }: { status: ProductionOrderStatus }) {
  if (status === "completed") {
    return <Badge variant="outline">Tamamlandı</Badge>;
  }

  if (status === "in_progress") {
    return <Badge variant="secondary">Üretimde</Badge>;
  }

  if (status === "cancelled") {
    return <Badge variant="destructive">İptal</Badge>;
  }

  return <Badge variant="outline">{statusLabel(status)}</Badge>;
}

function ProductionOrdersPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingOrder, setEditingOrder] = useState<ProductionOrderRow | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  /*
   * =====================================================
   * ÜRÜNLER
   * =====================================================
   */

  const products = useQuery<ProductOption[]>({
    queryKey: ["production-order-products"],

    queryFn: async () => {
      const { data, error } = await db
        .from("products")
        .select(
          `
          id,
          code,
          name,
          unit
        `,
        )
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []) as ProductOption[];
    },
  });

  /*
   * =====================================================
   * REÇETELER
   * =====================================================
   */

  const recipes = useQuery<RecipeOption[]>({
    queryKey: ["production-order-recipes"],

    queryFn: async () => {
      const { data, error } = await db
        .from("bill_of_materials")
        .select(
          `
          id,
          product_id,
          code,
          name,
          version,
          output_quantity
        `,
        )
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []).map((item: any): RecipeOption => ({
        id: item.id,
        product_id: item.product_id,
        code: item.code,
        name: item.name,
        version: Number(item.version ?? 1),
        output_quantity: Number(item.output_quantity ?? 1),
      }));
    },
  });

  /*
   * =====================================================
   * DEPOLAR
   * =====================================================
   */

  const warehouses = useQuery<WarehouseOption[]>({
    queryKey: ["production-order-warehouses"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouses")
        .select(
          `
            id,
            code,
            name
          `,
        )
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
   * RAF / KONUM
   * =====================================================
   */

  const locations = useQuery<LocationOption[]>({
    queryKey: ["production-order-locations"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouse_locations")
        .select(
          `
            id,
            warehouse_id,
            code
          `,
        )
        .eq("is_active", true)
        .order("code");

      if (error) {
        throw error;
      }

      return (data ?? []) as LocationOption[];
    },
  });

  /*
   * =====================================================
   * ÜRETİM EMİRLERİ
   * =====================================================
   */

  const productionOrders = useQuery<ProductionOrderRow[]>({
    queryKey: ["production-orders"],

    queryFn: async () => {
      const { data, error } = await db
        .from("production_orders")
        .select(
          `
            id,
            order_no,
            product_id,
            bill_of_material_id,
            planned_quantity,
            produced_quantity,
            status,
            priority,
            planned_start_at,
            planned_end_at,
            output_warehouse_id,
            output_location_id,
            description,
            created_at
          `,
        )
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []).map((item: any): ProductionOrderRow => ({
        id: item.id,

        order_no: item.order_no,

        product_id: item.product_id,

        bill_of_material_id: item.bill_of_material_id ?? null,

        planned_quantity: Number(item.planned_quantity ?? 0),

        produced_quantity: Number(item.produced_quantity ?? 0),

        status: item.status as ProductionOrderStatus,

        priority: item.priority as ProductionPriority,

        planned_start_at: item.planned_start_at ?? null,

        planned_end_at: item.planned_end_at ?? null,

        output_warehouse_id: item.output_warehouse_id ?? null,

        output_location_id: item.output_location_id ?? null,

        description: item.description ?? null,

        created_at: item.created_at,
      }));
    },
  });

  /*
   * =====================================================
   * FİLTRELER
   * =====================================================
   */

  const filteredRecipes = useMemo(() => {
    if (!selectedProductId) {
      return recipes.data ?? [];
    }

    return (recipes.data ?? []).filter((recipe) => recipe.product_id === selectedProductId);
  }, [recipes.data, selectedProductId]);

  const filteredLocations = useMemo(() => {
    if (!selectedWarehouseId) {
      return [];
    }

    return (locations.data ?? []).filter(
      (location) => location.warehouse_id === selectedWarehouseId,
    );
  }, [locations.data, selectedWarehouseId]);

  /*
   * =====================================================
   * KAYDET
   * =====================================================
   */

  const saveOrder = useMutation({
    mutationFn: async (values: ProductionOrderFormValues) => {
      const payload = {
        order_no: values.order_no.trim().toUpperCase(),

        product_id: values.product_id,

        bill_of_material_id: values.bill_of_material_id,

        planned_quantity: values.planned_quantity,

        priority: values.priority,

        planned_start_at: values.planned_start_at,

        planned_end_at: values.planned_end_at,

        output_warehouse_id: values.output_warehouse_id,

        output_location_id: values.output_location_id,

        description: values.description?.trim() || null,
      };

      if (values.id) {
        const { error } = await db.from("production_orders").update(payload).eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "uretim_emirleri",
          recordId: values.id,
          newData: payload,
          description: `${payload.order_no} üretim emri güncellendi`,
        });

        return;
      }

      const { data, error } = await db
        .from("production_orders")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "uretim_emirleri",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.order_no} üretim emri oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Üretim emri kaydedildi.");

      setDialogOpen(false);
      setEditingOrder(null);

      void queryClient.invalidateQueries({
        queryKey: ["production-orders"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * ÜRETİMİ BAŞLAT
   * =====================================================
   */

  const startProduction = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await db.rpc("start_production_order", {
        p_order_id: orderId,
      });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      toast.success("Üretim başlatıldı. Hammaddeler stoktan düşüldü.");

      void queryClient.invalidateQueries({
        queryKey: ["production-orders"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["inventory-stock-list"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-movements"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-transfer-inventory"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-exit-inventory"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * ÜRETİMİ TAMAMLA
   * =====================================================
   */

  const completeProduction = useMutation({
    mutationFn: async (order: ProductionOrderRow) => {
      const { error } = await db.rpc("complete_production_order", {
        p_order_id: order.id,
        p_produced_quantity: order.planned_quantity,
      });

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      toast.success("Üretim tamamlandı. Mamul stoğa eklendi.");

      void queryClient.invalidateQueries({
        queryKey: ["production-orders"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["inventory-stock-list"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-movements"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-transfer-inventory"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-exit-inventory"],
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

  const productMap = new Map((products.data ?? []).map((product) => [product.id, product]));

  const recipeMap = new Map((recipes.data ?? []).map((recipe) => [recipe.id, recipe]));

  const warehouseMap = new Map(
    (warehouses.data ?? []).map((warehouse) => [warehouse.id, warehouse]),
  );

  const columns: Column<ProductionOrderRow>[] = [
    {
      id: "order_no",
      header: "Emir No",

      cell: (row) => <span className="font-mono text-sm">{row.order_no}</span>,

      value: (row) => row.order_no,

      sortable: true,
    },

    {
      id: "product",
      header: "Mamul",

      cell: (row) => {
        const product = productMap.get(row.product_id);

        return product ? `${product.code} - ${product.name}` : "—";
      },

      value: (row) => {
        const product = productMap.get(row.product_id);

        return product ? `${product.code} ${product.name}` : "";
      },

      sortable: true,
    },

    {
      id: "recipe",
      header: "Reçete",

      cell: (row) => {
        if (!row.bill_of_material_id) {
          return "—";
        }

        const recipe = recipeMap.get(row.bill_of_material_id);

        return recipe ? `${recipe.code} v${recipe.version}` : "—";
      },

      value: (row) => row.bill_of_material_id ?? "",
    },

    {
      id: "planned_quantity",
      header: "Planlanan",

      cell: (row) => {
        const product = productMap.get(row.product_id);

        return `${row.planned_quantity} ${product?.unit ?? ""}`;
      },

      value: (row) => row.planned_quantity,

      sortable: true,
    },

    {
      id: "produced_quantity",
      header: "Üretilen",

      cell: (row) => {
        const product = productMap.get(row.product_id);

        return `${row.produced_quantity} ${product?.unit ?? ""}`;
      },

      value: (row) => row.produced_quantity,

      sortable: true,
    },

    {
      id: "warehouse",
      header: "Hedef Depo",

      cell: (row) => {
        if (!row.output_warehouse_id) {
          return "—";
        }

        return warehouseMap.get(row.output_warehouse_id)?.name ?? "—";
      },

      value: (row) => row.output_warehouse_id ?? "",
    },

    {
      id: "priority",
      header: "Öncelik",

      cell: (row) => priorityLabel(row.priority),

      value: (row) => priorityLabel(row.priority),

      sortable: true,
    },

    {
      id: "status",
      header: "Durum",

      cell: (row) => <StatusBadge status={row.status} />,

      value: (row) => statusLabel(row.status),

      sortable: true,
    },

    {
      id: "actions",
      header: "",

      cell: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === "planned" ? (
            <Button
              variant="ghost"
              size="icon"
              title="Üretimi başlat"
              disabled={startProduction.isPending}
              onClick={() => {
                startProduction.mutate(row.id);
              }}
            >
              <Play className="size-4" />
            </Button>
          ) : null}

          {row.status === "in_progress" ? (
            <Button
              variant="ghost"
              size="icon"
              title="Üretimi tamamla"
              disabled={completeProduction.isPending}
              onClick={() => {
                completeProduction.mutate(row);
              }}
            >
              <CheckCircle2 className="size-4" />
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            title="Düzenle"
            onClick={() => {
              setEditingOrder(row);

              setSelectedProductId(row.product_id);

              setSelectedWarehouseId(row.output_warehouse_id ?? "");

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

  /*
   * =====================================================
   * SAYFA
   * =====================================================
   */

  if (
    products.isError ||
    recipes.isError ||
    warehouses.isError ||
    locations.isError ||
    productionOrders.isError
  ) {
    return (
      <>
        <PageHeader
          title="Üretim Emirleri"
          description="Üretim emirlerini oluşturun ve takip edin."
        />

        <ErrorState
          onRetry={() => {
            void products.refetch();
            void recipes.refetch();
            void warehouses.refetch();
            void locations.refetch();
            void productionOrders.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Üretim Emirleri"
        description="Planlanan üretimleri, reçeteleri ve üretim durumlarını yönetin."
      />

      <DataTable
        columns={columns}
        rows={productionOrders.data ?? []}
        rowKey={(row) => row.id}
        loading={productionOrders.isLoading || products.isLoading || recipes.isLoading}
        searchPlaceholder="Emir no, mamul veya durum ara..."
        mobileTitle={(row) => row.order_no}
        emptyTitle="Henüz üretim emri yok"
        emptyDescription="İlk üretim emrinizi oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingOrder(null);

              setSelectedProductId("");

              setSelectedWarehouseId("");

              setDialogOpen(true);
            }}
          >
            <Factory className="mr-2 size-4" />
            Yeni Üretim Emri
          </Button>
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingOrder(null);

            setSelectedProductId("");

            setSelectedWarehouseId("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOrder ? "Üretim emrini düzenle" : "Yeni üretim emri"}</DialogTitle>

            <DialogDescription>
              Mamul, reçete, miktar ve üretim hedefini belirleyin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="production-order-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const form = new FormData(event.currentTarget);

              const orderNo = String(form.get("order_no") ?? "").trim();

              const productId = String(form.get("product_id") ?? "");

              const recipeId = String(form.get("bill_of_material_id") ?? "");

              const quantity = Number(form.get("planned_quantity") ?? 0);

              const warehouseId = String(form.get("output_warehouse_id") ?? "");

              const locationId = String(form.get("output_location_id") ?? "");

              if (!orderNo) {
                toast.error("Üretim emir numarası zorunludur.");

                return;
              }

              if (!productId) {
                toast.error("Mamul seçmelisiniz.");

                return;
              }

              if (!recipeId) {
                toast.error("Reçete seçmelisiniz.");

                return;
              }

              if (!Number.isFinite(quantity) || quantity <= 0) {
                toast.error("Planlanan miktar sıfırdan büyük olmalıdır.");

                return;
              }

              if (!warehouseId) {
                toast.error("Hedef depo seçmelisiniz.");

                return;
              }

              saveOrder.mutate({
                ...(editingOrder
                  ? {
                      id: editingOrder.id,
                    }
                  : {}),

                order_no: orderNo,

                product_id: productId,

                bill_of_material_id: recipeId || null,

                planned_quantity: quantity,

                priority: String(form.get("priority") ?? "normal") as ProductionPriority,

                planned_start_at: String(form.get("planned_start_at") ?? "") || null,

                planned_end_at: String(form.get("planned_end_at") ?? "") || null,

                output_warehouse_id: warehouseId || null,

                output_location_id: locationId || null,

                description: String(form.get("description") ?? "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="production-order-no">Emir No</Label>

              <Input
                id="production-order-no"
                name="order_no"
                required
                placeholder="Örn. URT-2026-001"
                defaultValue={editingOrder?.order_no ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Öncelik</Label>

              <Select name="priority" defaultValue={editingOrder?.priority ?? "normal"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="low">Düşük</SelectItem>

                  <SelectItem value="normal">Normal</SelectItem>

                  <SelectItem value="high">Yüksek</SelectItem>

                  <SelectItem value="urgent">Acil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Mamul</Label>

              <Select
                name="product_id"
                defaultValue={editingOrder?.product_id ?? ""}
                onValueChange={(value) => {
                  setSelectedProductId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Üretilecek mamulü seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(products.data ?? []).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.code} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Reçete</Label>

              <Select
                name="bill_of_material_id"
                defaultValue={editingOrder?.bill_of_material_id ?? ""}
                disabled={!selectedProductId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={selectedProductId ? "Reçete seçin" : "Önce mamul seçin"}
                  />
                </SelectTrigger>

                <SelectContent>
                  {filteredRecipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.code} - {recipe.name} (v{recipe.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Planlanan Miktar</Label>

              <Input
                name="planned_quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                defaultValue={editingOrder?.planned_quantity ?? 1}
              />
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>

              <Input
                value={statusLabel(editingOrder?.status ?? "draft")}
                disabled
                readOnly
                aria-label="Üretim emri durumu"
              />
            </div>

            <div className="space-y-2">
              <Label>Planlanan Başlangıç</Label>

              <Input name="planned_start_at" type="datetime-local" />
            </div>

            <div className="space-y-2">
              <Label>Planlanan Bitiş</Label>

              <Input name="planned_end_at" type="datetime-local" />
            </div>

            <div className="space-y-2">
              <Label>Hedef Depo</Label>

              <Select
                name="output_warehouse_id"
                defaultValue={editingOrder?.output_warehouse_id ?? ""}
                onValueChange={(value) => {
                  setSelectedWarehouseId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Depo seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} - {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hedef Raf</Label>

              <Select
                name="output_location_id"
                defaultValue={editingOrder?.output_location_id ?? ""}
                disabled={!selectedWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={selectedWarehouseId ? "Raf seçin (opsiyonel)" : "Önce depo seçin"}
                  />
                </SelectTrigger>

                <SelectContent>
                  {filteredLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Açıklama</Label>

              <Textarea
                name="description"
                rows={3}
                placeholder="Üretim emri hakkında açıklama..."
                defaultValue={editingOrder?.description ?? ""}
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

            <Button type="submit" form="production-order-form" disabled={saveOrder.isPending}>
              {saveOrder.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
