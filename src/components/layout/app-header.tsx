import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, User } from "lucide-react";

import { GlobalSearch } from "@/components/layout/global-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, fullName, initials } from "@/lib/permissions";
import type { Theme } from "@/hooks/use-theme";

export function AppHeader({
  collapsed,
  onToggleSidebar,
  onOpenMobileNav,
  theme,
  onToggleTheme,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const { profile, roles, user, signOut } = useAuth();
  const name = fullName(profile) || (user?.email ?? "Kullanıcı");
  const roleLabel = roles.length ? roles.map((r) => ROLE_LABELS[r]).join(", ") : "Rol atanmadı";

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    queryClient.clear();
    await navigate({ to: "/giris", search: {}, replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Menüyü aç"
      >
        <Menu className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Menüyü genişlet" : "Menüyü küçült"}
      >
        {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
      </Button>

      <div className="hidden flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Tema değiştir"
          title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Bildirimler"
          title="Bildirim merkezi Faz 4'te devreye alınacak"
          disabled
        >
          <Bell className="size-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-accent/10"
              aria-label="Kullanıcı menüsü"
            >
              <Avatar className="size-8">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={name} /> : null}
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-36 truncate text-sm font-medium">{name}</span>
                <span className="block max-w-36 truncate text-xs text-muted-foreground">
                  {roleLabel}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <span className="block truncate">{name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profil">
                <User className="mr-2 size-4" /> Profilim
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onClick={() => void handleSignOut()}>
              <LogOut className="mr-2 size-4" />
              {signingOut ? "Çıkış yapılıyor..." : "Çıkış yap"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
