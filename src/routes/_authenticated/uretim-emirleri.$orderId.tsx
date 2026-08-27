import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Factory,
  PackageCheck,
  Warehouse,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute(
  "/_authenticated/uretim-emirleri/$orderId",
)({
  head: () => ({
    meta: [
      {
        title: "Üretim Emri Detayı | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content: "Üretim emri detaylarını ve hareketlerini görüntüleyin.",
      },
    ],
  }),

  component: ProductionOrderDetailPage,
});

type ProductionOrderStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

type ProductionPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type ProductionOrder = {
  id: string;
  order_no: string;
  product_id: string;
  bill_of_material_id: string | null;
  planned_quantity: number;
  produced_quantity: number;
  status: ProductionOrderStatus;
  priority: ProductionPriority;
  planned_start_at: string | null;
  planned_end_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  output_warehouse_id: string | null;
  output_location_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type RecipeRow = {
  id: string;
  code: string;
  name: string;
  version: number;
  output_quantity: number;
};

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
};

type LocationRow = {
  id: string;
  code: string;
  warehouse_id: string;
};

type BomItemRow = {
  id: string;
  material_product_id: string;
  quantity: number;
  waste_percentage: number;
  sequence_no: number;
  description: string | null;
};

type ConsumptionRow = {
  id: string;
  product_id: string;
  warehouse_id: string;
  location_id: string | null;
  planned_quantity: number;
  consumed_quantity: number;
  performed_by: string | null;
  description: string | null;
  created_at: string;
};

type OutputRow = {
  id: string;
  product_id: string;
  warehouse_id: string;
  location_id: string | null;
  quantity: number;
  performed_by: string | null;
  description: string | null;
  created_at: string;
};

type MovementRow = {
  id: string;
  product_id: string;
  movement_type: string;
  source_warehouse_id: string | null;
  source_location_id: string | null;
  destination_warehouse_id: string | null;
  destination_location_id: string | null;
  quantity: number;
  reference_no: string | null;
  description: string | null;
  performed_by: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type DetailData = {
  order: ProductionOrder;
  product: ProductRow | null;
  recipe: RecipeRow | null;
  warehouse: WarehouseRow | null;
  location: LocationRow | null;
  bomItems: BomItemRow[];
  consumptions: ConsumptionRow[];
  outputs: OutputRow[];
  movements: MovementRow[];
  products: ProductRow[];
  warehouses: WarehouseRow[];
  locations: LocationRow[];
  profiles: ProfileRow[];
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

function priorityLabel(priority: ProductionPriority) {
  switch (priority) {
    case "low":
      return "Düşük";
    case "normal":
      return "Normal";
    case "high":
      return "Yüksek";
    case "urgent":
      return "Acil";
    default:
      return priority;
  }
}

function movementLabel(type: string) {
  switch (type) {
    case "production_consumption":
      return "Üretim Tüketimi";
    case "production_entry":
      return "Üretim Girişi";
    case "entry":
      return "Giriş";
    case "exit":
      return "Çıkış";
    case "transfer":
      return "Transfer";
    default:
      return type;
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

function ProductionOrderDetailPage() {
  const { orderId } = Route.useParams();

  const detailQuery = useQuery<DetailData>({
    queryKey: ["production-order-detail", orderId],

    queryFn: async () => {
      const { data: orderData, error: orderError } = await db
        .from("production_orders")
        .select(`
          id,
          order_no,
          product_id,
          bill_of_material_id,
          planned_quantity,
          produced_quantity,
          status,
          priority,
          planned_start_at,
          planned_end_at,
          started_at,
          completed_at,
          output_warehouse_id,
          output_location_id,
          description,
          created_by,
          created_at
        `)
        .eq("id", orderId)
        .is("deleted_at", null)
        .single();

      if (orderError) {
        throw orderError;
      }

      const order: ProductionOrder = {
        ...orderData,
        planned_quantity: Number(orderData.planned_quantity ?? 0),
        produced_quantity: Number(orderData.produced_quantity ?? 0),
      };

      const [
        productResult,
        recipeResult,
        warehouseResult,
        locationResult,
        consumptionsResult,
        outputsResult,
        movementsResult,
      ] = await Promise.all([
        db
          .from("products")
          .select("id, code, name, unit")
          .eq("id", order.product_id)
          .maybeSingle(),

        order.bill_of_material_id
          ? db
              .from("bill_of_materials")
              .select("id, code, name, version, output_quantity")
              .eq("id", order.bill_of_material_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        order.output_warehouse_id
          ? db
              .from("warehouses")
              .select("id, code, name")
              .eq("id", order.output_warehouse_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        order.output_location_id
          ? db
              .from("warehouse_locations")
              .select("id, code, warehouse_id")
              .eq("id", order.output_location_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        db
          .from("production_consumptions")
          .select(`
            id,
            product_id,
            warehouse_id,
            location_id,
            planned_quantity,
            consumed_quantity,
            performed_by,
            description,
            created_at
          `)
          .eq("production_order_id", orderId)
          .order("created_at"),

        db
          .from("production_outputs")
          .select(`
            id,
            product_id,
            warehouse_id,
            location_id,
            quantity,
            performed_by,
            description,
            created_at
          `)
          .eq("production_order_id", orderId)
          .order("created_at"),

        db
          .from("stock_movements")
          .select(`
            id,
            product_id,
            movement_type,
            source_warehouse_id,
            source_location_id,
            destination_warehouse_id,
            destination_location_id,
            quantity,
            reference_no,
            description,
            performed_by,
            created_at
          `)
          .eq("reference_no", order.order_no)
          .order("created_at"),
      ]);

      for (const result of [
        productResult,
        recipeResult,
        warehouseResult,
        locationResult,
        consumptionsResult,
        outputsResult,
        movementsResult,
      ]) {
        if (result.error) {
          throw result.error;
        }
      }

      let bomItems: BomItemRow[] = [];

      if (order.bill_of_material_id) {
        const { data, error } = await db
          .from("bill_of_material_items")
          .select(`
            id,
            material_product_id,
            quantity,
            waste_percentage,
            sequence_no,
            description
          `)
          .eq("bill_of_material_id", order.bill_of_material_id)
          .order("sequence_no");

        if (error) {
          throw error;
        }

        bomItems = (data ?? []).map((item: any) => ({
          id: item.id,
          material_product_id: item.material_product_id,
          quantity: Number(item.quantity ?? 0),
          waste_percentage: Number(item.waste_percentage ?? 0),
          sequence_no: Number(item.sequence_no ?? 1),
          description: item.description ?? null,
        }));
      }

      const productIds = [
        order.product_id,
        ...bomItems.map((item) => item.material_product_id),
        ...(consumptionsResult.data ?? []).map((item: any) => item.product_id),
        ...(outputsResult.data ?? []).map((item: any) => item.product_id),
        ...(movementsResult.data ?? []).map((item: any) => item.product_id),
      ].filter(Boolean);

      const warehouseIds = [
        order.output_warehouse_id,
        ...(consumptionsResult.data ?? []).map((item: any) => item.warehouse_id),
        ...(outputsResult.data ?? []).map((item: any) => item.warehouse_id),
        ...(movementsResult.data ?? []).flatMap((item: any) => [
          item.source_warehouse_id,
          item.destination_warehouse_id,
        ]),
      ].filter(Boolean);

      const locationIds = [
        order.output_location_id,
        ...(consumptionsResult.data ?? []).map((item: any) => item.location_id),
        ...(outputsResult.data ?? []).map((item: any) => item.location_id),
        ...(movementsResult.data ?? []).flatMap((item: any) => [
          item.source_location_id,
          item.destination_location_id,
        ]),
      ].filter(Boolean);

      const profileIds = [
        order.created_by,
        ...(consumptionsResult.data ?? []).map((item: any) => item.performed_by),
        ...(outputsResult.data ?? []).map((item: any) => item.performed_by),
        ...(movementsResult.data ?? []).map((item: any) => item.performed_by),
      ].filter(Boolean);

      const [productsResult, warehousesResult, locationsResult, profilesResult] =
        await Promise.all([
          productIds.length
            ? db
                .from("products")
                .select("id, code, name, unit")
                .in("id", [...new Set(productIds)])
            : Promise.resolve({ data: [], error: null }),

          warehouseIds.length
            ? db
                .from("warehouses")
                .select("id, code, name")
                .in("id", [...new Set(warehouseIds)])
            : Promise.resolve({ data: [], error: null }),

          locationIds.length
            ? db
                .from("warehouse_locations")
                .select("id, code, warehouse_id")
                .in("id", [...new Set(locationIds)])
            : Promise.resolve({ data: [], error: null }),

          profileIds.length
            ? db
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", [...new Set(profileIds)])
            : Promise.resolve({ data: [], error: null }),
        ]);

      for (const result of [
        productsResult,
        warehousesResult,
        locationsResult,
        profilesResult,
      ]) {
        if (result.error) {
          throw result.error;
        }
      }

      return {
        order,
        product: productResult.data as ProductRow | null,
        recipe: recipeResult.data
          ? {
              ...recipeResult.data,
              version: Number(recipeResult.data.version ?? 1),
              output_quantity: Number(recipeResult.data.output_quantity ?? 1),
            }
          : null,
        warehouse: warehouseResult.data as WarehouseRow | null,
        location: locationResult.data as LocationRow | null,
        bomItems,
        consumptions: (consumptionsResult.data ?? []).map((item: any) => ({
          ...item,
          planned_quantity: Number(item.planned_quantity ?? 0),
          consumed_quantity: Number(item.consumed_quantity ?? 0),
        })),
        outputs: (outputsResult.data ?? []).map((item: any) => ({
          ...item,
          quantity: Number(item.quantity ?? 0),
        })),
        movements: (movementsResult.data ?? []).map((item: any) => ({
          ...item,
          quantity: Number(item.quantity ?? 0),
        })),
        products: (productsResult.data ?? []) as ProductRow[],
        warehouses: (warehousesResult.data ?? []) as WarehouseRow[],
        locations: (locationsResult.data ?? []) as LocationRow[],
        profiles: (profilesResult.data ?? []) as ProfileRow[],
      };
    },
  });

  if (detailQuery.isLoading) {
    return (
      <>
        <PageHeader
          title="Üretim Emri Detayı"
          description="Üretim emri bilgileri yükleniyor."
        />

        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Üretim emri yükleniyor...
        </div>
      </>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <>
        <PageHeader
          title="Üretim Emri Detayı"
          description="Üretim emri bilgileri yüklenemedi."
        />

        <ErrorState
          onRetry={() => {
            void detailQuery.refetch();
          }}
        />
      </>
    );
  }

  const {
    order,
    product,
    recipe,
    warehouse,
    location,
    bomItems,
    consumptions,
    outputs,
    movements,
    products,
    warehouses,
    locations,
    profiles,
  } = detailQuery.data;

  const productMap = new Map(products.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((item) => [item.id, item]));
  const locationMap = new Map(locations.map((item) => [item.id, item]));
  const profileMap = new Map(
    profiles.map((item) => [
      item.id,
      `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim() || "—",
    ]),
  );

  const consumptionTotal = consumptions.reduce(
    (sum, item) => sum + item.consumed_quantity,
    0,
  );

  const outputTotal = outputs.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <>
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link to="/uretim-emirleri">
            <ArrowLeft className="mr-2 size-4" />
            Üretim Emirlerine Dön
          </Link>
        </Button>
      </div>

      <PageHeader
        title={order.order_no}
        description="Üretim emri, reçete, tüketim ve mamul giriş detayları."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="outline">
          {statusLabel(order.status)}
        </Badge>

        <Badge variant="secondary">
          Öncelik: {priorityLabel(order.priority)}
        </Badge>

        {recipe ? (
          <Badge variant="outline">
            {recipe.code} v{recipe.version}
          </Badge>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mamul
            </CardTitle>

            <Factory className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="font-semibold">
              {product
                ? `${product.code} - ${product.name}`
                : "—"}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {recipe
                ? `${recipe.code} / v${recipe.version}`
                : "Reçete yok"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Planlanan / Üretilen
            </CardTitle>

            <PackageCheck className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-xl font-bold">
              {order.planned_quantity} / {order.produced_quantity}
            </div>

            <p className="text-xs text-muted-foreground">
              {product?.unit ?? ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Hedef
            </CardTitle>

            <Warehouse className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="font-semibold">
              {warehouse?.name ?? "—"}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {location ? `Raf: ${location.code}` : "Raf seçilmemiş"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tüketim / Çıktı
            </CardTitle>

            <Boxes className="size-4 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-xl font-bold">
              {consumptionTotal} / {outputTotal}
            </div>

            <p className="text-xs text-muted-foreground">
              Toplam tüketim / çıktı
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Planlama Bilgileri</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Oluşturulma" value={formatDate(order.created_at)} />
            <Info label="Planlanan Başlangıç" value={formatDate(order.planned_start_at)} />
            <Info label="Planlanan Bitiş" value={formatDate(order.planned_end_at)} />
            <Info label="Gerçek Başlangıç" value={formatDate(order.started_at)} />
            <Info label="Tamamlanma" value={formatDate(order.completed_at)} />
            <Info
              label="Oluşturan"
              value={
                order.created_by
                  ? profileMap.get(order.created_by) ?? "—"
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Açıklama</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              {order.description || "Açıklama girilmemiş."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reçete / BOM</CardTitle>
        </CardHeader>

        <CardContent>
          {bomItems.length === 0 ? (
            <EmptyText text="Bu üretim emrinin reçetesinde malzeme bulunmuyor." />
          ) : (
            <div className="space-y-2">
              {bomItems.map((item) => {
                const material = productMap.get(item.material_product_id);

                const requiredForOrder = recipe
                  ? item.quantity *
                    (1 + item.waste_percentage / 100) *
                    (order.planned_quantity / recipe.output_quantity)
                  : 0;

                return (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[60px_1fr_140px_140px]"
                  >
                    <div className="text-sm text-muted-foreground">
                      #{item.sequence_no}
                    </div>

                    <div>
                      <div className="font-medium">
                        {material
                          ? `${material.code} - ${material.name}`
                          : "Bilinmeyen Malzeme"}
                      </div>

                      {item.description ? (
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-sm">
                      Reçete: {item.quantity} {material?.unit ?? ""}
                      {item.waste_percentage > 0
                        ? ` + %${item.waste_percentage}`
                        : ""}
                    </div>

                    <div className="font-medium">
                      Gereken: {requiredForOrder.toFixed(3)} {material?.unit ?? ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gerçek Hammadde Tüketimleri</CardTitle>
        </CardHeader>

        <CardContent>
          {consumptions.length === 0 ? (
            <EmptyText text="Henüz hammadde tüketimi oluşmamış." />
          ) : (
            <div className="space-y-2">
              {consumptions.map((item) => {
                const material = productMap.get(item.product_id);
                const sourceWarehouse = warehouseMap.get(item.warehouse_id);
                const sourceLocation = item.location_id
                  ? locationMap.get(item.location_id)
                  : null;

                return (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_180px_140px_160px]"
                  >
                    <div>
                      <div className="font-medium">
                        {material
                          ? `${material.code} - ${material.name}`
                          : "Bilinmeyen Malzeme"}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </div>
                    </div>

                    <div className="text-sm">
                      {sourceWarehouse?.name ?? "—"}
                      {sourceLocation ? ` / ${sourceLocation.code}` : ""}
                    </div>

                    <div className="font-semibold">
                      {item.consumed_quantity} {material?.unit ?? ""}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {item.performed_by
                        ? profileMap.get(item.performed_by) ?? "—"
                        : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Üretim Çıktıları</CardTitle>
        </CardHeader>

        <CardContent>
          {outputs.length === 0 ? (
            <EmptyText text="Henüz mamul girişi oluşmamış." />
          ) : (
            <div className="space-y-2">
              {outputs.map((item) => {
                const outputProduct = productMap.get(item.product_id);
                const outputWarehouse = warehouseMap.get(item.warehouse_id);
                const outputLocation = item.location_id
                  ? locationMap.get(item.location_id)
                  : null;

                return (
                  <div
                    key={item.id}
                    className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_180px_140px_160px]"
                  >
                    <div>
                      <div className="font-medium">
                        {outputProduct
                          ? `${outputProduct.code} - ${outputProduct.name}`
                          : "Bilinmeyen Mamul"}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </div>
                    </div>

                    <div className="text-sm">
                      {outputWarehouse?.name ?? "—"}
                      {outputLocation ? ` / ${outputLocation.code}` : ""}
                    </div>

                    <div className="font-semibold">
                      +{item.quantity} {outputProduct?.unit ?? ""}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {item.performed_by
                        ? profileMap.get(item.performed_by) ?? "—"
                        : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stok Hareketleri</CardTitle>
        </CardHeader>

        <CardContent>
          {movements.length === 0 ? (
            <EmptyText text="Bu üretim emrine ait stok hareketi bulunmuyor." />
          ) : (
            <div className="space-y-2">
              {movements.map((movement) => {
                const movementProduct = productMap.get(movement.product_id);

                const sourceWarehouse = movement.source_warehouse_id
                  ? warehouseMap.get(movement.source_warehouse_id)
                  : null;

                const sourceLocation = movement.source_location_id
                  ? locationMap.get(movement.source_location_id)
                  : null;

                const destinationWarehouse = movement.destination_warehouse_id
                  ? warehouseMap.get(movement.destination_warehouse_id)
                  : null;

                const destinationLocation = movement.destination_location_id
                  ? locationMap.get(movement.destination_location_id)
                  : null;

                return (
                  <div
                    key={movement.id}
                    className="grid gap-2 rounded-lg border p-3 xl:grid-cols-[160px_1fr_200px_200px_140px]"
                  >
                    <div>
                      <Badge variant="outline">
                        {movementLabel(movement.movement_type)}
                      </Badge>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(movement.created_at)}
                      </div>
                    </div>

                    <div className="font-medium">
                      {movementProduct
                        ? `${movementProduct.code} - ${movementProduct.name}`
                        : "—"}
                    </div>

                    <div className="text-sm">
                      Kaynak:{" "}
                      {sourceWarehouse?.name ?? "—"}
                      {sourceLocation ? ` / ${sourceLocation.code}` : ""}
                    </div>

                    <div className="text-sm">
                      Hedef:{" "}
                      {destinationWarehouse?.name ?? "—"}
                      {destinationLocation
                        ? ` / ${destinationLocation.code}`
                        : ""}
                    </div>

                    <div className="font-semibold">
                      {movement.quantity} {movementProduct?.unit ?? ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

function EmptyText({
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