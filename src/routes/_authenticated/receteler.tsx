import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  ListTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/receteler")({
  head: () => ({
    meta: [
      {
        title: "Reçeteler | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Ürün reçetelerini ve BOM yapılarını yönetin.",
      },
    ],
  }),

  component: RecipesPage,
});

type ProductOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type RecipeRow = {
  id: string;
  product_id: string;
  code: string;
  name: string;
  version: number;
  output_quantity: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type RecipeFormValues = {
  id?: string;
  product_id: string;
  code: string;
  name: string;
  version: number;
  output_quantity: number;
  description: string | null;
  is_active: boolean;
};

type RecipeItemRow = {
  id: string;
  bill_of_material_id: string;
  material_product_id: string;
  quantity: number;
  waste_percentage: number;
  sequence_no: number;
  description: string | null;
};

type RecipeItemFormValues = {
  bill_of_material_id: string;
  material_product_id: string;
  quantity: number;
  waste_percentage: number;
  sequence_no: number;
  description: string | null;
};

const db = supabase as any;

function RecipesPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeRow | null>(null);

  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRow | null>(null);

  /*
   * =====================================================
   * ÜRÜNLER
   * =====================================================
   */

  const products = useQuery<ProductOption[]>({
    queryKey: ["recipe-products"],

    queryFn: async () => {
      const { data, error } = await db
        .from("products")
        .select(`
          id,
          code,
          name,
          unit
        `)
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

  const recipes = useQuery<RecipeRow[]>({
    queryKey: ["bill-of-materials"],

    queryFn: async () => {
      const { data, error } = await db
        .from("bill_of_materials")
        .select(`
          id,
          product_id,
          code,
          name,
          version,
          output_quantity,
          description,
          is_active,
          created_at
        `)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []).map(
        (item: any): RecipeRow => ({
          id: item.id,
          product_id: item.product_id,
          code: item.code,
          name: item.name,
          version: Number(item.version ?? 1),
          output_quantity: Number(item.output_quantity ?? 1),
          description: item.description ?? null,
          is_active: Boolean(item.is_active),
          created_at: item.created_at,
        }),
      );
    },
  });

  const productNameById = new Map(
    (products.data ?? []).map((product) => [
      product.id,
      `${product.code} - ${product.name}`,
    ]),
  );

  /*
   * =====================================================
   * REÇETE MALZEMELERİ
   * =====================================================
   */

  const recipeItems = useQuery<RecipeItemRow[]>({
    queryKey: ["bill-of-material-items", selectedRecipe?.id],

    enabled: Boolean(selectedRecipe?.id),

    queryFn: async () => {
      if (!selectedRecipe?.id) {
        return [];
      }

      const { data, error } = await db
        .from("bill_of_material_items")
        .select(`
          id,
          bill_of_material_id,
          material_product_id,
          quantity,
          waste_percentage,
          sequence_no,
          description
        `)
        .eq("bill_of_material_id", selectedRecipe.id)
        .order("sequence_no");

      if (error) {
        throw error;
      }

      return (data ?? []).map(
        (item: any): RecipeItemRow => ({
          id: item.id,
          bill_of_material_id: item.bill_of_material_id,
          material_product_id: item.material_product_id,
          quantity: Number(item.quantity ?? 0),
          waste_percentage: Number(item.waste_percentage ?? 0),
          sequence_no: Number(item.sequence_no ?? 1),
          description: item.description ?? null,
        }),
      );
    },
  });

  /*
   * =====================================================
   * REÇETE KAYDET / GÜNCELLE
   * =====================================================
   */

  const saveRecipe = useMutation({
    mutationFn: async (values: RecipeFormValues) => {
      const payload = {
        product_id: values.product_id,
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        version: values.version,
        output_quantity: values.output_quantity,
        description: values.description?.trim() || null,
        is_active: values.is_active,
      };

      if (values.id) {
        const { error } = await db
          .from("bill_of_materials")
          .update(payload)
          .eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "receteler",
          recordId: values.id,
          newData: payload,
          description: `${payload.name} reçetesi güncellendi`,
        });

        return;
      }

      const { data, error } = await db
        .from("bill_of_materials")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "receteler",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.name} reçetesi oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Reçete kaydedildi.");

      setDialogOpen(false);
      setEditingRecipe(null);

      void queryClient.invalidateQueries({
        queryKey: ["bill-of-materials"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * MALZEME EKLE
   * =====================================================
   */

  const saveRecipeItem = useMutation({
    mutationFn: async (values: RecipeItemFormValues) => {
      const payload = {
        bill_of_material_id: values.bill_of_material_id,
        material_product_id: values.material_product_id,
        quantity: values.quantity,
        waste_percentage: values.waste_percentage,
        sequence_no: values.sequence_no,
        description: values.description?.trim() || null,
      };

      const { data, error } = await db
        .from("bill_of_material_items")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "receteler",
        recordId: String(data.id),
        newData: payload,
        description: "Reçeteye malzeme eklendi",
      });
    },

    onSuccess: () => {
      toast.success("Reçete malzemesi eklendi.");

      void queryClient.invalidateQueries({
        queryKey: ["bill-of-material-items", selectedRecipe?.id],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  /*
   * =====================================================
   * MALZEME SİL
   * =====================================================
   */

  const deleteRecipeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await db
        .from("bill_of_material_items")
        .delete()
        .eq("id", itemId);

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "delete",
        module: "receteler",
        recordId: itemId,
        description: "Reçete malzemesi silindi",
      });
    },

    onSuccess: () => {
      toast.success("Reçete malzemesi silindi.");

      void queryClient.invalidateQueries({
        queryKey: ["bill-of-material-items", selectedRecipe?.id],
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

  const columns: Column<RecipeRow>[] = [
    {
      id: "code",
      header: "Reçete Kodu",

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
      header: "Reçete",

      cell: (row) => (
        <div>
          <div className="font-medium">
            {row.name}
          </div>

          {row.description ? (
            <div className="max-w-md truncate text-xs text-muted-foreground">
              {row.description}
            </div>
          ) : null}
        </div>
      ),

      value: (row) => row.name,
      sortable: true,
    },

    {
      id: "product",
      header: "Mamul",

      cell: (row) =>
        productNameById.get(row.product_id) ?? "—",

      value: (row) =>
        productNameById.get(row.product_id) ?? "",

      sortable: true,
    },

    {
      id: "version",
      header: "Versiyon",

      cell: (row) => `v${row.version}`,
      value: (row) => row.version,

      sortable: true,
    },

    {
      id: "output_quantity",
      header: "Çıktı",

      cell: (row) => {
        const product = (products.data ?? []).find(
          (item) => item.id === row.product_id,
        );

        return `${row.output_quantity} ${product?.unit ?? ""}`;
      },

      value: (row) => row.output_quantity,
      sortable: true,
    },

    {
      id: "status",
      header: "Durum",

      cell: (row) => (
        <ActiveBadge active={row.is_active} />
      ),

      value: (row) =>
        row.is_active ? "aktif" : "pasif",
    },

    {
      id: "actions",
      header: "",

      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reçete malzemeleri"
            title="Malzemeler"
            onClick={() => {
              setSelectedRecipe(row);
              setItemsDialogOpen(true);
            }}
          >
            <ListTree className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Reçeteyi düzenle"
            title="Düzenle"
            onClick={() => {
              setEditingRecipe(row);
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

  return (
    <>
      <PageHeader
        title="Reçeteler"
        description="Üretilecek mamuller için reçete ve BOM yapılarını yönetin."
      />

      {recipes.isError || products.isError ? (
        <ErrorState
          onRetry={() => {
            void recipes.refetch();
            void products.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={recipes.data ?? []}
          rowKey={(row) => row.id}
          loading={recipes.isLoading || products.isLoading}
          searchPlaceholder="Reçete adı, kod veya mamul ara..."
          mobileTitle={(row) => row.name}
          emptyTitle="Henüz reçete yok"
          emptyDescription="İlk üretim reçetenizi oluşturarak başlayın."
          toolbar={
            <Button
              onClick={() => {
                setEditingRecipe(null);
                setDialogOpen(true);
              }}
            >
              <ClipboardList className="mr-2 size-4" />
              Yeni Reçete
            </Button>
          }
        />
      )}

      {/* =====================================================
          REÇETE FORMU
          ===================================================== */}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingRecipe(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe
                ? "Reçeteyi düzenle"
                : "Yeni reçete"}
            </DialogTitle>

            <DialogDescription>
              Mamul, versiyon ve çıktı bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="recipe-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              const form = new FormData(event.currentTarget);

              const productId = String(
                form.get("product_id") ?? "",
              );

              const code = String(
                form.get("code") ?? "",
              ).trim();

              const name = String(
                form.get("name") ?? "",
              ).trim();

              const version = Number(
                form.get("version") ?? 1,
              );

              const outputQuantity = Number(
                form.get("output_quantity") ?? 1,
              );

              if (!productId) {
                toast.error("Mamul seçmelisiniz.");
                return;
              }

              if (!code) {
                toast.error("Reçete kodu zorunludur.");
                return;
              }

              if (!name) {
                toast.error("Reçete adı zorunludur.");
                return;
              }

              if (!Number.isInteger(version) || version < 1) {
                toast.error(
                  "Versiyon 1 veya daha büyük tam sayı olmalıdır.",
                );
                return;
              }

              if (
                !Number.isFinite(outputQuantity) ||
                outputQuantity <= 0
              ) {
                toast.error(
                  "Çıktı miktarı sıfırdan büyük olmalıdır.",
                );
                return;
              }

              saveRecipe.mutate({
                ...(editingRecipe
                  ? { id: editingRecipe.id }
                  : {}),

                product_id: productId,
                code,
                name,
                version,
                output_quantity: outputQuantity,

                description:
                  String(
                    form.get("description") ?? "",
                  ) || null,

                is_active:
                  String(
                    form.get("is_active") ?? "true",
                  ) === "true",
              });
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="recipe-product">
                Mamul
              </Label>

              <Select
                name="product_id"
                defaultValue={editingRecipe?.product_id ?? ""}
              >
                <SelectTrigger id="recipe-product">
                  <SelectValue placeholder="Üretilecek mamulü seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(products.data ?? []).map((product) => (
                    <SelectItem
                      key={product.id}
                      value={product.id}
                    >
                      {product.code} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-code">
                Reçete Kodu
              </Label>

              <Input
                id="recipe-code"
                name="code"
                required
                placeholder="Örn. REC-001"
                defaultValue={editingRecipe?.code ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-version">
                Versiyon
              </Label>

              <Input
                id="recipe-version"
                name="version"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={editingRecipe?.version ?? 1}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="recipe-name">
                Reçete Adı
              </Label>

              <Input
                id="recipe-name"
                name="name"
                required
                placeholder="Örn. Standart Masa Ayağı Reçetesi"
                defaultValue={editingRecipe?.name ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-output">
                Çıktı Miktarı
              </Label>

              <Input
                id="recipe-output"
                name="output_quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                defaultValue={
                  editingRecipe?.output_quantity ?? 1
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipe-status">
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={String(
                  editingRecipe?.is_active ?? true,
                )}
              >
                <SelectTrigger id="recipe-status">
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
              <Label htmlFor="recipe-description">
                Açıklama
              </Label>

              <Textarea
                id="recipe-description"
                name="description"
                rows={3}
                placeholder="Reçete hakkında açıklama..."
                defaultValue={
                  editingRecipe?.description ?? ""
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
              form="recipe-form"
              disabled={saveRecipe.isPending}
            >
              {saveRecipe.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          REÇETE MALZEMELERİ
          ===================================================== */}

      <Dialog
        open={itemsDialogOpen}
        onOpenChange={(open) => {
          setItemsDialogOpen(open);

          if (!open) {
            setSelectedRecipe(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Reçete Malzemeleri
            </DialogTitle>

            <DialogDescription>
              {selectedRecipe
                ? `${selectedRecipe.code} - ${selectedRecipe.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              if (!selectedRecipe) {
                return;
              }

              const formElement = event.currentTarget;
              const form = new FormData(formElement);

              const materialProductId = String(
                form.get("material_product_id") ?? "",
              );

              const quantity = Number(
                form.get("quantity") ?? 0,
              );

              const wastePercentage = Number(
                form.get("waste_percentage") ?? 0,
              );

              const sequenceNo = Number(
                form.get("sequence_no") ?? 1,
              );

              if (!materialProductId) {
                toast.error("Malzeme seçmelisiniz.");
                return;
              }

              if (
                !Number.isFinite(quantity) ||
                quantity <= 0
              ) {
                toast.error(
                  "Miktar sıfırdan büyük olmalıdır.",
                );
                return;
              }

              if (
                !Number.isFinite(wastePercentage) ||
                wastePercentage < 0 ||
                wastePercentage > 100
              ) {
                toast.error(
                  "Fire oranı 0 ile 100 arasında olmalıdır.",
                );
                return;
              }

              if (
                !Number.isInteger(sequenceNo) ||
                sequenceNo < 1
              ) {
                toast.error(
                  "Sıra numarası 1 veya daha büyük olmalıdır.",
                );
                return;
              }

              saveRecipeItem.mutate(
                {
                  bill_of_material_id: selectedRecipe.id,
                  material_product_id: materialProductId,
                  quantity,
                  waste_percentage: wastePercentage,
                  sequence_no: sequenceNo,

                  description:
                    String(
                      form.get("description") ?? "",
                    ) || null,
                },

                {
                  onSuccess: () => {
                    formElement.reset();
                  },
                },
              );
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label>
                Malzeme / Hammadde
              </Label>

              <Select name="material_product_id">
                <SelectTrigger>
                  <SelectValue placeholder="Malzeme seçin" />
                </SelectTrigger>

                <SelectContent>
                  {(products.data ?? [])
                    .filter(
                      (product) =>
                        product.id !==
                        selectedRecipe?.product_id,
                    )
                    .map((product) => (
                      <SelectItem
                        key={product.id}
                        value={product.id}
                      >
                        {product.code} - {product.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Miktar
              </Label>

              <Input
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                defaultValue="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Fire %
              </Label>

              <Input
                name="waste_percentage"
                type="number"
                min="0"
                max="100"
                step="0.001"
                defaultValue="0"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Sıra No
              </Label>

              <Input
                name="sequence_no"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Açıklama
              </Label>

              <Input
                name="description"
                placeholder="Opsiyonel"
              />
            </div>

            <div className="flex justify-end sm:col-span-2">
              <Button
                type="submit"
                disabled={saveRecipeItem.isPending}
              >
                <Plus className="mr-2 size-4" />

                {saveRecipeItem.isPending
                  ? "Ekleniyor..."
                  : "Malzeme Ekle"}
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Reçete İçeriği
              </h3>

              <span className="text-xs text-muted-foreground">
                {(recipeItems.data ?? []).length} malzeme
              </span>
            </div>

            {recipeItems.isLoading ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Malzemeler yükleniyor...
              </div>
            ) : recipeItems.isError ? (
              <div className="rounded-lg border p-6 text-center text-sm text-destructive">
                Reçete malzemeleri yüklenemedi.
              </div>
            ) : (recipeItems.data ?? []).length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Bu reçetede henüz malzeme yok.
              </div>
            ) : (
              (recipeItems.data ?? []).map((item) => {
                const product = (products.data ?? []).find(
                  (productItem) =>
                    productItem.id ===
                    item.material_product_id,
                );

                const quantityWithWaste =
                  item.quantity *
                  (1 + item.waste_percentage / 100);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        <span className="mr-2 text-xs text-muted-foreground">
                          #{item.sequence_no}
                        </span>

                        {product?.code ?? "—"} -{" "}
                        {product?.name ?? "Bilinmeyen Malzeme"}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} {product?.unit ?? ""}

                        {item.waste_percentage > 0
                          ? ` + %${item.waste_percentage} fire = ${quantityWithWaste.toFixed(
                              3,
                            )} ${product?.unit ?? ""}`
                          : ""}
                      </div>

                      {item.description ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Malzemeyi sil"
                      title="Malzemeyi sil"
                      disabled={deleteRecipeItem.isPending}
                      onClick={() => {
                        deleteRecipeItem.mutate(item.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setItemsDialogOpen(false);
                setSelectedRecipe(null);
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}