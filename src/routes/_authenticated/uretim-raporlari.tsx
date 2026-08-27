import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  Clock3,
  Factory,
  PackageCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/uretim-raporlari")({
  head: () => ({
    meta: [
      {
        title: "Üretim Raporları | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Üretim performansı ve üretim özetlerini görüntüleyin.",
      },
    ],
  }),

  component: ProductionReportsPage,
});

type ProductionOrderStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

type ProductionOrderRow = {
  id: string;
  order_no: string;
  product_id: string;
  planned_quantity: number;
  produced_quantity: number;
  status: ProductionOrderStatus;
  created_at: string;
  completed_at: string | null;
};

type ConsumptionRow = {
  id: string;
  production_order_id: string;
  product_id: string;
  consumed_quantity: number;
  created_at: string;
};

type OutputRow = {
  id: string;
  production_order_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function ProductionReportsPage() {
  const orders = useQuery<ProductionOrderRow[]>({
    queryKey: ["production-report-orders"],

    queryFn: async () => {
      const { data, error } = await db
        .from("production_orders")
        .select(`
          id,
          order_no,
          product_id,
          planned_quantity,
          produced_quantity,
          status,
          created_at,
          completed_at
        `)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []).map((item: any) => ({
        id: item.id,
        order_no: item.order_no,
        product_id: item.product_id,
        planned_quantity: Number(item.planned_quantity ?? 0),
        produced_quantity: Number(item.produced_quantity ?? 0),
        status: item.status as ProductionOrderStatus,
        created_at: item.created_at,
        completed_at: item.completed_at ?? null,
      }));
    },
  });

  const consumptions = useQuery<ConsumptionRow[]>({
    queryKey: ["production-report-consumptions"],

    queryFn: async () => {
      const { data, error } = await db
        .from("production_consumptions")
        .select(`
          id,
          production_order_id,
          product_id,
          consumed_quantity,
          created_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []).map((item: any) => ({
        id: item.id,
        production_order_id: item.production_order_id,
        product_id: item.product_id,
        consumed_quantity: Number(item.consumed_quantity ?? 0),
        created_at: item.created_at,
      }));
    },
  });

  const outputs = useQuery<OutputRow[]>({
    queryKey: ["production-report-outputs"],

    queryFn: async () => {
      const { data, error } = await db
        .from("production_outputs")
        .select(`
          id,
          production_order_id,
          product_id,
          quantity,
          created_at
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return (data ?? []).map((item: any) => ({
        id: item.id,
        production_order_id: item.production_order_id,
        product_id: item.product_id,
        quantity: Number(item.quantity ?? 0),
        created_at: item.created_at,
      }));
    },
  });

  const products = useQuery<ProductRow[]>({
    queryKey: ["production-report-products"],

    queryFn: async () => {
      const { data, error } = await db
        .from("products")
        .select(`
          id,
          code,
          name,
          unit
        `)
        .is("deleted_at", null);

      if (error) {
        throw error;
      }

      return (data ?? []) as ProductRow[];
    },
  });

  if (
    orders.isError ||
    consumptions.isError ||
    outputs.isError ||
    products.isError
  ) {
    return (
      <>
        <PageHeader
          title="Üretim Raporları"
          description="Üretim performansı ve özet veriler."
        />

        <ErrorState
          onRetry={() => {
            void orders.refetch();
            void consumptions.refetch();
            void outputs.refetch();
            void products.refetch();
          }}
        />
      </>
    );
  }

  const orderRows = orders.data ?? [];
  const consumptionRows = consumptions.data ?? [];
  const outputRows = outputs.data ?? [];
  const productRows = products.data ?? [];

  const totalOrders = orderRows.length;

  const completedOrders = orderRows.filter(
    (item) => item.status === "completed",
  ).length;

  const inProgressOrders = orderRows.filter(
    (item) => item.status === "in_progress",
  ).length;

  const plannedOrders = orderRows.filter(
    (item) => item.status === "planned",
  ).length;

  const totalProduced = outputRows.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const totalConsumed = consumptionRows.reduce(
    (sum, item) => sum + item.consumed_quantity,
    0,
  );

  const productMap = new Map(
    productRows.map((product) => [
      product.id,
      product,
    ]),
  );

  const productionByProduct = new Map<
    string,
    number
  >();

  for (const output of outputRows) {
    productionByProduct.set(
      output.product_id,
      (productionByProduct.get(output.product_id) ?? 0) +
        output.quantity,
    );
  }

  const topProducedProducts = Array.from(
    productionByProduct.entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const recentOrders = orderRows.slice(0, 8);

  const recentConsumptions =
    consumptionRows.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Üretim Raporları"
        description="Üretim emirleri, mamul çıktıları ve hammadde tüketimlerini özetleyin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Toplam Emir
            </CardTitle>

            <Factory className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {totalOrders}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tamamlanan
            </CardTitle>

            <CheckCircle2 className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {completedOrders}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Üretimde
            </CardTitle>

            <Clock3 className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {inProgressOrders}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Planlanan: {plannedOrders}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Toplam Üretim
            </CardTitle>

            <PackageCheck className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {totalProduced}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Mamul çıktısı
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Hammadde Tüketimi
            </CardTitle>

            <Boxes className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {totalConsumed}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Toplam tüketim
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              En Çok Üretilen Ürünler
            </CardTitle>
          </CardHeader>

          <CardContent>
            {topProducedProducts.length === 0 ? (
              <EmptyState text="Henüz üretim çıktısı yok." />
            ) : (
              <div className="space-y-2">
                {topProducedProducts.map(
                  ([productId, quantity], index) => {
                    const product =
                      productMap.get(productId);

                    return (
                      <div
                        key={productId}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <div className="font-medium">
                            #{index + 1}{" "}
                            {product
                              ? `${product.code} - ${product.name}`
                              : "Bilinmeyen Ürün"}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Toplam üretim
                          </div>
                        </div>

                        <div className="font-semibold">
                          {quantity}{" "}
                          {product?.unit ?? ""}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Son Üretim Emirleri
            </CardTitle>
          </CardHeader>

          <CardContent>
            {recentOrders.length === 0 ? (
              <EmptyState text="Henüz üretim emri yok." />
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => {
                  const product =
                    productMap.get(
                      order.product_id,
                    );

                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-4 rounded-lg border p-3"
                    >
                      <div>
                        <div className="font-medium">
                          {order.order_no}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {product
                            ? `${product.code} - ${product.name}`
                            : "Bilinmeyen Ürün"}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(
                            order.completed_at ??
                              order.created_at,
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant="outline">
                          {statusLabel(
                            order.status,
                          )}
                        </Badge>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {order.produced_quantity} /{" "}
                          {order.planned_quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            Son Hammadde Tüketimleri
          </CardTitle>
        </CardHeader>

        <CardContent>
          {recentConsumptions.length === 0 ? (
            <EmptyState text="Henüz hammadde tüketimi yok." />
          ) : (
            <div className="space-y-2">
              {recentConsumptions.map(
                (consumption) => {
                  const product =
                    productMap.get(
                      consumption.product_id,
                    );

                  return (
                    <div
                      key={consumption.id}
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_180px_180px]"
                    >
                      <div>
                        <div className="font-medium">
                          {product
                            ? `${product.code} - ${product.name}`
                            : "Bilinmeyen Malzeme"}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {formatDate(
                            consumption.created_at,
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Emir ID:
                        <br />
                        <span className="font-mono text-xs">
                          {consumption.production_order_id.slice(
                            0,
                            8,
                          )}
                          ...
                        </span>
                      </div>

                      <div className="font-semibold">
                        {consumption.consumed_quantity}{" "}
                        {product?.unit ?? ""}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}