import { Link, useRouterState } from "@tanstack/react-router";
import { Factory } from "lucide-react";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const GROUPS = ["Operasyon", "Organizasyon", "Yönetim"] as const;

export function AppSidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { hasPermission } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  return (
    <nav
      aria-label="Ana menü"
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground"
    >
      <div
        className={cn(
          "flex h-16 items-center gap-3 border-b border-sidebar-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Factory className="size-5" />
        </span>
        {!collapsed ? (
          <span className="leading-tight">
            <span className="block font-display text-sm font-semibold tracking-wide">
              FABRİKA YÖNETİM
            </span>
            <span className="block text-xs text-sidebar-foreground/60">Üretim & Operasyon</span>
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        {GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="mb-5">
              {!collapsed ? (
                <p className="px-3 pb-2 text-[11px] font-semibold tracking-widest text-sidebar-foreground/45 uppercase">
                  {group}
                </p>
              ) : null}
              <ul className="space-y-1">
                {groupItems.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        title={item.label}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="size-4.5 shrink-0" />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {!collapsed ? (
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/50">
          Faz 1 • Temel yapı, yetkilendirme ve organizasyon
        </div>
      ) : null}
    </nav>
  );
}
