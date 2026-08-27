import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardList,
  Factory,
  FolderTree,
  History,
  LayoutDashboard,
  MapPin,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
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

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/panel",
    label: "Panel",
    icon: LayoutDashboard,
    permission: "dashboard.view",
    group: "Operasyon",
  },

  {
    to: "/urunler",
    label: "Ürünler",
    icon: Package,
    permission: "products.view",
    group: "Operasyon",
  },

  {
    to: "/kategoriler",
    label: "Ürün Kategorileri",
    icon: FolderTree,
    permission: "products.view",
    group: "Operasyon",
  },

  {
    to: "/depolar",
    label: "Depolar",
    icon: Warehouse,
    permission: "warehouses.view",
    group: "Operasyon",
  },

  {
    to: "/depo-konumlari",
    label: "Depo Konumları",
    icon: MapPin,
    permission: "warehouses.view",
    group: "Operasyon",
  },

  {
    to: "/stok",
    label: "Stok Durumu",
    icon: Boxes,
    permission: "stock.view",
    group: "Operasyon",
  },

  {
    to: "/stok-girisi",
    label: "Stok Girişi",
    icon: ArrowDownToLine,
    permission: "stock.entry",
    group: "Operasyon",
  },

  {
    to: "/stok-cikisi",
    label: "Stok Çıkışı",
    icon: ArrowUpFromLine,
    permission: "stock.exit",
    group: "Operasyon",
  },

  {
    to: "/stok-transfer",
    label: "Stok Transferi",
    icon: ArrowRightLeft,
    permission: "stock.transfer",
    group: "Operasyon",
  },

  {
    to: "/stok-hareketleri",
    label: "Stok Hareketleri",
    icon: History,
    permission: "stock.view",
    group: "Operasyon",
  },

  {
    to: "/receteler",
    label: "Reçeteler",
    icon: ClipboardList,
    permission: "production.view",
    group: "Operasyon",
  },

  {
    to: "/uretim-emirleri",
    label: "Üretim Emirleri",
    icon: Factory,
    permission: "production.view",
    group: "Operasyon",
  },

  {
    to: "/uretim-raporlari",
    label: "Üretim Raporları",
    icon: BarChart3,
    permission: "production.view",
    group: "Operasyon",
  },

  {
    to: "/tedarikciler",
    label: "Tedarikçiler",
    icon: Truck,
    permission: "orders.view",
    group: "Operasyon",
  },

  {
    to: "/satinalma-siparisleri",
    label: "Satın Alma Siparişleri",
    icon: ShoppingCart,
    permission: "orders.view",
    group: "Operasyon",
  },

  // ==========================================================
  // BAKIM / ARIZA
  // ==========================================================

  {
    to: "/makineler",
    label: "Makineler",
    icon: Factory,
    permission: "maintenance.view" as PermissionKey,
    group: "Operasyon",
  },

  {
    to: "/arizalar",
    label: "Arıza Bildirimleri",
    icon: TriangleAlert,
    permission: "maintenance.view" as PermissionKey,
    group: "Operasyon",
  },

  {
    to: "/bakim-is-emirleri",
    label: "Bakım İş Emirleri",
    icon: ClipboardList,
    permission: "maintenance.view" as PermissionKey,
    group: "Operasyon",
  },

  {
    to: "/periyodik-bakim",
    label: "Periyodik Bakım",
    icon: CalendarClock,
    permission: "maintenance.view" as PermissionKey,
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