import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/stok-cikisi")({
  head: () => ({
    meta: [
      {
        title: "Stok Çıkışı | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Depolardan güvenli stok çıkışı gerçekleştirin.",
      },
    ],
  }),

  component: StockExitPage,
});

type InventoryOption = {
  id: string;
  product_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;

  products: {
    id: string;
    code: string;
    name: string;
    unit: string;
  } | null;

  warehouses: {
    id: string;
    code: string;
    name: string;
  } | null;

  warehouse_locations: {
    id: string;
    code: string;
  } | null;
};

type StockExitValues = {
  product_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  reference_no: string | null;
  description: string | null;
};

const db = supabase as any;

function StockExitPage() {
  const queryClient = useQueryClient();

  /*
   * =====================================================
   * MEVCUT STOKLAR
   * Sadece quantity > 0 olan kayıtları getiriyoruz.
   * =====================================================
   */

  const inventory = useQuery<InventoryOption[]>({
    queryKey: ["stock-exit-inventory"],

    queryFn: async () => {
      const { data, error } = await db
        .from("inventory")
        .select(`
          id,
          product_id,
          warehouse_id,
          location_id,
          quantity,

          products (
            id,
            code,
            name,
            unit
          ),

          warehouses (
            id,
            code,
            name
          ),

          warehouse_locations (
            id,
            code
          )
        `)
        .gt("quantity", 0)
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []) as InventoryOption[];
    },
  });

  /*
   * =====================================================
   * STOK ÇIKIŞI
   * =====================================================
   */

  const stockExit = useMutation({
    mutationFn: async (values: StockExitValues) => {
      const { data, error } = await db.rpc(
        "stock_exit",
        {
          p_product_id: values.product_id,
          p_warehouse_id: values.warehouse_id,
          p_quantity: values.quantity,
          p_location_id: values.location_id,
          p_reference_no: values.reference_no,
          p_description: values.description,
        },
      );

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: () => {
      toast.success("Stok çıkışı başarıyla kaydedildi.");

      void queryClient.invalidateQueries({
        queryKey: ["inventory-stock-list"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-exit-inventory"],
      });
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  if (inventory.isError) {
    return (
      <>
        <PageHeader
          title="Stok Çıkışı"
          description="Depolardaki mevcut stoklardan ürün çıkışı yapın."
        />

        <ErrorState
          onRetry={() => {
            void inventory.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Stok Çıkışı"
        description="Mevcut stoklardan güvenli ürün çıkışı gerçekleştirin."
      />

      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="size-5" />
              Yeni Stok Çıkışı
            </CardTitle>

            <CardDescription>
              Çıkış yapılacak ürün/depo stok kaydını ve miktarı seçin.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();

                const form = new FormData(event.currentTarget);

                const inventoryId = String(
                  form.get("inventory_id") ?? "",
                );

                const selected = (inventory.data ?? []).find(
                  (item) => item.id === inventoryId,
                );

                if (!selected) {
                  toast.error("Çıkış yapılacak stok kaydını seçmelisiniz.");
                  return;
                }

                const quantity = Number(
                  form.get("quantity") ?? 0,
                );

                if (!Number.isFinite(quantity) || quantity <= 0) {
                  toast.error("Miktar sıfırdan büyük olmalıdır.");
                  return;
                }

                const currentQuantity = Number(
                  selected.quantity ?? 0,
                );

                if (quantity > currentQuantity) {
                  toast.error(
                    `Yetersiz stok. Mevcut stok: ${currentQuantity} ${
                      selected.products?.unit ?? ""
                    }`,
                  );
                  return;
                }

                const referenceNo = String(
                  form.get("reference_no") ?? "",
                ).trim();

                const description = String(
                  form.get("description") ?? "",
                ).trim();

                stockExit.mutate({
                  product_id: selected.product_id,
                  warehouse_id: selected.warehouse_id,
                  location_id: selected.location_id,
                  quantity,
                  reference_no: referenceNo || null,
                  description: description || null,
                });
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="exit-inventory">
                  Ürün / Depo
                </Label>

                <Select name="inventory_id">
                  <SelectTrigger id="exit-inventory">
                    <SelectValue placeholder="Stok kaydı seçin" />
                  </SelectTrigger>

                  <SelectContent>
                    {(inventory.data ?? []).map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                      >
                        {item.products?.code ?? "—"} -{" "}
                        {item.products?.name ?? "Bilinmeyen Ürün"} |{" "}
                        {item.warehouses?.name ?? "Bilinmeyen Depo"} |{" "}
                        {Number(item.quantity)}{" "}
                        {item.products?.unit ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exit-quantity">
                  Çıkış Miktarı
                </Label>

                <Input
                  id="exit-quantity"
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  placeholder="Örn. 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exit-reference">
                  Referans No
                </Label>

                <Input
                  id="exit-reference"
                  name="reference_no"
                  placeholder="Örn. CIK-2026-001"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="exit-description">
                  Açıklama
                </Label>

                <Textarea
                  id="exit-description"
                  name="description"
                  rows={3}
                  placeholder="Stok çıkış nedeni..."
                />
              </div>

              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    stockExit.isPending ||
                    inventory.isLoading ||
                    (inventory.data ?? []).length === 0
                  }
                >
                  <ArrowUpFromLine className="mr-2 size-4" />

                  {stockExit.isPending
                    ? "Kaydediliyor..."
                    : "Stok Çıkışı Yap"}
                </Button>
              </div>
            </form>

            {!inventory.isLoading &&
            (inventory.data ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Çıkış yapılabilecek mevcut stok bulunmuyor.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}