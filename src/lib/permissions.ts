export type AppRole =
  | "admin"
  | "patron"
  | "hr"
  | "production_manager"
  | "warehouse"
  | "unit_manager"
  | "staff";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  patron: "Patron / Yönetici",
  hr: "İnsan Kaynakları",
  production_manager: "Üretim Müdürü",
  warehouse: "Depo / Stok Sorumlusu",
  unit_manager: "Birim Sorumlusu",
  staff: "Personel",
};

export const ROLE_ORDER: AppRole[] = [
  "admin",
  "patron",
  "hr",
  "production_manager",
  "warehouse",
  "unit_manager",
  "staff",
];

/**
 * Sistemde kullanılan izin anahtarları.
 * Yeni modüller eklendikçe buraya eklenir.
 */
export type PermissionKey =
  // Panel
  | "dashboard.view"

  // Organizasyon
  | "org.view"
  | "org.manage"

  // Personel
  | "employees.view"
  | "employees.manage"

  // Yetkilendirme
  | "roles.view"
  | "roles.manage"

  // Ürünler
  | "products.view"
  | "products.manage"
  | "products.create"
  | "products.update"
  | "products.delete"

  // Depolar
  | "warehouses.view"
  | "warehouses.create"
  | "warehouses.update"

  // Stok
  | "stock.view"
  | "stock.manage"
  | "stock.entry"
  | "stock.exit"
  | "stock.transfer"
  | "stock.adjustment"

  // Siparişler
  | "orders.view"
  | "orders.manage"

  // Üretim
  | "production.view"
  | "production.manage"

  // Satın alma
  | "purchase.view"
  | "purchase.manage"

  // İş / Görev yönetimi
  | "tasks.view"
  | "tasks.assign"

  // Raporlama
  | "reports.view"

  // Denetim kayıtları
  | "audit.view"

  // Sistem ayarları
  | "settings.manage";

/**
 * Kullanıcının ad ve soyadını birleştirir.
 */
export function fullName(
  p?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null,
) {
  if (!p) return "";

  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

/**
 * Kullanıcı adından avatar için baş harfleri üretir.
 */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
}

/**
 * Teknik hata mesajlarını kullanıcıya daha anlaşılır
 * Türkçe mesajlar olarak gösterir.
 */
export function friendlyError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : ((error as { message?: string } | null)?.message ?? "");

  const map: Array<[RegExp, string]> = [
    [
      /invalid login credentials/i,
      "E-posta veya parola hatalı.",
    ],
    [
      /email not confirmed/i,
      "E-posta adresiniz henüz doğrulanmamış.",
    ],
    [
      /user already registered/i,
      "Bu e-posta ile kayıtlı bir kullanıcı zaten var.",
    ],
    [
      /password should be at least/i,
      "Parola en az 6 karakter olmalıdır.",
    ],
    [
      /duplicate key|already exists|unique/i,
      "Bu kod veya kayıt sistemde zaten mevcut.",
    ],
    [
      /row-level security|permission denied|not authorized/i,
      "Bu işlem için yetkiniz bulunmuyor.",
    ],
    [
      /foreign key/i,
      "Bu kayıt başka kayıtlarla ilişkili olduğu için işlem yapılamadı.",
    ],
    [
      /network|fetch failed/i,
      "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.",
    ],
    [
      /rate limit/i,
      "Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.",
    ],

    // Faz 2 - Stok / Ürün kontrolleri
    [
      /products_minimum_stock_check/i,
      "Minimum stok miktarı negatif olamaz.",
    ],
    [
      /products_maximum_stock_check/i,
      "Maksimum stok miktarı minimum stok miktarından küçük olamaz.",
    ],
    [
      /products_purchase_price_check/i,
      "Alış fiyatı negatif olamaz.",
    ],
    [
      /products_sale_price_check/i,
      "Satış fiyatı negatif olamaz.",
    ],
    [
      /inventory_quantity_check/i,
      "Stok miktarı negatif olamaz.",
    ],
    [
      /stock_movements_quantity_check/i,
      "Stok hareket miktarı sıfırdan büyük olmalıdır.",
    ],
  ];

  for (const [pattern, message] of map) {
    if (pattern.test(raw)) {
      return message;
    }
  }

  return raw
    ? "İşlem tamamlanamadı. Lütfen tekrar deneyin."
    : "Beklenmeyen bir hata oluştu.";
}