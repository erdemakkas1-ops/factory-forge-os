import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

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

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute(
  "/_authenticated/yetkilendirme",
)({
  head: () => ({
    meta: [
      {
        title:
          "Yetkilendirme | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Rol ve yetki tanımlarını görüntüleyin.",
      },
    ],
  }),

  component: AuthorizationPage,
});

const db = supabase as any;

type RoleRow = {
  role: string;
  label: string | null;
};

type PermissionRow = {
  key: string;
  module: string;
  label: string;
};

type RolePermissionRow = {
  role: string;
  permission_key: string;
};

function AuthorizationPage() {
  const roles = useQuery<RoleRow[]>({
    queryKey: ["authorization-roles"],

    queryFn: async () => {
      const { data, error } = await db
        .from("roles")
        .select("role, label")
        .order("role");

      if (error) throw error;

      return (data ?? []) as RoleRow[];
    },
  });

  const permissions =
    useQuery<PermissionRow[]>({
      queryKey: [
        "authorization-permissions",
      ],

      queryFn: async () => {
        const { data, error } = await db
          .from("permissions")
          .select(`
            key,
            module,
            label
          `)
          .order("module")
          .order("key");

        if (error) throw error;

        return (
          data ?? []
        ) as PermissionRow[];
      },
    });

  const rolePermissions =
    useQuery<RolePermissionRow[]>({
      queryKey: [
        "authorization-role-permissions",
      ],

      queryFn: async () => {
        const { data, error } = await db
          .from("role_permissions")
          .select(`
            role,
            permission_key
          `);

        if (error) throw error;

        return (
          data ?? []
        ) as RolePermissionRow[];
      },
    });

  const isLoading =
    roles.isLoading ||
    permissions.isLoading ||
    rolePermissions.isLoading;

  const isError =
    roles.isError ||
    permissions.isError ||
    rolePermissions.isError;

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Yetkilendirme"
          description="Rol ve yetki yapılarını yönetin."
        />

        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader
          title="Yetkilendirme"
          description="Rol ve yetki yapılarını yönetin."
        />

        <ErrorState
          onRetry={() => {
            void roles.refetch();
            void permissions.refetch();
            void rolePermissions.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Yetkilendirme"
        description="Sistemdeki rollerin hangi yetkilere sahip olduğunu görüntüleyin."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {(roles.data ?? []).map((role) => {
          const keys = new Set(
            (rolePermissions.data ?? [])
              .filter(
                (item) =>
                  item.role === role.role,
              )
              .map(
                (item) =>
                  item.permission_key,
              ),
          );

          const assignedPermissions =
            (permissions.data ?? []).filter(
              (permission) =>
                keys.has(
                  permission.key,
                ),
            );

          return (
            <Card key={role.role}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />

                  <CardTitle className="text-base">
                    {role.label ||
                      role.role}
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent>
                {!assignedPermissions.length ? (
                  <p className="text-sm text-muted-foreground">
                    Bu role atanmış yetki bulunmuyor.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedPermissions.map(
                      (permission) => (
                        <Badge
                          key={
                            permission.key
                          }
                          variant="secondary"
                        >
                          {
                            permission.label
                          }
                        </Badge>
                      ),
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}