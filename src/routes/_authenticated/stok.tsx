import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Download,
  PackageCheck,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/stok")({
  head: () => ({
    meta: [
      {
        title: "Stok Durumu | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Fabrika genelindeki ürün ve depo stok durumlarını görüntüleyin.",
      },
    ],
  }),

  component: StockPage,
});

type StockRow = {
  id: string;

  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;

  minimum_stock: number;
  maximum_stock: number | null;

  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;

  location_id: string | null;
  location_code: string | null;

  quantity: number;

  status:
    | "out"
    | "critical"
    | "normal"
    | "high";
};

const db = supabase as any;

function getStockStatus(
  quantity: number,
  minimumStock: number,
  maximumStock: number | null,
): StockRow["status"] {
  if (quantity <= 0) {
    return "out";
  }

  if (
    minimumStock > 0 &&
    quantity <= minimumStock
  ) {
    return "critical";
  }

  if (
    maximumStock !== null &&
    quantity > maximumStock
  ) {
    return "high";
  }

  return "normal";
}

function stockStatusLabel(
  status: StockRow["status"],
) {
  switch (status) {
    case "out":
      return "Stok Yok";

    case "critical":
      return "Kritik Stok";

    case "high":
      return "Fazla Stok";

    case "normal":
      return "Normal";

    default:
      return status;
  }
}

function StockStatusBadge({
  status,
}: {
  status: StockRow["status"];
}) {
  if (status === "out") {
    return (
      <Badge variant="destructive">
        Stok Yok
      </Badge>
    );
  }

  if (status === "critical") {
    return (
      <Badge
        variant="outline"
        className="border-orange-500 text-orange-600"
      >
        Kritik Stok
      </Badge>
    );
  }

  if (status === "high") {
    return (
      <Badge variant="secondary">
        Fazla Stok
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-green-500 text-green-600"
    >
      Normal
    </Badge>
  );
}

function escapeCsvValue(
  value: string | number | null,
) {
  if (value === null) {
    return "";
  }

  const text =
    String(value);

  const escaped =
    text.replace(
      /"/g,
      '""',
    );

  return `"${escaped}"`;
}

function exportStockCsv(
  rows: StockRow[],
) {
  if (rows.length === 0) {
    toast.error(
      "Dışa aktarılacak stok kaydı bulunmuyor.",
    );

    return;
  }

  const headers = [
    "Ürün Kodu",
    "Ürün",
    "Depo Kodu",
    "Depo",
    "Raf / Konum",
    "Mevcut Stok",
    "Birim",
    "Minimum Stok",
    "Maksimum Stok",
    "Durum",
  ];

  const csvRows = rows.map(
    (row) => [
      row.product_code,
      row.product_name,
      row.warehouse_code,
      row.warehouse_name,
      row.location_code ?? "",
      row.quantity,
      row.unit,
      row.minimum_stock,
      row.maximum_stock ?? "",
      stockStatusLabel(
        row.status,
      ),
    ],
  );

  const csvContent = [
    headers
      .map(
        escapeCsvValue,
      )
      .join(";"),

    ...csvRows.map(
      (row) =>
        row
          .map(
            escapeCsvValue,
          )
          .join(";"),
    ),
  ].join("\n");

  /*
   * Excel'in Türkçe karakterleri
   * doğru açması için UTF-8 BOM ekliyoruz.
   */

  const bom =
    "\uFEFF";

  const blob =
    new Blob(
      [
        bom +
          csvContent,
      ],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  const now =
    new Date();

  const date =
    `${now
      .getFullYear()}-${String(
      now.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    )}-${String(
      now.getDate(),
    ).padStart(
      2,
      "0",
    )}`;

  link.href =
    url;

  link.download =
    `stok-raporu-${date}.csv`;

  document.body.appendChild(
    link,
  );

  link.click();

  document.body.removeChild(
    link,
  );

  URL.revokeObjectURL(
    url,
  );

  toast.success(
    "Stok raporu CSV olarak indirildi.",
  );
}

function StockPage() {
  /*
   * =====================================================
   * STOK VERİLERİ
   * =====================================================
   */

  const stockQuery = useQuery<StockRow[]>({
    queryKey: ["inventory-stock-list"],

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
            unit,
            minimum_stock,
            maximum_stock
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
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const rows: StockRow[] = (
        data ?? []
      ).map((item: any) => {
        const product =
          item.products;

        const warehouse =
          item.warehouses;

        const location =
          item.warehouse_locations;

        const quantity =
          Number(
            item.quantity ??
              0,
          );

        const minimumStock =
          Number(
            product?.minimum_stock ??
              0,
          );

        const maximumStock =
          product?.maximum_stock ===
            null ||
          product?.maximum_stock ===
            undefined
            ? null
            : Number(
                product.maximum_stock,
              );

        return {
          id: item.id,

          product_id:
            item.product_id,

          product_code:
            product?.code ??
            "—",

          product_name:
            product?.name ??
            "Bilinmeyen Ürün",

          unit:
            product?.unit ??
            "Adet",

          minimum_stock:
            minimumStock,

          maximum_stock:
            maximumStock,

          warehouse_id:
            item.warehouse_id,

          warehouse_code:
            warehouse?.code ??
            "—",

          warehouse_name:
            warehouse?.name ??
            "Bilinmeyen Depo",

          location_id:
            item.location_id ??
            null,

          location_code:
            location?.code ??
            null,

          quantity,

          status:
            getStockStatus(
              quantity,
              minimumStock,
              maximumStock,
            ),
        };
      });

      return rows;
    },
  });

  const rows =
    stockQuery.data ??
    [];

  /*
   * =====================================================
   * ÖZETLER
   * =====================================================
   */

  const totalStockRecords =
    rows.length;

  const criticalCount =
    rows.filter(
      (row) =>
        row.status ===
        "critical",
    ).length;

  const outOfStockCount =
    rows.filter(
      (row) =>
        row.status ===
        "out",
    ).length;

  const warehouseCount =
    new Set(
      rows.map(
        (row) =>
          row.warehouse_id,
      ),
    ).size;

  /*
   * =====================================================
   * TABLO
   * =====================================================
   */

  const columns: Column<StockRow>[] = [
    {
      id: "product_code",

      header: "Ürün Kodu",

      cell: (row) => (
        <span className="font-mono text-sm">
          {
            row.product_code
          }
        </span>
      ),

      value: (row) =>
        row.product_code,

      sortable: true,
    },

    {
      id: "product_name",

      header: "Ürün",

      cell: (row) => (
        <div>
          <div className="font-medium">
            {
              row.product_name
            }
          </div>

          <div className="text-xs text-muted-foreground">
            {row.unit}
          </div>
        </div>
      ),

      value: (row) =>
        row.product_name,

      sortable: true,
    },

    {
      id: "warehouse",

      header: "Depo",

      cell: (row) => (
        <div>
          <div>
            {
              row.warehouse_name
            }
          </div>

          <div className="text-xs text-muted-foreground">
            {
              row.warehouse_code
            }
          </div>
        </div>
      ),

      value: (row) =>
        row.warehouse_name,

      sortable: true,
    },

    {
      id: "location",

      header: "Raf / Konum",

      cell: (row) =>
        row.location_code ??
        "—",

      value: (row) =>
        row.location_code ??
        "",
    },

    {
      id: "quantity",

      header: "Mevcut Stok",

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
      id: "minimum",

      header: "Min. Stok",

      cell: (row) =>
        `${row.minimum_stock} ${row.unit}`,

      value: (row) =>
        row.minimum_stock,

      sortable: true,
    },

    {
      id: "maximum",

      header: "Maks. Stok",

      cell: (row) =>
        row.maximum_stock !==
        null
          ? `${row.maximum_stock} ${row.unit}`
          : "—",

      value: (row) =>
        row.maximum_stock ??
        0,

      sortable: true,
    },

    {
      id: "status",

      header: "Durum",

      cell: (row) => (
        <StockStatusBadge
          status={
            row.status
          }
        />
      ),

      value: (row) =>
        stockStatusLabel(
          row.status,
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stok Durumu"
        description="Ürünlerin tüm depolardaki mevcut stok miktarlarını takip edin."
      />

      {/*
       * =================================================
       * ÖZET KARTLARI
       * =================================================
       */}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Stok Kayıtları
            </CardTitle>

            <Boxes className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {
                totalStockRecords
              }
            </div>

            <p className="text-xs text-muted-foreground">
              Ürün / depo kaydı
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Aktif Depolar
            </CardTitle>

            <Warehouse className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {
                warehouseCount
              }
            </div>

            <p className="text-xs text-muted-foreground">
              Stok bulunan depo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Kritik Stok
            </CardTitle>

            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {
                criticalCount
              }
            </div>

            <p className="text-xs text-muted-foreground">
              Minimum seviyede
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Stok Yok
            </CardTitle>

            <PackageCheck className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {
                outOfStockCount
              }
            </div>

            <p className="text-xs text-muted-foreground">
              Tükenen stok kaydı
            </p>
          </CardContent>
        </Card>
      </div>

      {/*
       * =================================================
       * STOK TABLOSU
       * =================================================
       */}

      {stockQuery.isError ? (
        <ErrorState
          onRetry={() => {
            void stockQuery.refetch();
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) =>
            row.id
          }
          loading={
            stockQuery.isLoading
          }
          searchPlaceholder="Ürün, ürün kodu, depo veya raf ara..."
          mobileTitle={(row) =>
            row.product_name
          }
          emptyTitle="Henüz stok hareketi yok"
          emptyDescription="Bir ürüne stok girişi yapıldığında burada görüntülenecek."
          toolbar={
            <Button
              variant="outline"
              disabled={
                stockQuery.isLoading ||
                rows.length === 0
              }
              onClick={() => {
                exportStockCsv(
                  rows,
                );
              }}
            >
              <Download className="mr-2 size-4" />

              CSV Dışa Aktar
            </Button>
          }
        />
      )}
    </>
  );
}