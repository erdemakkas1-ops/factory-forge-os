import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/satinalma-siparisleri")({
  head: () => ({
    meta: [
      {
        title: "Satın Alma Siparişleri | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Satın alma siparişlerini ve sipariş kalemlerini yönetin.",
      },
    ],
  }),

  component: PurchaseOrdersPage,
});

type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

type ProductOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type PurchaseOrderStatus = "draft" | "approved" | "ordered" | "partial" | "received" | "cancelled";

type PurchaseOrderRow = {
  id: string;
  order_no: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_date: string | null;
  currency: string;
  description: string | null;
  created_at: string;
};

type PurchaseOrderFormValues = {
  id?: string;
  order_no: string;
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  currency: string;
  description: string | null;
};

type PurchaseOrderItemRow = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_price: number;
  tax_percentage: number;
  description: string | null;
};

type PurchaseOrderItemFormValues = {
  purchase_order_id: string;
  product_id: string;
  ordered_quantity: number;
  unit_price: number;
  tax_percentage: number;
  description: string | null;
};

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type WarehouseLocationOption = {
  id: string;
  warehouse_id: string;
  code: string;
};

type ReceivePurchaseItemValues = {
  purchase_order_item_id: string;
  quantity: number;
  warehouse_id: string;
  location_id: string | null;
  description: string | null;
};

const db = supabase as any;

function statusLabel(status: PurchaseOrderStatus) {
  switch (status) {
    case "draft":
      return "Taslak";

    case "approved":
      return "Onaylandı";

    case "ordered":
      return "Sipariş Verildi";

    case "partial":
      return "Kısmi Teslim";

    case "received":
      return "Teslim Alındı";

    case "cancelled":
      return "İptal";

    default:
      return status;
  }
}

function statusVariant(
  status: PurchaseOrderStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "received":
      return "default";

    case "ordered":
    case "approved":
    case "partial":
      return "secondary";

    case "cancelled":
      return "destructive";

    default:
      return "outline";
  }
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function PurchaseOrdersPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingOrder, setEditingOrder] = useState<PurchaseOrderRow | null>(null);

  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRow | null>(null);

  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  const [selectedReceiveItem, setSelectedReceiveItem] = useState<PurchaseOrderItemRow | null>(null);

  const [selectedReceiveWarehouseId, setSelectedReceiveWarehouseId] = useState("");

  /*
   * =====================================================
   * TEDARİKÇİLER
   * =====================================================
   */

  const suppliers = useQuery<SupplierOption[]>({
    queryKey: ["purchase-order-suppliers"],

    queryFn: async () => {
      const { data, error } = await db
        .from("suppliers")
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

      return (data ?? []) as SupplierOption[];
    },
  });

  /*
   * =====================================================
   * ÜRÜNLER
   * =====================================================
   */

  const products = useQuery<ProductOption[]>({
    queryKey: ["purchase-order-products"],

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
   * MAL KABUL DEPOLARI / RAFLARI
   * =====================================================
   */

  const warehouses = useQuery<WarehouseOption[]>({
    queryKey: ["purchase-receipt-warehouses"],

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

  const warehouseLocations = useQuery<WarehouseLocationOption[]>({
    queryKey: ["purchase-receipt-locations"],

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

      return (data ?? []) as WarehouseLocationOption[];
    },
  });

  const filteredReceiveLocations = (warehouseLocations.data ?? []).filter(
    (location) => location.warehouse_id === selectedReceiveWarehouseId,
  );

  /*
   * =====================================================
   * SATIN ALMA SİPARİŞLERİ
   * =====================================================
   */

  const purchaseOrders = useQuery<PurchaseOrderRow[]>({
    queryKey: ["purchase-orders"],

    queryFn: async () => {
      const { data, error } = await db
        .from("purchase_orders")
        .select(
          `
              id,
              order_no,
              supplier_id,
              status,
              order_date,
              expected_date,
              currency,
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

      return (data ?? []).map((item: any): PurchaseOrderRow => ({
        id: item.id,

        order_no: item.order_no,

        supplier_id: item.supplier_id,

        status: item.status as PurchaseOrderStatus,

        order_date: item.order_date,

        expected_date: item.expected_date ?? null,

        currency: item.currency ?? "TRY",

        description: item.description ?? null,

        created_at: item.created_at,
      }));
    },
  });

  /*
   * =====================================================
   * SİPARİŞ KALEMLERİ
   * =====================================================
   */

  const orderItems = useQuery<PurchaseOrderItemRow[]>({
    queryKey: ["purchase-order-items", selectedOrder?.id],

    enabled: Boolean(selectedOrder?.id),

    queryFn: async () => {
      if (!selectedOrder?.id) {
        return [];
      }

      const { data, error } = await db
        .from("purchase_order_items")
        .select(
          `
              id,
              purchase_order_id,
              product_id,
              ordered_quantity,
              received_quantity,
              unit_price,
              tax_percentage,
              description
            `,
        )
        .eq("purchase_order_id", selectedOrder.id)
        .order("created_at");

      if (error) {
        throw error;
      }

      return (data ?? []).map((item: any): PurchaseOrderItemRow => ({
        id: item.id,

        purchase_order_id: item.purchase_order_id,

        product_id: item.product_id,

        ordered_quantity: Number(item.ordered_quantity ?? 0),

        received_quantity: Number(item.received_quantity ?? 0),

        unit_price: Number(item.unit_price ?? 0),

        tax_percentage: Number(item.tax_percentage ?? 0),

        description: item.description ?? null,
      }));
    },
  });

  /*
   * =====================================================
   * SİPARİŞ KAYDET / GÜNCELLE
   * =====================================================
   */

  const saveOrder = useMutation({
    mutationFn: async (values: PurchaseOrderFormValues) => {
      const payload = {
        order_no: values.order_no.trim().toUpperCase(),

        supplier_id: values.supplier_id,

        order_date: values.order_date,

        expected_date: values.expected_date,

        currency: values.currency,

        description: values.description?.trim() || null,
      };

      if (values.id) {
        const { error } = await db.from("purchase_orders").update(payload).eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "satinalma_siparisleri",
          recordId: values.id,
          newData: payload,
          description: `${payload.order_no} satın alma siparişi güncellendi`,
        });

        return;
      }

      const { data, error } = await db
        .from("purchase_orders")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "satinalma_siparisleri",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.order_no} satın alma siparişi oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Satın alma siparişi kaydedildi.");

      setDialogOpen(false);
      setEditingOrder(null);

      void queryClient.invalidateQueries({
        queryKey: ["purchase-orders"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * SİPARİŞ KALEMİ EKLE
   * =====================================================
   */

  const saveOrderItem = useMutation({
    mutationFn: async (values: PurchaseOrderItemFormValues) => {
      const payload = {
        purchase_order_id: values.purchase_order_id,

        product_id: values.product_id,

        ordered_quantity: values.ordered_quantity,

        unit_price: values.unit_price,

        tax_percentage: values.tax_percentage,

        description: values.description?.trim() || null,
      };

      const { data, error } = await db
        .from("purchase_order_items")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "satinalma_siparisleri",
        recordId: String(data.id),
        newData: payload,
        description: "Satın alma siparişine kalem eklendi",
      });
    },

    onSuccess: () => {
      toast.success("Sipariş kalemi eklendi.");

      void queryClient.invalidateQueries({
        queryKey: ["purchase-order-items", selectedOrder?.id],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * MAL KABUL
   * =====================================================
   */

  const receivePurchaseItem = useMutation({
    mutationFn: async (values: ReceivePurchaseItemValues) => {
      const { data, error } = await db.rpc("receive_purchase_item", {
        p_purchase_order_item_id: values.purchase_order_item_id,

        p_quantity: values.quantity,

        p_warehouse_id: values.warehouse_id,

        p_location_id: values.location_id,

        p_description: values.description,
      });

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: () => {
      toast.success("Mal kabul başarıyla tamamlandı.");

      setReceiveDialogOpen(false);
      setSelectedReceiveItem(null);
      setSelectedReceiveWarehouseId("");

      void queryClient.invalidateQueries({
        queryKey: ["purchase-order-items", selectedOrder?.id],
      });

      void queryClient.invalidateQueries({
        queryKey: ["purchase-orders"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["inventory-stock-list"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-movements"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-exit-inventory"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-transfer-inventory"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * SİPARİŞ KALEMİ SİL
   * =====================================================
   */

  const deleteOrderItem = useMutation({
    mutationFn: async (item: PurchaseOrderItemRow) => {
      if (item.received_quantity > 0) {
        throw new Error("Teslim alınmış sipariş kalemi silinemez.");
      }

      const { error } = await db.from("purchase_order_items").delete().eq("id", item.id);

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "delete",
        module: "satinalma_siparisleri",
        recordId: item.id,
        description: "Satın alma sipariş kalemi silindi",
      });
    },

    onSuccess: () => {
      toast.success("Sipariş kalemi silindi.");

      void queryClient.invalidateQueries({
        queryKey: ["purchase-order-items", selectedOrder?.id],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * SİPARİŞ İPTAL
   * =====================================================
   */

  const deleteOrder = useMutation({
    mutationFn: async (order: PurchaseOrderRow) => {
      const { error } = await db.rpc("cancel_purchase_order", {
        p_order_id: order.id,
      });

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "update",
        module: "satinalma_siparisleri",
        recordId: order.id,
        description: `${order.order_no} satın alma siparişi iptal edildi`,
      });
    },

    onSuccess: () => {
      toast.success("Satın alma siparişi iptal edildi.");

      void queryClient.invalidateQueries({
        queryKey: ["purchase-orders"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * MAPLER
   * =====================================================
   */

  const supplierMap = new Map((suppliers.data ?? []).map((supplier) => [supplier.id, supplier]));

  const productMap = new Map((products.data ?? []).map((product) => [product.id, product]));

  /*
   * =====================================================
   * SİPARİŞ TOPLAMLARI
   * =====================================================
   */

  const orderSubtotal = useMemo(() => {
    return (orderItems.data ?? []).reduce(
      (total, item) => total + item.ordered_quantity * item.unit_price,
      0,
    );
  }, [orderItems.data]);

  const orderTax = useMemo(() => {
    return (orderItems.data ?? []).reduce((total, item) => {
      const base = item.ordered_quantity * item.unit_price;

      return total + base * (item.tax_percentage / 100);
    }, 0);
  }, [orderItems.data]);

  const orderGrandTotal = orderSubtotal + orderTax;

  /*
   * =====================================================
   * TABLO
   * =====================================================
   */

  const columns: Column<PurchaseOrderRow>[] = [
    {
      id: "order_no",
      header: "Sipariş No",

      cell: (row) => <span className="font-mono text-sm">{row.order_no}</span>,

      value: (row) => row.order_no,

      sortable: true,
    },

    {
      id: "supplier",
      header: "Tedarikçi",

      cell: (row) => {
        const supplier = supplierMap.get(row.supplier_id);

        return supplier ? `${supplier.code} - ${supplier.name}` : "—";
      },

      value: (row) => {
        const supplier = supplierMap.get(row.supplier_id);

        return supplier ? `${supplier.code} ${supplier.name}` : "";
      },

      sortable: true,
    },

    {
      id: "order_date",
      header: "Sipariş Tarihi",

      cell: (row) => row.order_date,

      value: (row) => row.order_date,

      sortable: true,
    },

    {
      id: "expected_date",
      header: "Beklenen Teslim",

      cell: (row) => row.expected_date ?? "—",

      value: (row) => row.expected_date ?? "",

      sortable: true,
    },

    {
      id: "currency",
      header: "Para Birimi",

      cell: (row) => row.currency,

      value: (row) => row.currency,
    },

    {
      id: "status",
      header: "Durum",

      cell: (row) => <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>,

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
            title="Sipariş kalemleri"
            onClick={() => {
              setSelectedOrder(row);

              setItemsDialogOpen(true);
            }}
          >
            <ClipboardList className="size-4" />
          </Button>

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

          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="İptal et"
            disabled={
              deleteOrder.isPending || row.status === "partial" || row.status === "received"
            }
            onClick={() => {
              if (
                window.confirm(`${row.order_no} siparişini iptal etmek istediğinize emin misiniz?`)
              ) {
                deleteOrder.mutate(row);
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

  /*
   * =====================================================
   * HATA DURUMU
   * =====================================================
   */

  if (
    suppliers.isError ||
    products.isError ||
    purchaseOrders.isError ||
    warehouses.isError ||
    warehouseLocations.isError
  ) {
    return (
      <>
        <PageHeader
          title="Satın Alma Siparişleri"
          description="Satın alma siparişlerini yönetin."
        />

        <ErrorState
          onRetry={() => {
            void suppliers.refetch();
            void products.refetch();
            void purchaseOrders.refetch();
            void warehouses.refetch();
            void warehouseLocations.refetch();
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
        title="Satın Alma Siparişleri"
        description="Tedarikçilerden verilecek ürün ve hammadde siparişlerini yönetin."
      />

      <DataTable
        columns={columns}
        rows={purchaseOrders.data ?? []}
        rowKey={(row) => row.id}
        loading={purchaseOrders.isLoading || suppliers.isLoading || products.isLoading}
        searchPlaceholder="Sipariş no, tedarikçi veya durum ara..."
        mobileTitle={(row) => row.order_no}
        emptyTitle="Henüz satın alma siparişi yok"
        emptyDescription="İlk satın alma siparişinizi oluşturarak başlayın."
        toolbar={
          <Button
            onClick={() => {
              setEditingOrder(null);

              setDialogOpen(true);
            }}
          >
            <ShoppingCart className="mr-2 size-4" />
            Yeni Sipariş
          </Button>
        }
      />

      {/* =====================================================
          SİPARİŞ FORMU
          ===================================================== */}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingOrder(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? "Satın alma siparişini düzenle" : "Yeni satın alma siparişi"}
            </DialogTitle>

            <DialogDescription>Tedarikçi, tarih ve sipariş durumunu belirleyin.</DialogDescription>
          </DialogHeader>

          <form
            id="purchase-order-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const form = new FormData(event.currentTarget);

              const orderNo = String(form.get("order_no") ?? "").trim();

              const supplierId = String(form.get("supplier_id") ?? "");

              const orderDate = String(form.get("order_date") ?? "");

              const expectedDate = String(form.get("expected_date") ?? "");

              const currency = String(form.get("currency") ?? "TRY");

              if (!orderNo) {
                toast.error("Sipariş numarası zorunludur.");

                return;
              }

              if (!supplierId) {
                toast.error("Tedarikçi seçmelisiniz.");

                return;
              }

              if (!orderDate) {
                toast.error("Sipariş tarihi zorunludur.");

                return;
              }

              saveOrder.mutate({
                ...(editingOrder
                  ? {
                      id: editingOrder.id,
                    }
                  : {}),

                order_no: orderNo,

                supplier_id: supplierId,

                order_date: orderDate,

                expected_date: expectedDate || null,

                currency: currency || "TRY",

                description: String(form.get("description") ?? "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label>Sipariş No</Label>

              <Input
                name="order_no"
                required
                placeholder="Örn. SAT-2026-001"
                defaultValue={editingOrder?.order_no ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>

              <Input
                value={statusLabel(editingOrder?.status ?? "draft")}
                disabled
                readOnly
                aria-label="Satın alma siparişi durumu"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Tedarikçi</Label>

              <Select name="supplier_id" defaultValue={editingOrder?.supplier_id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Tedarikçi seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(suppliers.data ?? []).map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.code} - {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sipariş Tarihi</Label>

              <Input
                name="order_date"
                type="date"
                required
                defaultValue={editingOrder?.order_date ?? new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div className="space-y-2">
              <Label>Beklenen Teslim</Label>

              <Input
                name="expected_date"
                type="date"
                defaultValue={editingOrder?.expected_date ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Para Birimi</Label>

              <Select name="currency" defaultValue={editingOrder?.currency ?? "TRY"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>

                  <SelectItem value="USD">USD</SelectItem>

                  <SelectItem value="EUR">EUR</SelectItem>

                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Açıklama</Label>

              <Textarea
                name="description"
                rows={3}
                placeholder="Sipariş hakkında açıklama..."
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

            <Button type="submit" form="purchase-order-form" disabled={saveOrder.isPending}>
              {saveOrder.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          SİPARİŞ KALEMLERİ
          ===================================================== */}

      <Dialog
        open={itemsDialogOpen}
        onOpenChange={(open) => {
          setItemsDialogOpen(open);

          if (!open) {
            setSelectedOrder(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Sipariş Kalemleri</DialogTitle>

            <DialogDescription>
              {selectedOrder
                ? `${selectedOrder.order_no} - ${
                    supplierMap.get(selectedOrder.supplier_id)?.name ?? ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();

              if (!selectedOrder) {
                return;
              }

              const formElement = event.currentTarget;

              const form = new FormData(formElement);

              const productId = String(form.get("product_id") ?? "");

              const quantity = Number(form.get("ordered_quantity") ?? 0);

              const unitPrice = Number(form.get("unit_price") ?? 0);

              const taxPercentage = Number(form.get("tax_percentage") ?? 0);

              if (!productId) {
                toast.error("Ürün seçmelisiniz.");

                return;
              }

              if (!Number.isFinite(quantity) || quantity <= 0) {
                toast.error("Miktar sıfırdan büyük olmalıdır.");

                return;
              }

              if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                toast.error("Birim fiyat negatif olamaz.");

                return;
              }

              if (!Number.isFinite(taxPercentage) || taxPercentage < 0) {
                toast.error("KDV oranı negatif olamaz.");

                return;
              }

              saveOrderItem.mutate(
                {
                  purchase_order_id: selectedOrder.id,

                  product_id: productId,

                  ordered_quantity: quantity,

                  unit_price: unitPrice,

                  tax_percentage: taxPercentage,

                  description: String(form.get("description") ?? "") || null,
                },

                {
                  onSuccess: () => {
                    formElement.reset();
                  },
                },
              );
            }}
          >
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label>Ürün / Hammadde</Label>

              <Select name="product_id">
                <SelectTrigger>
                  <SelectValue placeholder="Ürün seçin" />
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

            <div className="space-y-2">
              <Label>Miktar</Label>

              <Input
                name="ordered_quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                defaultValue="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Birim Fiyat</Label>

              <Input
                name="unit_price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="0"
              />
            </div>

            <div className="space-y-2">
              <Label>KDV %</Label>

              <Input name="tax_percentage" type="number" min="0" step="0.01" defaultValue="20" />
            </div>

            <div className="space-y-2">
              <Label>Açıklama</Label>

              <Input name="description" placeholder="Opsiyonel" />
            </div>

            <div className="flex justify-end lg:col-span-4">
              <Button type="submit" disabled={saveOrderItem.isPending}>
                <Plus className="mr-2 size-4" />

                {saveOrderItem.isPending ? "Ekleniyor..." : "Kalem Ekle"}
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sipariş İçeriği</h3>

              <span className="text-xs text-muted-foreground">
                {(orderItems.data ?? []).length} kalem
              </span>
            </div>

            {orderItems.isLoading ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Sipariş kalemleri yükleniyor...
              </div>
            ) : orderItems.isError ? (
              <div className="rounded-lg border p-6 text-center text-sm text-destructive">
                Sipariş kalemleri yüklenemedi.
              </div>
            ) : (orderItems.data ?? []).length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Bu siparişte henüz ürün yok.
              </div>
            ) : (
              (orderItems.data ?? []).map((item) => {
                const product = productMap.get(item.product_id);

                const subtotal = item.ordered_quantity * item.unit_price;

                const tax = subtotal * (item.tax_percentage / 100);

                const total = subtotal + tax;

                return (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1fr_130px_150px_150px_150px]"
                  >
                    <div>
                      <div className="font-medium">
                        {product ? `${product.code} - ${product.name}` : "Bilinmeyen Ürün"}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        Sipariş: {item.ordered_quantity} {product?.unit ?? ""}
                        {" • "}
                        Teslim: {item.received_quantity} {product?.unit ?? ""}
                      </div>

                      {item.description ? (
                        <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                      ) : null}
                    </div>

                    <div className="text-sm">
                      <div className="text-muted-foreground">Birim</div>

                      <div className="font-medium">
                        {formatCurrency(item.unit_price, selectedOrder?.currency ?? "TRY")}
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="text-muted-foreground">KDV</div>

                      <div className="font-medium">%{item.tax_percentage}</div>
                    </div>

                    <div className="text-sm">
                      <div className="text-muted-foreground">Toplam</div>

                      <div className="font-semibold">
                        {formatCurrency(total, selectedOrder?.currency ?? "TRY")}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      {item.received_quantity < item.ordered_quantity ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReceiveItem(item);
                            setSelectedReceiveWarehouseId("");
                            setReceiveDialogOpen(true);
                          }}
                        >
                          Teslim Al
                        </Button>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          Tamamı teslim alındı
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Kalemi sil"
                        disabled={deleteOrderItem.isPending || item.received_quantity > 0}
                        onClick={() => {
                          if (
                            window.confirm("Bu sipariş kalemini silmek istediğinize emin misiniz?")
                          ) {
                            deleteOrderItem.mutate(item);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="ml-auto grid max-w-sm gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ara Toplam</span>

                <span>{formatCurrency(orderSubtotal, selectedOrder?.currency ?? "TRY")}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">KDV</span>

                <span>{formatCurrency(orderTax, selectedOrder?.currency ?? "TRY")}</span>
              </div>

              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Genel Toplam</span>

                <span>{formatCurrency(orderGrandTotal, selectedOrder?.currency ?? "TRY")}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setItemsDialogOpen(false);

                setSelectedOrder(null);
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          MAL KABUL
          ===================================================== */}

      <Dialog
        open={receiveDialogOpen}
        onOpenChange={(open) => {
          setReceiveDialogOpen(open);

          if (!open) {
            setSelectedReceiveItem(null);
            setSelectedReceiveWarehouseId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mal Kabul / Teslim Al</DialogTitle>

            <DialogDescription>
              Sipariş kalemini seçilen depo ve rafa teslim alın.
            </DialogDescription>
          </DialogHeader>

          {selectedReceiveItem ? (
            <form
              id="purchase-receipt-form"
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();

                const form = new FormData(event.currentTarget);

                const quantity = Number(form.get("quantity") ?? 0);

                const warehouseId = String(form.get("warehouse_id") ?? "");

                const locationId = String(form.get("location_id") ?? "");

                const remainingQuantity =
                  selectedReceiveItem.ordered_quantity - selectedReceiveItem.received_quantity;

                if (!Number.isFinite(quantity) || quantity <= 0) {
                  toast.error("Teslim miktarı sıfırdan büyük olmalıdır.");
                  return;
                }

                if (quantity > remainingQuantity) {
                  toast.error(`Teslim miktarı kalan miktarı aşamaz. Kalan: ${remainingQuantity}`);
                  return;
                }

                if (!warehouseId) {
                  toast.error("Depo seçmelisiniz.");
                  return;
                }

                receivePurchaseItem.mutate({
                  purchase_order_item_id: selectedReceiveItem.id,
                  quantity,
                  warehouse_id: warehouseId,
                  location_id: locationId || null,
                  description: String(form.get("description") ?? "").trim() || null,
                });
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label>Ürün</Label>
                <Input
                  value={(() => {
                    const product = productMap.get(selectedReceiveItem.product_id);

                    return product ? `${product.code} - ${product.name}` : "Bilinmeyen Ürün";
                  })()}
                  readOnly
                />
              </div>

              <div className="space-y-2">
                <Label>Sipariş Miktarı</Label>
                <Input value={selectedReceiveItem.ordered_quantity} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Daha Önce Teslim</Label>
                <Input value={selectedReceiveItem.received_quantity} readOnly />
              </div>

              <div className="space-y-2">
                <Label>Kalan Miktar</Label>
                <Input
                  value={
                    selectedReceiveItem.ordered_quantity - selectedReceiveItem.received_quantity
                  }
                  readOnly
                />
              </div>

              <div className="space-y-2">
                <Label>Teslim Alınacak Miktar</Label>
                <Input
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={selectedReceiveItem.ordered_quantity - selectedReceiveItem.received_quantity}
                  defaultValue={
                    selectedReceiveItem.ordered_quantity - selectedReceiveItem.received_quantity
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Depo</Label>
                <Select
                  name="warehouse_id"
                  value={selectedReceiveWarehouseId}
                  onValueChange={(value) => {
                    setSelectedReceiveWarehouseId(value);
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
                <Label>Raf / Konum</Label>
                <Select
                  key={selectedReceiveWarehouseId}
                  name="location_id"
                  disabled={!selectedReceiveWarehouseId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Raf seçin (opsiyonel)" />
                  </SelectTrigger>

                  <SelectContent>
                    {filteredReceiveLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Açıklama</Label>
                <Textarea name="description" rows={3} placeholder="Örn. SAT-TEST-001 mal kabul" />
              </div>
            </form>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReceiveDialogOpen(false);
                setSelectedReceiveItem(null);
                setSelectedReceiveWarehouseId("");
              }}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="purchase-receipt-form"
              disabled={!selectedReceiveItem || receivePurchaseItem.isPending}
            >
              {receivePurchaseItem.isPending ? "Teslim alınıyor..." : "Teslim Al"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
