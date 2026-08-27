import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
} from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/stok-hareketleri")({
  head: () => ({
    meta: [
      {
        title: "Stok Hareketleri | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Tüm stok giriş, çıkış ve transfer hareketlerini görüntüleyin.",
      },
    ],
  }),

  component: StockMovementsPage,
});

type MovementType =
  | "entry"
  | "exit"
  | "transfer"
  | "adjustment"
  | "return"
  | "production_consumption"
  | "production_entry";

type StockMovementRaw = {
  id: string;
  movement_type: MovementType;
  product_id: string;

  source_warehouse_id: string | null;
  source_location_id: string | null;

  destination_warehouse_id: string | null;
  destination_location_id: string | null;

  quantity: number;

  reference_no: string | null;
  description: string | null;

  performed_by: string | null;
  created_at: string;

  products: {
    id: string;
    code: string;
    name: string;
    unit: string;
  } | null;

  source_warehouse: {
    id: string;
    name: string;
  } | null;

  destination_warehouse: {
    id: string;
    name: string;
  } | null;

  source_location: {
    id: string;
    code: string;
  } | null;

  destination_location: {
    id: string;
    code: string;
  } | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type StockMovementRow = {
  id: string;
  movement_type: MovementType;

  product_code: string;
  product_name: string;
  unit: string;

  source_warehouse_name: string | null;
  source_location_code: string | null;

  destination_warehouse_name: string | null;
  destination_location_code: string | null;

  quantity: number;

  reference_no: string | null;
  description: string | null;

  performed_by_name: string | null;

  created_at: string;
};

const db = supabase as any;

function movementLabel(type: MovementType) {
  switch (type) {
    case "entry":
      return "Giriş";

    case "exit":
      return "Çıkış";

    case "transfer":
      return "Transfer";

    case "adjustment":
      return "Düzeltme";

    case "return":
      return "İade";

    case "production_consumption":
      return "Üretim Tüketimi";

    case "production_entry":
      return "Üretim Girişi";

    default:
      return type;
  }
}

function MovementBadge({
  type,
}: {
  type: MovementType;
}) {
  if (type === "entry") {
    return (
      <Badge
        variant="outline"
        className="gap-1"
      >
        <ArrowDownToLine className="size-3.5" />
        Giriş
      </Badge>
    );
  }

  if (type === "exit") {
    return (
      <Badge
        variant="outline"
        className="gap-1"
      >
        <ArrowUpFromLine className="size-3.5" />
        Çıkış
      </Badge>
    );
  }

  if (type === "transfer") {
    return (
      <Badge
        variant="secondary"
        className="gap-1"
      >
        <ArrowRightLeft className="size-3.5" />
        Transfer
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {movementLabel(type)}
    </Badge>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        dateStyle: "short",
        timeStyle: "medium",
      },
    ).format(new Date(value));
  } catch {
    return value;
  }
}

function StockMovementsPage() {
  const movements = useQuery<
    StockMovementRow[]
  >({
    queryKey: ["stock-movements"],

    queryFn: async () => {
      /*
       * =================================================
       * 1. STOK HAREKETLERİNİ GETİR
       * =================================================
       */

      const {
        data: movementData,
        error: movementError,
      } = await db
        .from("stock_movements")
        .select(`
          id,
          movement_type,
          product_id,

          source_warehouse_id,
          source_location_id,

          destination_warehouse_id,
          destination_location_id,

          quantity,
          reference_no,
          description,
          performed_by,
          created_at,

          products (
            id,
            code,
            name,
            unit
          ),

          source_warehouse:warehouses!stock_movements_source_warehouse_id_fkey (
            id,
            name
          ),

          destination_warehouse:warehouses!stock_movements_destination_warehouse_id_fkey (
            id,
            name
          ),

          source_location:warehouse_locations!stock_movements_source_location_id_fkey (
            id,
            code
          ),

          destination_location:warehouse_locations!stock_movements_destination_location_id_fkey (
            id,
            code
          )
        `)
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

      if (movementError) {
        throw movementError;
      }

      const rawMovements =
        (movementData ??
          []) as StockMovementRaw[];

      /*
       * =================================================
       * 2. İŞLEMİ YAPAN KULLANICI ID'LERİNİ TOPLA
       * =================================================
       */

      const performerIds = [
        ...new Set(
          rawMovements
            .map(
              (movement) =>
                movement.performed_by,
            )
            .filter(
              (
                id,
              ): id is string =>
                Boolean(id),
            ),
        ),
      ];

      /*
       * =================================================
       * 3. PROFİLLERİ AYRI GETİR
       * =================================================
       */

      let profileMap =
        new Map<
          string,
          string
        >();

      if (
        performerIds.length >
        0
      ) {
        const {
          data: profileData,
          error: profileError,
        } = await db
          .from("profiles")
          .select(`
            id,
            first_name,
            last_name
          `)
          .in(
            "id",
            performerIds,
          );

        if (profileError) {
          throw profileError;
        }

        profileMap =
          new Map(
            (
              (profileData ??
                []) as ProfileRow[]
            ).map(
              (profile) => [
                profile.id,
                `${
                  profile.first_name ??
                  ""
                } ${
                  profile.last_name ??
                  ""
                }`.trim(),
              ],
            ),
          );
      }

      /*
       * =================================================
       * 4. TABLO VERİSİNİ OLUŞTUR
       * =================================================
       */

      return rawMovements.map(
        (
          movement,
        ): StockMovementRow => ({
          id:
            movement.id,

          movement_type:
            movement.movement_type,

          product_code:
            movement.products
              ?.code ??
            "—",

          product_name:
            movement.products
              ?.name ??
            "Bilinmeyen Ürün",

          unit:
            movement.products
              ?.unit ??
            "Adet",

          source_warehouse_name:
            movement
              .source_warehouse
              ?.name ??
            null,

          source_location_code:
            movement
              .source_location
              ?.code ??
            null,

          destination_warehouse_name:
            movement
              .destination_warehouse
              ?.name ??
            null,

          destination_location_code:
            movement
              .destination_location
              ?.code ??
            null,

          quantity:
            Number(
              movement.quantity ??
                0,
            ),

          reference_no:
            movement.reference_no ??
            null,

          description:
            movement.description ??
            null,

          performed_by_name:
            movement.performed_by
              ? profileMap.get(
                  movement.performed_by,
                ) ??
                null
              : null,

          created_at:
            movement.created_at,
        }),
      );
    },
  });

  const columns: Column<StockMovementRow>[] =
    [
      {
        id: "created_at",

        header: "Tarih",

        cell: (row) =>
          formatDate(
            row.created_at,
          ),

        value: (row) =>
          row.created_at,

        sortable: true,
      },

      {
        id: "movement_type",

        header: "İşlem",

        cell: (row) => (
          <MovementBadge
            type={
              row.movement_type
            }
          />
        ),

        value: (row) =>
          movementLabel(
            row.movement_type,
          ),

        sortable: true,
      },

      {
        id: "product",

        header: "Ürün",

        cell: (row) => (
          <div>
            <div className="font-medium">
              {
                row.product_name
              }
            </div>

            <div className="text-xs text-muted-foreground">
              {
                row.product_code
              }
            </div>
          </div>
        ),

        value: (row) =>
          `${row.product_code} ${row.product_name}`,

        sortable: true,
      },

      {
        id: "source",

        header: "Kaynak",

        cell: (row) => {
          if (
            !row.source_warehouse_name
          ) {
            return "—";
          }

          return (
            <div>
              <div>
                {
                  row.source_warehouse_name
                }
              </div>

              {row.source_location_code ? (
                <div className="text-xs text-muted-foreground">
                  Raf:{" "}
                  {
                    row.source_location_code
                  }
                </div>
              ) : null}
            </div>
          );
        },

        value: (row) =>
          `${
            row.source_warehouse_name ??
            ""
          } ${
            row.source_location_code ??
            ""
          }`,
      },

      {
        id: "destination",

        header: "Hedef",

        cell: (row) => {
          if (
            !row.destination_warehouse_name
          ) {
            return "—";
          }

          return (
            <div>
              <div>
                {
                  row.destination_warehouse_name
                }
              </div>

              {row.destination_location_code ? (
                <div className="text-xs text-muted-foreground">
                  Raf:{" "}
                  {
                    row.destination_location_code
                  }
                </div>
              ) : null}
            </div>
          );
        },

        value: (row) =>
          `${
            row.destination_warehouse_name ??
            ""
          } ${
            row.destination_location_code ??
            ""
          }`,
      },

      {
        id: "quantity",

        header: "Miktar",

        cell: (row) => (
          <span className="font-semibold">
            {row.quantity}{" "}
            {row.unit}
          </span>
        ),

        value: (row) =>
          row.quantity,

        sortable: true,
      },

      {
        id: "reference",

        header: "Referans",

        cell: (row) =>
          row.reference_no ??
          "—",

        value: (row) =>
          row.reference_no ??
          "",
      },

      {
        id: "performed_by",

        header: "İşlemi Yapan",

        cell: (row) =>
          row.performed_by_name ??
          "—",

        value: (row) =>
          row.performed_by_name ??
          "",
      },
    ];

  return (
    <>
      <PageHeader
        title="Stok Hareketleri"
        description="Tüm stok giriş, çıkış ve transfer işlemlerini geçmişe dönük takip edin."
      />

      {movements.isError ? (
        <ErrorState
          onRetry={() => {
            void movements.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={
            movements.data ??
            []
          }
          rowKey={(row) =>
            row.id
          }
          loading={
            movements.isLoading
          }
          searchPlaceholder="Ürün, referans, depo, raf veya işlem ara..."
          mobileTitle={(row) =>
            `${movementLabel(
              row.movement_type,
            )} - ${
              row.product_name
            }`
          }
          emptyTitle="Henüz stok hareketi yok"
          emptyDescription="Stok girişi, çıkışı veya transfer yapıldığında burada listelenecek."
        />
      )}
    </>
  );
}