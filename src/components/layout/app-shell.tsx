import { useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { User } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { hasPermission } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const mobileItems = NAV_ITEMS.filter((i) => hasPermission(i.permission)).slice(0, 4);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="sticky top-0 h-screen">
          <AppSidebar collapsed={collapsed} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Ana menü</SheetTitle>
          <AppSidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobileNav={() => setMobileOpen(true)}
          theme={theme}
          onToggleTheme={toggle}
        />
        <main className="flex-1 px-3 pt-4 pb-24 sm:px-5 sm:pt-6 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl space-y-5">
            <Outlet />
          </div>
        </main>

        {/* Mobil alt navigasyon */}
        <nav
          aria-label="Alt menü"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card lg:hidden"
        >
          {mobileItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          <Link
            to="/profil"
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px]",
              pathname === "/profil" ? "text-primary" : "text-muted-foreground",
            )}
          >
            <User className="size-5" />
            <span>Profil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
