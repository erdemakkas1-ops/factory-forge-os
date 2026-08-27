import { createFileRoute } from "@tanstack/react-router";
import {
  Database,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute(
  "/_authenticated/ayarlar",
)({
  head: () => ({
    meta: [
      {
        title:
          "Sistem Ayarları | Fabrika Yönetim Sistemi",
      },
      {
        name: "description",
        content:
          "Fabrika Yönetim Sistemi ayarları.",
      },
    ],
  }),

  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Sistem Ayarları"
        description="Uygulamanın genel yapılandırmasını ve sistem durumunu görüntüleyin."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" />

              <CardTitle className="text-base">
                Veritabanı
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Servis
              </span>

              <span className="text-sm font-medium">
                Supabase
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Durum
              </span>

              <Badge>
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />

              <CardTitle className="text-base">
                Güvenlik
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Kimlik Doğrulama
              </span>

              <Badge variant="secondary">
                Aktif
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Rol Sistemi
              </span>

              <Badge variant="secondary">
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" />

              <CardTitle className="text-base">
                Bakım Modülü
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Arıza Yönetimi
              </span>

              <Badge variant="secondary">
                Aktif
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Periyodik Bakım
              </span>

              <Badge variant="secondary">
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-primary" />

              <CardTitle className="text-base">
                Uygulama
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gelişmiş sistem ayarları sonraki sürümlerde buradan yönetilebilecek.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}