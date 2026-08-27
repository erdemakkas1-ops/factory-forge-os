import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Pencil } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/kategoriler")({
  head: () => ({
    meta: [
      {
        title: "Ürün Kategorileri | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Ürün ve malzeme kategorilerini yönetin.",
      },
    ],
  }),
  component: CategoriesPage,
});

type ProductCategory = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

type CategoryFormValues = {
  id?: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

// Faz 2 Supabase tiplerini daha sonra gerçek Lovable Cloud
// şemasından yeniden üreteceğiz.
const db = supabase as any;

function CategoriesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const canCreate =
    hasPermission("products.create") ||
    hasPermission("products.manage");

  const canUpdate =
    hasPermission("products.update") ||
    hasPermission("products.manage");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingCategory, setEditingCategory] =
    useState<ProductCategory | null>(null);

  /*
   * =====================================================
   * KATEGORİLERİ GETİR
   * =====================================================
   */

  const categories = useQuery<ProductCategory[]>({
    queryKey: ["product-categories"],

    queryFn: async () => {
      const { data, error } = await db
        .from("product_categories")
        .select(`
          id,
          name,
          code,
          description,
          is_active
        `)
        .is("deleted_at", null)
        .order("name");

      if (error) {
        throw error;
      }

      return (data ?? []) as ProductCategory[];
    },
  });

  /*
   * =====================================================
   * KAYDET / GÜNCELLE
   * =====================================================
   */

  const saveCategory = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const payload = {
        name: values.name.trim(),

        code: values.code
          .trim()
          .toUpperCase(),

        description:
          values.description?.trim() || null,

        is_active:
          values.is_active,
      };

      /*
       * GÜNCELLEME
       */

      if (values.id) {
        const { error } = await db
          .from("product_categories")
          .update(payload)
          .eq("id", values.id);

        if (error) {
          throw error;
        }

        await writeAudit({
          action: "update",
          module: "urun_kategorileri",
          recordId: values.id,
          newData: payload,
          description: `${payload.name} kategorisi güncellendi`,
        });

        return;
      }

      /*
       * YENİ KATEGORİ
       */

      const { data, error } = await db
        .from("product_categories")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      await writeAudit({
        action: "create",
        module: "urun_kategorileri",
        recordId: String(data.id),
        newData: payload,
        description: `${payload.name} kategorisi oluşturuldu`,
      });
    },

    onSuccess: () => {
      toast.success("Kategori kaydedildi.");

      setDialogOpen(false);
      setEditingCategory(null);

      void queryClient.invalidateQueries({
        queryKey: ["product-categories"],
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

  const columns: Column<ProductCategory>[] = [
    {
      id: "code",
      header: "Kategori Kodu",

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
      header: "Kategori",

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

            cell: (row: ProductCategory) => (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Kategoriyi düzenle"
                  onClick={() => {
                    setEditingCategory(row);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            ),

            className: "text-right",
          } satisfies Column<ProductCategory>,
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
        title="Ürün Kategorileri"
        description="Ürün, hammadde ve malzemelerinizi kategorilere ayırın."
      />

      {categories.isError ? (
        <ErrorState
          onRetry={() => {
            void categories.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={categories.data ?? []}
          rowKey={(row) => row.id}
          loading={categories.isLoading}
          searchPlaceholder="Kategori adı veya kod ara..."
          mobileTitle={(row) => row.name}
          emptyTitle="Henüz kategori yok"
          emptyDescription="İlk ürün kategorinizi oluşturarak başlayın."
          toolbar={
            canCreate ? (
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setDialogOpen(true);
                }}
              >
                <FolderPlus className="mr-2 size-4" />
                Yeni Kategori
              </Button>
            ) : undefined
          }
        />
      )}

      {/*
       * =================================================
       * KATEGORİ FORMU
       * =================================================
       */}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingCategory(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? "Kategoriyi düzenle"
                : "Yeni kategori"}
            </DialogTitle>

            <DialogDescription>
              Ürünlerinizi gruplamak için kategori bilgilerini girin.
            </DialogDescription>
          </DialogHeader>

          <form
            id="category-form"
            className="space-y-4"
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
                  "Kategori adı zorunludur.",
                );
                return;
              }

              if (!code) {
                toast.error(
                  "Kategori kodu zorunludur.",
                );
                return;
              }

              saveCategory.mutate({
                ...(editingCategory
                  ? {
                      id:
                        editingCategory.id,
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
              <Label htmlFor="category-name">
                Kategori adı
              </Label>

              <Input
                id="category-name"
                name="name"
                required
                placeholder="Örn. Elektrik Malzemeleri"
                defaultValue={
                  editingCategory?.name ?? ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-code">
                Kategori kodu
              </Label>

              <Input
                id="category-code"
                name="code"
                required
                placeholder="Örn. ELK"
                defaultValue={
                  editingCategory?.code ?? ""
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-status">
                Durum
              </Label>

              <Select
                name="is_active"
                defaultValue={String(
                  editingCategory?.is_active ??
                    true,
                )}
              >
                <SelectTrigger id="category-status">
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
              <Label htmlFor="category-description">
                Açıklama
              </Label>

              <Textarea
                id="category-description"
                name="description"
                rows={3}
                placeholder="Kategori hakkında kısa açıklama..."
                defaultValue={
                  editingCategory?.description ??
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
                setDialogOpen(false);
              }}
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              form="category-form"
              disabled={saveCategory.isPending}
            >
              {saveCategory.isPending
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}