import { supabase } from "@/integrations/supabase/client";

type AuditInput = {
  action: string;
  module: string;
  recordId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  description?: string;
};

/**
 * Kritik işlemleri denetim kaydına yazar. Hata durumunda kullanıcı akışını
 * bloklamaz; yalnızca konsola bildirir.
 */
export async function writeAudit(input: AuditInput) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { error } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action: input.action,
    module: input.module,
    record_id: input.recordId ?? null,
    old_data: (input.oldData ?? null) as never,
    new_data: (input.newData ?? null) as never,
    description: input.description ?? null,
  });

  if (error) console.error("Denetim kaydı yazılamadı:", error.message);
}
