import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Pencil } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/urunler")({
  head: () => ({
    meta: [
      {
        title: "Ürünler | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Fabrika ürün, hammadde, mamul ve sarf malzemelerini yönetin.",
      },
    ],
  }),

  component: ProductsPage,
});

type ProductType =
  | "raw_material"
  | "semi_finished"
  | "finished"
  | "consumable"
  | "spare_part";

type ProductCategory = {
  id: string;
  name: string;
  code: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  product_type: ProductType;
  description: string | null;
  unit: string;
  barcode: string | null;
  minimum_stock: number;
  maximum_stock: number | null;
  purchase_price: number | null;
  sale_price: number | null;
  is_active: boolean;
};

type ProductFormValues = {
  id?: string;
  code: string;
  name: string;
  category_id: string | null;
  product_type: ProductType;
  description: string | null;
  unit: string;
  barcode: string | null;
  minimum_stock: number;
  maximum_stock: number | null;
  purchase_price: number | null;
  sale_price: number | null;
  is_active: boolean;
};

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  raw_material: "Hammadde",
  semi_finished: "Yarı Mamul",
  finished: "Mamul",
  consumable: "Sarf Malzeme",
  spare_part: "Yedek Parça",
};

const UNITS = [
  "Adet",
  "Kg",
  "Gram",
  "Ton",
  "Metre",
  "Santimetre",
  "Litre",
  "Mililitre",
  "Paket",
  "Kutu",
  "Palet",
];

// Lovable Cloud veritabanı tiplerini ayrıca güncelleyeceğiz.
// Şimdilik runtime bağlantısı gerçek Supabase client üzerinden devam ediyor.
const db = supabase as any;

function ProductsPage() {
  const { hasPermission } = useAuth();

  const queryClient = useQueryClient();

  const canCreate =
    hasPermission("products.create") ||
    hasPermission("products.manage");

  const canUpdate =
    hasPermission("products.update") ||
    hasPermission("products.manage");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  /*
   * =====================================================
   * KATEGORİLER
   * =====================================================
   */

  const categories = useQuery<ProductCategory[]>({
    queryKey: ["product-categories"],

    queryFn: async () => {
      const { data, error } = await db
        .from("product_categories")
        .select("id, name, code")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []) as ProductCategory[];
    },
  });

  /*
   * =====================================================
   * ÜRÜNLER
   * =====================================================
   */

  const products = useQuery<Product[]>({
    queryKey: ["products"],

    queryFn: async () => {
      const { data, error } = await db
        .from("products")
        .select(`
          id,
          code,
          name,
          category_id,
          product_type,
          description,
          unit,
          barcode,
          minimum_stock,
          maximum_stock,
          purchase_price,
          sale_price,
          is_active
        `)
        .is("deleted_at", null)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []) as Product[];
    },
  });

  const categoryNameById = new Map(
    (categories.data ?? []).map((category) => [
      category.id,
      category.name,
    ]),
  );

  /*
   * =====================================================
   * ÜRÜN EKLE / GÜNCELLE
   * =====================================================
   */

  const saveProduct = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        code: values.code.trim().toUpperCase(),

        name: values.name.trim(),

        category_id:
          values.category_id &&
          values.category_id.length > 0
            ? values.category_id
            : null,

        product_type: values.product_type,

        description:
          values.description?.trim() || null,

        unit: values.unit,

        barcode:
          values.barcode?.trim() || null,

        minimum_stock:
          values.minimum_stock,

        maximum_stock:
          values.maximum_stock,

        purchase_price:
          values.purchase_price,

        sale_price:
          values.sale_price,

        is_active:
          values.is_active,
      };

      /*
       * GÜNCELLE
       */

      if (values.id) {
        const { error } = await db
          .from("products")
          .update(payload)
          .eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "urunler",
          recordId: values.id,
          newData: payload,
          description: `${payload.name} ürünü güncellendi`,
        });

        return;
      }

      /*
       * YENİ ÜRÜN
       */

      const { data, error } = await db
        .from("products")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "urunler",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.name} ürünü oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Ürün kaydedildi.");

      setDialogOpen(false);

      setEditingProduct(null);

      void queryClient.invalidateQueries({
        queryKey: ["products"],
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

  const columns: Column<Product>[] = [
    {
      id: "code",

      header: "Ürün Kodu",

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
      id: "name",

      header: "Ürün",

      cell: (row) => (
        <div>
          <div className="font-medium">
            {row.name}
          </div>

          {row.barcode ? (
            <div className="text-xs text-muted-foreground">
              Barkod: {row.barcode}
            </div>
          ) : null}
        </div>
      ),

      value: (row) =>
        row.name,

      sortable: true,
    },

    {
      id: "category",

      header: "Kategori",

      cell: (row) => {
        if (!row.category_id) {
          return "—";
        }

        return (
          categoryNameById.get(
            row.category_id,
          ) ?? "—"
        );
      },

      value: (row) => {
        if (!row.category_id) {
          return "";
        }

        return (
          categoryNameById.get(
            row.category_id,
          ) ?? ""
        );
      },

      sortable: true,
    },

    {
      id: "type",

      header: "Tür",

      cell: (row) =>
        PRODUCT_TYPE_LABELS[
          row.product_type
        ],

      value: (row) =>
        PRODUCT_TYPE_LABELS[
          row.product_type
        ],

      sortable: true,
    },

    {
      id: "unit",

      header: "Birim",

      cell: (row) =>
        row.unit,

      value: (row) =>
        row.unit,

      sortable: true,
    },

    {
      id: "minimum_stock",

      header: "Min. Stok",

      cell: (row) =>
        `${row.minimum_stock} ${row.unit}`,

      value: (row) =>
        row.minimum_stock,

      sortable: true,
    },

    {
      id: "status",

      header: "Durum",

      cell: (row) => (
        <ActiveBadge
          active={
            row.is_active
          }
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

            cell: (
              row: Product,
            ) => (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ürünü düzenle"
                  onClick={() => {
                    setEditingProduct(
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

            className:
              "text-right",
          } satisfies Column<Product>,
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
        title="Ürünler"
        description="Hammadde, yarı mamul, mamul, sarf malzemesi ve yedek parçaları yönetin."
      />

      {products.isError ||
      categories.isError ? (
        <ErrorState
          onRetry={() => {
            void products.refetch();

            void categories.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={
            products.data ?? []
          }
          rowKey={(row) =>
            row.id
          }
          loading={
            products.isLoading ||
            categories.isLoading
          }
          searchPlaceholder="Ürün adı, kod veya barkod ara..."
          mobileTitle={(row) =>
            row.name
          }
          emptyTitle="Henüz ürün yok"
          emptyDescription="İlk ürününüzü ekleyerek stok yönetimine başlayın."
          toolbar={
            canCreate ? (
              <Button
                onClick={() => {
                  setEditingProduct(
                    null,
                  );

                  setDialogOpen(
                    true,
                  );
                }}
              >
                <PackagePlus className="mr-2 size-4" />

                Yeni Ürün
              </Button>
            ) : undefined
          }
        />
      )}

      {/*
       * =================================================
       * ÜRÜN FORMU
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
            setEditingProduct(
              null,
            );
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? "Ürünü düzenle"
                : "Yeni ürün"}
            </DialogTitle>

            <DialogDescription>
              Ürün veya malzemenin temel bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="product-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(
              event,
            ) => {
              event.preventDefault();

              const form =
                new FormData(
                  event.currentTarget,
                );

              const minimumStock =
                Number(
                  form.get(
                    "minimum_stock",
                  ) ?? 0,
                );

              const maximumRaw =
                String(
                  form.get(
                    "maximum_stock",
                  ) ?? "",
                ).trim();

              const purchaseRaw =
                String(
                  form.get(
                    "purchase_price",
                  ) ?? "",
                ).trim();

              const saleRaw =
                String(
                  form.get(
                    "sale_price",
                  ) ?? "",
                ).trim();

              const maximumStock =
                maximumRaw === ""
                  ? null
                  : Number(
                      maximumRaw,
                    );

              const purchasePrice =
                purchaseRaw === ""
                  ? null
                  : Number(
                      purchaseRaw,
                    );

              const salePrice =
                saleRaw === ""
                  ? null
                  : Number(
                      saleRaw,
                    );

              if (
                Number.isNaN(
                  minimumStock,
                )
              ) {
                toast.error(
                  "Minimum stok değeri geçersiz.",
                );

                return;
              }

              if (
                maximumStock !==
                  null &&
                Number.isNaN(
                  maximumStock,
                )
              ) {
                toast.error(
                  "Maksimum stok değeri geçersiz.",
                );

                return;
              }

              if (
                maximumStock !==
                  null &&
                maximumStock <
                  minimumStock
              ) {
                toast.error(
                  "Maksimum stok minimum stoktan küçük olamaz.",
                );

                return;
              }

              saveProduct.mutate({
                ...(editingProduct
                  ? {
                      id:
                        editingProduct.id,
                    }
                  : {}),

                code:
                  String(
                    form.get(
                      "code",
                    ) ?? "",
                  ),

                name:
                  String(
                    form.get(
                      "name",
                    ) ?? "",
                  ),

                category_id:
                  String(
                    form.get(
                      "category_id",
                    ) ?? "",
                  ) || null,

                product_type:
                  String(
                    form.get(
                      "product_type",
                    ) ??
                      "raw_material",
                  ) as ProductType,

                description:
                  String(
                    form.get(
                      "description",
                    ) ?? "",
                  ) || null,

                unit:
                  String(
                    form.get(
                      "unit",
                    ) ?? "Adet",
                  ),

                barcode:
                  String(
                    form.get(
                      "barcode",
                    ) ?? "",
                  ) || null,

                minimum_stock:
                  minimumStock,

                maximum_stock:
                  maximumStock,

                purchase_price:
                  purchasePrice,

                sale_price:
                  salePrice,

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
              <Label htmlFor="product-name">
                Ürün adı
              </Label>

              <Input
                id="product-name"
                name="name"
                required
                placeholder="Örn. Alüminyum Profil"
                defaultValue={
                  editingProduct?.name ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-code">
                Ürün kodu
              </Label>

              <Input
                id="product-code"
                name="code"
                required
                placeholder="PRD-000001"
                defaultValue={
                  editingProduct?.code ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category">
                Kategori
              </Label>

              <Select
                name="category_id"
                defaultValue={
                  editingProduct?.category_id ??
                  ""
                }
              >
                <SelectTrigger id="product-category">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(categories.data ??
                    []).map(
                    (
                      category,
                    ) => (
                      <SelectItem
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {
                          category.name
                        }
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-type">
                Ürün türü
              </Label>

              <Select
                name="product_type"
                defaultValue={
                  editingProduct?.product_type ??
                  "raw_material"
                }
              >
                <SelectTrigger id="product-type">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {Object.entries(
                    PRODUCT_TYPE_LABELS,
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <SelectItem
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-unit">
                Ölçü birimi
              </Label>

              <Select
                name="unit"
                defaultValue={
                  editingProduct?.unit ??
                  "Adet"
                }
              >
                <SelectTrigger id="product-unit">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {UNITS.map(
                    (unit) => (
                      <SelectItem
                        key={
                          unit
                        }
                        value={
                          unit
                        }
                      >
                        {unit}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-barcode">
                Barkod
              </Label>

              <Input
                id="product-barcode"
                name="barcode"
                placeholder="Opsiyonel"
                defaultValue={
                  editingProduct?.barcode ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-stock">
                Minimum stok
              </Label>

              <Input
                id="minimum-stock"
                name="minimum_stock"
                type="number"
                min="0"
                step="0.001"
                required
                defaultValue={
                  editingProduct?.minimum_stock ??
                  0
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maximum-stock">
                Maksimum stok
              </Label>

              <Input
                id="maximum-stock"
                name="maximum_stock"
                type="number"
                min="0"
                step="0.001"
                defaultValue={
                  editingProduct?.maximum_stock ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-price">
                Alış fiyatı
              </Label>

              <Input
                id="purchase-price"
                name="purchase_price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  editingProduct?.purchase_price ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale-price">
                Satış fiyatı
              </Label>

              <Input
                id="sale-price"
                name="sale_price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  editingProduct?.sale_price ??
                  ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-status">
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={
                  String(
                    editingProduct?.is_active ??
                      true,
                  )
                }
              >
                <SelectTrigger id="product-status">
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
              <Label htmlFor="product-description">
                Açıklama
              </Label>

              <Textarea
                id="product-description"
                name="description"
                rows={3}
                placeholder="Ürün hakkında not..."
                defaultValue={
                  editingProduct?.description ??
                  ""
                }
              />
            </div>
          </form>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
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
              form="product-form"
              disabled={
                saveProduct.isPending
              }
            >
              {saveProduct.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}