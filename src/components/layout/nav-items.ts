import {
  Building2,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
  group: "Operasyon" | "Organizasyon" | "Yönetim";
};

/** Faz 1 kapsamında çalışan modüller. Sonraki fazlarda buraya eklenir. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/panel",
    label: "Panel",
    icon: LayoutDashboard,
    permission: "dashboard.view",
    group: "Operasyon",
  },
  {
    to: "/organizasyon",
    label: "Organizasyon",
    icon: Building2,
    permission: "org.view",
    group: "Organizasyon",
  },
  {
    to: "/personel",
    label: "Personel",
    icon: Users,
    permission: "employees.view",
    group: "Organizasyon",
  },
  {
    to: "/yetkilendirme",
    label: "Yetkilendirme",
    icon: ShieldCheck,
    permission: "roles.view",
    group: "Yönetim",
  },
  {
    to: "/denetim",
    label: "Denetim Kayıtları",
    icon: ScrollText,
    permission: "audit.view",
    group: "Yönetim",
  },
  {
    to: "/ayarlar",
    label: "Sistem Ayarları",
    icon: Settings,
    permission: "settings.manage",
    group: "Yönetim",
  },
];
