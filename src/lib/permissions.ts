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

/** Faz 1 içinde kullanılan izin anahtarları. Yeni modüller eklendikçe genişletilir. */
export type PermissionKey =
  | "dashboard.view"
  | "org.view"
  | "org.manage"
  | "employees.view"
  | "employees.manage"
  | "roles.view"
  | "roles.manage"
  | "products.view"
  | "products.manage"
  | "stock.view"
  | "stock.manage"
  | "orders.view"
  | "orders.manage"
  | "production.view"
  | "production.manage"
  | "tasks.view"
  | "tasks.assign"
  | "reports.view"
  | "audit.view"
  | "settings.manage";

export function fullName(p?: { first_name?: string | null; last_name?: string | null } | null) {
  if (!p) return "";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
}

/** Kullanıcıya gösterilecek Türkçe hata mesajları. */
export function friendlyError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : ((error as { message?: string } | null)?.message ?? "");

  const map: Array<[RegExp, string]> = [
    [/invalid login credentials/i, "E-posta veya parola hatalı."],
    [/email not confirmed/i, "E-posta adresiniz henüz doğrulanmamış."],
    [/user already registered/i, "Bu e-posta ile kayıtlı bir kullanıcı zaten var."],
    [/password should be at least/i, "Parola en az 6 karakter olmalıdır."],
    [/duplicate key|already exists|unique/i, "Bu kod veya kayıt sistemde zaten mevcut."],
    [/row-level security|permission denied|not authorized/i, "Bu işlem için yetkiniz bulunmuyor."],
    [/foreign key/i, "Bu kayıt başka kayıtlarla ilişkili olduğu için işlem yapılamadı."],
    [/network|fetch failed/i, "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin."],
    [/rate limit/i, "Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin."],
  ];

  for (const [pattern, message] of map) if (pattern.test(raw)) return message;
  return raw ? "İşlem tamamlanamadı. Lütfen tekrar deneyin." : "Beklenmeyen bir hata oluştu.";
}
