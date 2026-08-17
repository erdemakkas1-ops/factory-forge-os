import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, friendlyError } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Profilim | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content: "Kişisel bilgilerinizi güncelleyin ve sistemdeki rollerinizi görüntüleyin.",
      },
      { property: "og:title", content: "Profilim | Fabrika Yönetim Sistemi" },
      { property: "og:description", content: "Kişisel bilgilerinizi yönetin." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, roles, user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: String(f.get("first_name")).trim(),
        last_name: String(f.get("last_name")).trim(),
        phone: String(f.get("phone") ?? "").trim() || null,
        position: String(f.get("position") ?? "").trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await refresh();
    toast.success("Profil bilgileriniz güncellendi.");
  }

  return (
    <>
      <PageHeader title="Profilim" description="Kişisel bilgilerinizi güncelleyin." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Kişisel bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Ad</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    required
                    defaultValue={profile?.first_name ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Soyad</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    required
                    defaultValue={profile?.last_name ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Görev</Label>
                  <Input id="position" name="position" defaultValue={profile?.position ?? ""} />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                Kaydet
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hesap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">E-posta</p>
              <p className="font-medium break-all">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Personel no</p>
              <p className="font-medium">{profile?.employee_no ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-muted-foreground">Roller</p>
              <div className="flex flex-wrap gap-1.5">
                {roles.length ? (
                  roles.map((r) => (
                    <Badge key={r} variant="secondary">
                      {ROLE_LABELS[r]}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">Rol atanmadı</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
