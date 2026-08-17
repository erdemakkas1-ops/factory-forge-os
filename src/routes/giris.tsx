import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/permissions";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/giris")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Giriş Yap | Fabrika Yönetim Sistemi" },
      {
        name: "description",
        content:
          "Fabrika Yönetim Sistemi'ne giriş yapın; üretim, stok ve personel operasyonlarını tek panelden yönetin.",
      },
      { property: "og:title", content: "Giriş Yap | Fabrika Yönetim Sistemi" },
      {
        property: "og:description",
        content: "Üretim, stok ve personel operasyonlarını tek panelden yönetin.",
      },
    ],
  }),
  component: LoginPage,
});

const REMEMBER_KEY = "fys-remember-email";

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(REMEMBER_KEY);
    if (stored) {
      setEmail(stored);
      setRemember(true);
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: redirect ?? "/panel" });
    });
  }, [navigate, redirect]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (remember) window.localStorage.setItem(REMEMBER_KEY, email.trim());
    else window.localStorage.removeItem(REMEMBER_KEY);

    toast.success("Giriş başarılı, hoş geldiniz.");
    void navigate({ to: redirect ?? "/panel" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/panel`,
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (data.session) {
      toast.success("Hesabınız oluşturuldu.");
      void navigate({ to: "/panel" });
      return;
    }
    toast.success("Hesap oluşturuldu. E-postanızdaki doğrulama bağlantısına tıklayın.");
  }

  async function handleReset() {
    if (!email.trim()) {
      toast.error("Önce e-posta adresinizi yazın.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/giris`,
    });
    if (error) toast.error(friendlyError(error));
    else toast.success("Parola sıfırlama bağlantısı e-postanıza gönderildi.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Factory className="size-6" />
          </span>
          <span className="font-display text-lg font-semibold tracking-wide">
            FABRİKA YÖNETİM SİSTEMİ
          </span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="font-display text-3xl leading-tight font-semibold">
            Üretim, stok ve personel operasyonlarınız tek merkezde.
          </h2>
          <p className="text-sm text-sidebar-foreground/70">
            Sipariş girişinden üretim emrine, birim görev atamalarından stok hareketlerine kadar
            tüm fabrika süreçlerini rol bazlı yetkilerle yönetin.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/70">
            <li>• Rol ve izin tabanlı erişim kontrolü</li>
            <li>• Departman ve birim bazlı organizasyon yapısı</li>
            <li>• Denetim kayıtları ile tam izlenebilirlik</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} Fabrika Yönetim Sistemi
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Factory className="size-5" />
            </span>
            <span className="font-display font-semibold">FABRİKA YÖNETİM SİSTEMİ</span>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="login" className="flex-1">
                Giriş Yap
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Hesap Oluştur
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <h1 className="text-xl font-semibold">Sisteme giriş</h1>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                Kurumsal e-posta adresiniz ve parolanızla giriş yapın.
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ad.soyad@fabrika.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Parola</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(v === true)}
                    />
                    Beni hatırla
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    className="text-sm text-primary hover:underline"
                  >
                    Şifremi unuttum
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Giriş yap
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <h1 className="text-xl font-semibold">Hesap oluştur</h1>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                Sistemdeki ilk hesap otomatik olarak Admin yetkisi alır. Sonraki hesaplar
                Personel olarak açılır ve Admin tarafından yetkilendirilir.
              </p>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">Ad</Label>
                    <Input
                      id="first-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Soyad</Label>
                    <Input
                      id="last-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-posta</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Parola</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Hesap oluştur
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
