import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/stok-transfer")({
  head: () => ({
    meta: [
      {
        title: "Stok Transferi | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Ürünleri depolar ve raflar arasında transfer edin.",
      },
    ],
  }),

  component: StockTransferPage,
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

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type LocationOption = {
  id: string;
  warehouse_id: string;
  code: string;
  is_active: boolean;
};

type TransferValues = {
  product_id: string;

  source_warehouse_id: string;
  source_location_id: string | null;

  destination_warehouse_id: string;
  destination_location_id: string | null;

  quantity: number;

  reference_no: string | null;
  description: string | null;
};

const db = supabase as any;

function StockTransferPage() {
  const queryClient = useQueryClient();

  const [selectedDestinationWarehouseId, setSelectedDestinationWarehouseId] =
    useState("");

  /*
   * =====================================================
   * TRANSFER EDİLEBİLİR STOKLAR
   * =====================================================
   */

  const inventory = useQuery<InventoryOption[]>({
    queryKey: ["stock-transfer-inventory"],

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
   * DEPOLAR
   * =====================================================
   */

  const warehouses = useQuery<WarehouseOption[]>({
    queryKey: ["stock-transfer-warehouses"],

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
   * DEPO RAF / KONUM LİSTESİ
   * =====================================================
   */

  const locations = useQuery<LocationOption[]>({
    queryKey: ["stock-transfer-locations"],

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
   * HEDEF DEPOYA AİT RAFLAR
   * =====================================================
   */

  const destinationLocations =
    (locations.data ?? []).filter(
      (location) =>
        location.warehouse_id ===
        selectedDestinationWarehouseId,
    );

  /*
   * =====================================================
   * TRANSFER RPC
   * =====================================================
   */

  const transfer = useMutation({
    mutationFn: async (values: TransferValues) => {
      const { data, error } = await db.rpc(
        "stock_transfer",
        {
          p_product_id:
            values.product_id,

          p_source_warehouse_id:
            values.source_warehouse_id,

          p_destination_warehouse_id:
            values.destination_warehouse_id,

          p_quantity:
            values.quantity,

          p_source_location_id:
            values.source_location_id,

          p_destination_location_id:
            values.destination_location_id,

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
        "Stok transferi başarıyla tamamlandı.",
      );

      void queryClient.invalidateQueries({
        queryKey: ["inventory-stock-list"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-transfer-inventory"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-exit-inventory"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["stock-movements"],
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
   * HATA
   * =====================================================
   */

  if (
    inventory.isError ||
    warehouses.isError ||
    locations.isError
  ) {
    return (
      <>
        <PageHeader
          title="Stok Transferi"
          description="Ürünleri depolar ve raflar arasında transfer edin."
        />

        <ErrorState
          onRetry={() => {
            void inventory.refetch();
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
        title="Stok Transferi"
        description="Mevcut stokları depolar ve raflar arasında güvenli şekilde taşıyın."
      />

      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5" />

              Depolar Arası Transfer
            </CardTitle>

            <CardDescription>
              Kaynak stok kaydını, hedef depoyu, hedef rafı ve miktarı belirleyin.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();

                const form =
                  new FormData(
                    event.currentTarget,
                  );

                /*
                 * =========================================
                 * KAYNAK STOK
                 * =========================================
                 */

                const inventoryId =
                  String(
                    form.get(
                      "inventory_id",
                    ) ?? "",
                  );

                const selected =
                  (
                    inventory.data ??
                    []
                  ).find(
                    (item) =>
                      item.id ===
                      inventoryId,
                  );

                if (!selected) {
                  toast.error(
                    "Kaynak stok seçmelisiniz.",
                  );

                  return;
                }

                /*
                 * =========================================
                 * HEDEF DEPO
                 * =========================================
                 */

                const destinationWarehouseId =
                  String(
                    form.get(
                      "destination_warehouse_id",
                    ) ?? "",
                  );

                if (
                  !destinationWarehouseId
                ) {
                  toast.error(
                    "Hedef depo seçmelisiniz.",
                  );

                  return;
                }

                /*
                 * =========================================
                 * HEDEF RAF
                 * =========================================
                 */

                const destinationLocationId =
                  String(
                    form.get(
                      "destination_location_id",
                    ) ?? "",
                  );

                if (
                  destinationLocationId
                ) {
                  const validDestinationLocation =
                    destinationLocations.some(
                      (location) =>
                        location.id ===
                        destinationLocationId,
                    );

                  if (
                    !validDestinationLocation
                  ) {
                    toast.error(
                      "Seçilen hedef raf bu depoya ait değil.",
                    );

                    return;
                  }
                }

                /*
                 * =========================================
                 * AYNI KONUM KONTROLÜ
                 * =========================================
                 */

                if (
                  selected.warehouse_id ===
                    destinationWarehouseId &&
                  selected.location_id ===
                    (
                      destinationLocationId ||
                      null
                    )
                ) {
                  toast.error(
                    "Kaynak ve hedef stok konumu aynı olamaz.",
                  );

                  return;
                }

                /*
                 * =========================================
                 * MİKTAR
                 * =========================================
                 */

                const quantity =
                  Number(
                    form.get(
                      "quantity",
                    ) ?? 0,
                  );

                if (
                  !Number.isFinite(
                    quantity,
                  ) ||
                  quantity <= 0
                ) {
                  toast.error(
                    "Transfer miktarı sıfırdan büyük olmalıdır.",
                  );

                  return;
                }

                const currentQuantity =
                  Number(
                    selected.quantity ??
                      0,
                  );

                if (
                  quantity >
                  currentQuantity
                ) {
                  toast.error(
                    `Yetersiz stok. Mevcut stok: ${currentQuantity} ${
                      selected.products
                        ?.unit ?? ""
                    }`,
                  );

                  return;
                }

                /*
                 * =========================================
                 * REFERANS
                 * =========================================
                 */

                const referenceNo =
                  String(
                    form.get(
                      "reference_no",
                    ) ?? "",
                  ).trim();

                /*
                 * =========================================
                 * AÇIKLAMA
                 * =========================================
                 */

                const description =
                  String(
                    form.get(
                      "description",
                    ) ?? "",
                  ).trim();

                /*
                 * =========================================
                 * RPC
                 * =========================================
                 */

                transfer.mutate({
                  product_id:
                    selected.product_id,

                  source_warehouse_id:
                    selected.warehouse_id,

                  source_location_id:
                    selected.location_id,

                  destination_warehouse_id:
                    destinationWarehouseId,

                  destination_location_id:
                    destinationLocationId ||
                    null,

                  quantity,

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
               * KAYNAK STOK
               * =================================================
               */}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="transfer-source">
                  Kaynak Stok
                </Label>

                <Select
                  name="inventory_id"
                >
                  <SelectTrigger id="transfer-source">
                    <SelectValue placeholder="Transfer edilecek stok kaydını seçin" />
                  </SelectTrigger>

                  <SelectContent>
                    {(inventory.data ?? []).map(
                      (item) => (
                        <SelectItem
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {item.products
                            ?.code ??
                            "—"}{" "}
                          -{" "}
                          {item.products
                            ?.name ??
                            "Bilinmeyen Ürün"}{" "}
                          |{" "}
                          {item.warehouses
                            ?.name ??
                            "Bilinmeyen Depo"}{" "}
                          {item.warehouse_locations
                            ?.code
                            ? `| Raf ${item.warehouse_locations.code}`
                            : ""}{" "}
                          |{" "}
                          {Number(
                            item.quantity,
                          )}{" "}
                          {item.products
                            ?.unit ?? ""}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/*
               * =================================================
               * HEDEF DEPO
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="transfer-destination">
                  Hedef Depo
                </Label>

                <Select
                  name="destination_warehouse_id"
                  onValueChange={(value) => {
                    setSelectedDestinationWarehouseId(
                      value,
                    );
                  }}
                >
                  <SelectTrigger id="transfer-destination">
                    <SelectValue placeholder="Hedef depo seçin" />
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
               * HEDEF RAF
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="transfer-destination-location">
                  Hedef Raf / Konum
                </Label>

                <Select
                  name="destination_location_id"
                  disabled={
                    !selectedDestinationWarehouseId ||
                    destinationLocations.length ===
                      0
                  }
                >
                  <SelectTrigger id="transfer-destination-location">
                    <SelectValue
                      placeholder={
                        !selectedDestinationWarehouseId
                          ? "Önce hedef depo seçin"
                          : destinationLocations.length ===
                              0
                            ? "Bu depoda raf yok"
                            : "Hedef raf seçin (opsiyonel)"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {destinationLocations.map(
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
                <Label htmlFor="transfer-quantity">
                  Transfer Miktarı
                </Label>

                <Input
                  id="transfer-quantity"
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  placeholder="Örn. 20"
                />
              </div>

              {/*
               * =================================================
               * REFERANS
               * =================================================
               */}

              <div className="space-y-2">
                <Label htmlFor="transfer-reference">
                  Referans No
                </Label>

                <Input
                  id="transfer-reference"
                  name="reference_no"
                  placeholder="Örn. TRF-2026-001"
                />
              </div>

              {/*
               * =================================================
               * AÇIKLAMA
               * =================================================
               */}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="transfer-description">
                  Açıklama
                </Label>

                <Textarea
                  id="transfer-description"
                  name="description"
                  rows={3}
                  placeholder="Transfer hakkında açıklama..."
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
                    transfer.isPending ||
                    inventory.isLoading ||
                    warehouses.isLoading ||
                    locations.isLoading ||
                    (inventory.data ?? [])
                      .length === 0
                  }
                >
                  <ArrowRightLeft className="mr-2 size-4" />

                  {transfer.isPending
                    ? "Transfer ediliyor..."
                    : "Transfer Yap"}
                </Button>
              </div>
            </form>

            {!inventory.isLoading &&
            (inventory.data ?? [])
              .length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Transfer edilebilecek stok bulunmuyor.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}