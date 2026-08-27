import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/stok-girisi")({
  head: () => ({
    meta: [
      {
        title: "Stok Girişi | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Ürünleri depolara stok girişi olarak kaydedin.",
      },
    ],
  }),

  component: StockEntryPage,
});

type ProductOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
  is_active: boolean;
};

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

type LocationOption = {
  id: string;
  warehouse_id: string;
  code: string;
  is_active: boolean;
};

type StockEntryValues = {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  location_id: string | null;
  reference_no: string | null;
  description: string | null;
};

const db = supabase as any;

function StockEntryPage() {
  const queryClient = useQueryClient();

  const [selectedWarehouseId, setSelectedWarehouseId] =
    useState("");

  /*
   * =====================================================
   * ÜRÜNLER
   * =====================================================
   */

  const products = useQuery<ProductOption[]>({
    queryKey: ["stock-entry-products"],

    queryFn: async () => {
      const { data, error } = await db
        .from("products")
        .select(`
          id,
          code,
          name,
          unit,
          is_active
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
   * DEPOLAR
   * =====================================================
   */

  const warehouses = useQuery<WarehouseOption[]>({
    queryKey: ["stock-entry-warehouses"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouses")
        .select(`
          id,
          code,
          name,
          is_active
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
   * RAF / KONUM
   * =====================================================
   */

  const locations = useQuery<LocationOption[]>({
    queryKey: ["stock-entry-locations"],

    queryFn: async () => {
      const { data, error } = await db
        .from("warehouse_locations")
        .select(`
          id,
          warehouse_id,
          code,
          is_active
        `)
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
   * SEÇİLEN DEPOYA AİT RAFLAR
   * =====================================================
   */

  const filteredLocations =
    (locations.data ?? []).filter(
      (location) =>
        location.warehouse_id ===
        selectedWarehouseId,
    );

  /*
   * =====================================================
   * STOK GİRİŞİ
   * =====================================================
   */

  const stockEntry = useMutation({
    mutationFn: async (values: StockEntryValues) => {
      const { data, error } = await db.rpc(
        "stock_entry",
        {
          p_product_id:
            values.product_id,

          p_warehouse_id:
            values.warehouse_id,

          p_quantity:
            values.quantity,

          p_location_id:
            values.location_id,

          p_reference_no:
            values.reference_no,

          p_description:
            values.description,
        },
      );

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: () => {
      toast.success(
        "Stok girişi başarıyla kaydedildi.",
      );

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
      toast.error(
        friendlyError(error),
      );
    },
  });

  /*
   * =====================================================
   * HATA DURUMU
   * =====================================================
   */

  if (
    products.isError ||
    warehouses.isError ||
    locations.isError
  ) {
    return (
      <>
        <PageHeader
          title="Stok Girişi"
          description="Ürünleri seçilen depoya giriş yapın."
        />

        <ErrorState
          onRetry={() => {
            void products.refetch();
            void warehouses.refetch();
            void locations.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Stok Girişi"
        description="Ürünleri seçilen depoya güvenli stok hareketi olarak kaydedin."
      />

      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="size-5" />

              Yeni Stok Girişi
            </CardTitle>

            <CardDescription>
              Ürün, depo, raf ve miktar bilgilerini girin.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();

                const form = new FormData(
                  event.currentTarget,
                );

                const productId =
                  String(
                    form.get(
                      "product_id",
                    ) ?? "",
                  );

                const warehouseId =
                  String(
                    form.get(
                      "warehouse_id",
                    ) ?? "",
                  );

                const locationId =
                  String(
                    form.get(
                      "location_id",
                    ) ?? "",
                  );

                const quantity =
                  Number(
                    form.get(
                      "quantity",
                    ) ?? 0,
                  );

                const referenceNo =
                  String(
                    form.get(
                      "reference_no",
                    ) ?? "",
                  ).trim();

                const description =
                  String(
                    form.get(
                      "description",
                    ) ?? "",
                  ).trim();

                if (!productId) {
                  toast.error(
                    "Ürün seçmelisiniz.",
                  );

                  return;
                }

                if (!warehouseId) {
                  toast.error(
                    "Depo seçmelisiniz.",
                  );

                  return;
                }

                if (
                  !Number.isFinite(
                    quantity,
                  ) ||
                  quantity <= 0
                ) {
                  toast.error(
                    "Miktar sıfırdan büyük olmalıdır.",
                  );

                  return;
                }

                /*
                 * Raf seçilmişse gerçekten
                 * seçilen depoya ait mi?
                 */

                if (locationId) {
                  const validLocation =
                    filteredLocations.some(
                      (location) =>
                        location.id ===
                        locationId,
                    );

                  if (!validLocation) {
                    toast.error(
                      "Seçilen raf bu depoya ait değil.",
                    );

                    return;
                  }
                }

                stockEntry.mutate({
                  product_id:
                    productId,

                  warehouse_id:
                    warehouseId,

                  quantity,

                  location_id:
                    locationId ||
                    null,

                  reference_no:
                    referenceNo ||
                    null,

                  description:
                    description ||
                    null,
                });
              }}
            >
              {/*
               * =================================================
               * ÜRÜN
               * =================================================
               */}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="stock-product">
                  Ürün
                </Label>

                <Select name="product_id">
                  <SelectTrigger id="stock-product">
                    <SelectValue placeholder="Ürün seçin" />
                  </SelectTrigger>

                  <SelectContent>
                    {(products.data ?? []).map(
                      (product) => (
                        <SelectItem
                          key={
                            product.id
                          }
                          value={
                            product.id
                          }
                        >
                          {product.code} -{" "}
                          {product.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/*
               * =================================================
               * DEPO
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="stock-warehouse">
                  Depo
                </Label>

                <Select
                  name="warehouse_id"
                  onValueChange={(value) => {
                    setSelectedWarehouseId(
                      value,
                    );
                  }}
                >
                  <SelectTrigger id="stock-warehouse">
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
                          {warehouse.code} -{" "}
                          {warehouse.name}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/*
               * =================================================
               * RAF / KONUM
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="stock-location">
                  Raf / Konum
                </Label>

                <Select
                  name="location_id"
                  disabled={
                    !selectedWarehouseId ||
                    filteredLocations.length ===
                      0
                  }
                >
                  <SelectTrigger id="stock-location">
                    <SelectValue
                      placeholder={
                        !selectedWarehouseId
                          ? "Önce depo seçin"
                          : filteredLocations.length ===
                              0
                            ? "Bu depoda raf yok"
                            : "Raf seçin (opsiyonel)"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {filteredLocations.map(
                      (location) => (
                        <SelectItem
                          key={
                            location.id
                          }
                          value={
                            location.id
                          }
                        >
                          {location.code}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/*
               * =================================================
               * MİKTAR
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="stock-quantity">
                  Miktar
                </Label>

                <Input
                  id="stock-quantity"
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  placeholder="Örn. 100"
                />
              </div>

              {/*
               * =================================================
               * REFERANS
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="stock-reference">
                  Referans No
                </Label>

                <Input
                  id="stock-reference"
                  name="reference_no"
                  placeholder="Örn. IRS-2026-001"
                />
              </div>

              {/*
               * =================================================
               * AÇIKLAMA
               * =================================================
               */}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="stock-description">
                  Açıklama
                </Label>

                <Textarea
                  id="stock-description"
                  name="description"
                  rows={3}
                  placeholder="Stok girişi hakkında açıklama..."
                />
              </div>

              {/*
               * =================================================
               * BUTON
               * =================================================
               */}

              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    stockEntry.isPending ||
                    products.isLoading ||
                    warehouses.isLoading
                  }
                >
                  <ArrowDownToLine className="mr-2 size-4" />

                  {stockEntry.isPending
                    ? "Kaydediliyor..."
                    : "Stok Girişi Yap"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}