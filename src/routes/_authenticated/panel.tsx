import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Boxes,
  CalendarClock,
  Factory,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  ErrorState,
  LoadingState,
} from "@/components/shared/states";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ROLE_LABELS,
  fullName,
} from "@/lib/permissions";

export const Route = createFileRoute(
  "/_authenticated/panel",
)({
  head: () => ({
    meta: [
      {
        title:
          "Panel | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Fabrikanın üretim, stok, bakım, satın alma ve personel durumunu tek ekrandan takip edin.",
      },
      {
        property: "og:title",
        content:
          "Panel | Fabrika Yönetim Sistemi",
      },
      {
        property: "og:description",
        content:
          "Fabrika genel durum özeti ve son hareketler.",
      },
    ],
  }),

  component: PanelPage,
});

const db = supabase as any;

type DashboardStats = {
  products: number;
  activeEmployees: number;
  departments: number;
  units: number;
  maintenanceMachines: number;
  openFaults: number;
  overdueMaintenance: number;
  openPurchaseOrders: number;
};

type MaintenancePlanRow = {
  id: string;
  machine_id: string;
  name: string;
  next_maintenance_date: string;
  priority: string;
  is_active: boolean;
};

type MachineRow = {
  id: string;
  code: string;
  name: string;
};

async function safeCount(
  queryFactory: () => PromiseLike<any>,
) {
  try {
    const result =
      await queryFactory();

    if (
      result?.error
    ) {
      console.warn(
        "Dashboard count query:",
        result.error,
      );

      return 0;
    }

    return (
      result?.count ??
      0
    );
  } catch (
    error
  ) {
    console.warn(
      "Dashboard count error:",
      error,
    );

    return 0;
  }
}

function priorityLabel(
  priority: string,
) {
  switch (
    priority
  ) {
    case "low":
      return "Düşük";

    case "normal":
      return "Normal";

    case "high":
      return "Yüksek";

    case "critical":
      return "Kritik";

    default:
      return priority;
  }
}

function priorityVariant(
  priority: string,
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline" {
  switch (
    priority
  ) {
    case "critical":
      return "destructive";

    case "high":
      return "secondary";

    case "normal":
      return "default";

    default:
      return "outline";
  }
}

function maintenanceStatus(
  date:
    string,
) {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  const target =
    new Date(
      `${date}T00:00:00`,
    );

  target.setHours(
    0,
    0,
    0,
    0,
  );

  const diff =
    Math.ceil(
      (
        target.getTime() -
        today.getTime()
      ) /
        (
          1000 *
          60 *
          60 *
          24
        ),
    );

  if (
    diff < 0
  ) {
    return {
      label:
        "Gecikmiş",
      variant:
        "destructive" as const,
    };
  }

  if (
    diff === 0
  ) {
    return {
      label:
        "Bugün",
      variant:
        "secondary" as const,
    };
  }

  if (
    diff <= 7
  ) {
    return {
      label:
        "Yaklaşıyor",
      variant:
        "secondary" as const,
    };
  }

  return {
    label:
      "Planlı",
    variant:
      "outline" as const,
  };
}

function PanelPage() {
  const {
    profile,
    roles,
    hasPermission,
  } =
    useAuth();

  /*
   * =====================================================
   * DASHBOARD SAYILARI
   * =====================================================
   */

  const stats =
    useQuery<DashboardStats>({
      queryKey: [
        "dashboard-stats-v2",
      ],

      queryFn:
        async () => {
          const today =
            new Date()
              .toISOString()
              .slice(
                0,
                10,
              );

          const [
            products,
            activeEmployees,
            departments,
            units,
            maintenanceMachines,
            openFaults,
            overdueMaintenance,
            openPurchaseOrders,
          ] =
            await Promise.all([
              safeCount(
                () =>
                  db
                    .from(
                      "products",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    )
                    .is(
                      "deleted_at",
                      null,
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "profiles",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    )
                    .eq(
                      "is_active",
                      true,
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "departments",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "units",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "machines",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    )
                    .is(
                      "deleted_at",
                      null,
                    )
                    .eq(
                      "status",
                      "maintenance",
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "machine_faults",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    )
                    .in(
                      "status",
                      [
                        "open",
                        "in_progress",
                      ],
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "maintenance_plans",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    )
                    .is(
                      "deleted_at",
                      null,
                    )
                    .eq(
                      "is_active",
                      true,
                    )
                    .lt(
                      "next_maintenance_date",
                      today,
                    ),
              ),

              safeCount(
                () =>
                  db
                    .from(
                      "purchase_orders",
                    )
                    .select(
                      "*",
                      {
                        count:
                          "exact",
                        head:
                          true,
                      },
                    )
                    .is(
                      "deleted_at",
                      null,
                    )
                    .in(
                      "status",
                      [
                        "draft",
                        "approved",
                        "ordered",
                        "partial",
                      ],
                    ),
              ),
            ]);

          return {
            products,
            activeEmployees,
            departments,
            units,
            maintenanceMachines,
            openFaults,
            overdueMaintenance,
            openPurchaseOrders,
          };
        },
    });

  /*
   * =====================================================
   * YAKLAŞAN BAKIMLAR
   * =====================================================
   */

  const maintenance =
    useQuery({
      queryKey: [
        "dashboard-maintenance-plans",
      ],

      queryFn:
        async () => {
          const {
            data:
              planData,
            error:
              planError,
          } =
            await db
              .from(
                "maintenance_plans",
              )
              .select(`
                id,
                machine_id,
                name,
                next_maintenance_date,
                priority,
                is_active
              `)
              .is(
                "deleted_at",
                null,
              )
              .eq(
                "is_active",
                true,
              )
              .order(
                "next_maintenance_date",
                {
                  ascending:
                    true,
                },
              )
              .limit(
                6,
              );

          if (
            planError
          ) {
            throw planError;
          }

          const {
            data:
              machineData,
            error:
              machineError,
          } =
            await db
              .from(
                "machines",
              )
              .select(
                `
                id,
                code,
                name
              `,
              );

          if (
            machineError
          ) {
            throw machineError;
          }

          const machineMap =
            new Map<
              string,
              MachineRow
            >(
              (
                machineData ??
                []
              ).map(
                (
                  machine:
                    MachineRow,
                ) => [
                  machine.id,
                  machine,
                ],
              ),
            );

          return (
            planData ??
            []
          ).map(
            (
              plan:
                MaintenancePlanRow,
            ) => ({
              ...plan,

              machine:
                machineMap.get(
                  plan.machine_id,
                ) ??
                null,
            }),
          );
        },
    });

  /*
   * =====================================================
   * DENETİM KAYITLARI
   * =====================================================
   */

  const audit =
    useQuery({
      queryKey: [
        "dashboard-audit",
      ],

      enabled:
        hasPermission(
          "audit.view",
        ),

      queryFn:
        async () => {
          const {
            data,
            error,
          } =
            await db
              .from(
                "audit_logs",
              )
              .select(
                `
                id,
                action,
                module,
                description,
                created_at
              `,
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              )
              .limit(
                8,
              );

          if (
            error
          ) {
            throw error;
          }

          return (
            data ??
            []
          );
        },
    });

  const cards =
    [
      {
        label:
          "Toplam Ürün",
        value:
          stats.data
            ?.products,
        icon:
          Package,
        to:
          "/urunler" as const,
      },

      {
        label:
          "Aktif Personel",
        value:
          stats.data
            ?.activeEmployees,
        icon:
          Users,
        to:
          "/personel" as const,
      },

      {
        label:
          "Bakımdaki Makine",
        value:
          stats.data
            ?.maintenanceMachines,
        icon:
          Factory,
        to:
          "/makineler" as const,
      },

      {
        label:
          "Açık Arıza",
        value:
          stats.data
            ?.openFaults,
        icon:
          TriangleAlert,
        to:
          "/arizalar" as const,
      },

      {
        label:
          "Gecikmiş Bakım",
        value:
          stats.data
            ?.overdueMaintenance,
        icon:
          Wrench,
        to:
          "/periyodik-bakim" as const,
      },

      {
        label:
          "Açık Satın Alma",
        value:
          stats.data
            ?.openPurchaseOrders,
        icon:
          ShoppingCart,
        to:
          "/satinalma-siparisleri" as const,
      },

      {
        label:
          "Departman",
        value:
          stats.data
            ?.departments,
        icon:
          Building2,
        to:
          "/organizasyon" as const,
      },

      {
        label:
          "Birim",
        value:
          stats.data
            ?.units,
        icon:
          Boxes,
        to:
          "/organizasyon" as const,
      },
    ];

  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${
          fullName(
            profile,
          ) ||
          "kullanıcı"
        }`}
        description="Fabrikanızın operasyon, bakım, satın alma ve organizasyon durumunu tek ekrandan takip edin."
        actions={
          <div className="flex flex-wrap gap-2">
            {roles.length
              ? roles.map(
                  (
                    role,
                  ) => (
                    <Badge
                      key={
                        role
                      }
                      variant="secondary"
                    >
                      {
                        ROLE_LABELS[
                          role
                        ]
                      }
                    </Badge>
                  ),
                )
              : (
                <Badge variant="outline">
                  Rol
                  atanmadı
                </Badge>
              )}
          </div>
        }
      />

      {stats.isError ? (
        <ErrorState
          message="Özet veriler yüklenemedi."
          onRetry={() =>
            void stats.refetch()
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(
            (
              card,
            ) => (
              <Link
                key={
                  card.label
                }
                to={
                  card.to
                }
                className="group"
              >
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {
                        card.label
                      }
                    </CardTitle>

                    <card.icon className="size-4 text-primary" />
                  </CardHeader>

                  <CardContent>
                    <p className="font-display text-3xl font-semibold tabular-nums">
                      {stats.isLoading
                        ? "—"
                        : (
                            card.value ??
                            0
                          )}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ),
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* =====================================================
            YAKLAŞAN BAKIMLAR
            ===================================================== */}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />

              <CardTitle className="text-base">
                Yaklaşan
                Bakımlar
              </CardTitle>
            </div>

            <Link
              to="/periyodik-bakim"
              className="text-xs font-medium text-primary hover:underline"
            >
              Tümünü gör
            </Link>
          </CardHeader>

          <CardContent>
            {maintenance.isLoading ? (
              <LoadingState />
            ) : maintenance.isError ? (
              <ErrorState
                onRetry={() =>
                  void maintenance.refetch()
                }
              />
            ) : !maintenance.data
                ?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aktif
                periyodik
                bakım
                planı
                bulunmuyor.
              </p>
            ) : (
              <div className="divide-y">
                {maintenance.data.map(
                  (
                    plan:
                      any,
                  ) => {
                    const status =
                      maintenanceStatus(
                        plan.next_maintenance_date,
                      );

                    return (
                      <div
                        key={
                          plan.id
                        }
                        className="flex items-center gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {
                              plan.name
                            }
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {plan.machine
                              ? `${plan.machine.code} - ${plan.machine.name}`
                              : "Makine bulunamadı"}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant={
                              status.variant
                            }
                          >
                            {
                              status.label
                            }
                          </Badge>

                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(
                              `${plan.next_maintenance_date}T00:00:00`,
                            ).toLocaleDateString(
                              "tr-TR",
                            )}
                          </span>
                        </div>

                        <Badge
                          variant={priorityVariant(
                            plan.priority,
                          )}
                        >
                          {priorityLabel(
                            plan.priority,
                          )}
                        </Badge>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* =====================================================
            HIZLI ERİŞİM
            ===================================================== */}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Hızlı
              Erişim
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/stok"
              className="rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Boxes className="mb-3 size-5 text-primary" />

              <div className="font-medium">
                Stok
                Durumu
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Depo ve
                ürün
                stoklarını
                görüntüle.
              </div>
            </Link>

            <Link
              to="/uretim-emirleri"
              className="rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Factory className="mb-3 size-5 text-primary" />

              <div className="font-medium">
                Üretim
                Emirleri
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Üretim
                süreçlerini
                yönet.
              </div>
            </Link>

            <Link
              to="/bakim-is-emirleri"
              className="rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Wrench className="mb-3 size-5 text-primary" />

              <div className="font-medium">
                Bakım İş
                Emirleri
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Bakım ve
                onarım
                işlerini
                takip et.
              </div>
            </Link>

            <Link
              to="/satinalma-siparisleri"
              className="rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <ShoppingCart className="mb-3 size-5 text-primary" />

              <div className="font-medium">
                Satın
                Alma
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Tedarik ve
                mal kabul
                süreçlerini
                yönet.
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* =====================================================
          DENETİM KAYITLARI
          ===================================================== */}

      {hasPermission(
        "audit.view",
      ) ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ScrollText className="size-4 text-primary" />

            <CardTitle className="text-base">
              Son Sistem
              Hareketleri
            </CardTitle>
          </CardHeader>

          <CardContent>
            {audit.isLoading ? (
              <LoadingState />
            ) : audit.isError ? (
              <ErrorState
                onRetry={() =>
                  void audit.refetch()
                }
              />
            ) : !audit.data
                ?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Henüz
                kayıtlı
                hareket
                yok.
              </p>
            ) : (
              <ul className="divide-y">
                {audit.data.map(
                  (
                    log:
                      any,
                  ) => (
                    <li
                      key={
                        log.id
                      }
                      className="flex flex-wrap items-center gap-2 py-2.5 text-sm"
                    >
                      <Badge
                        variant="outline"
                        className="uppercase"
                      >
                        {
                          log.action
                        }
                      </Badge>

                      <span className="text-muted-foreground">
                        {
                          log.module
                        }
                      </span>

                      <span className="min-w-0 flex-1 truncate">
                        {log.description ??
                          "—"}
                      </span>

                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(
                          log.created_at,
                        ).toLocaleString(
                          "tr-TR",
                        )}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}