import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ALLOWED_ROLES = new Set([
  "admin", "patron", "hr", "production_manager", "warehouse", "unit_manager", "staff",
]);

type InviteEmployeeInput = {
  email?: unknown; first_name?: unknown; last_name?: unknown; employee_no?: unknown;
  phone?: unknown; position?: unknown; shift?: unknown; department_id?: unknown;
  unit_id?: unknown; hired_at?: unknown; role?: unknown;
};

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const errorResponse = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return errorResponse("Yalnızca POST isteği desteklenir.", 405);

    const claims = ctx.userClaims as { id?: string; sub?: string } | undefined;
    const actorId = String(claims?.id ?? claims?.sub ?? "");
    if (!actorId) return errorResponse("Oturum doğrulanamadı.", 401);

    const { data: canManageEmployees } = await ctx.supabase.rpc("has_permission", {
      _user_id: actorId, _permission: "employees.manage",
    });
    if (!canManageEmployees) return errorResponse("Personel yönetme yetkiniz yok.", 403);

    let input: InviteEmployeeInput;
    try { input = (await req.json()) as InviteEmployeeInput; }
    catch { return errorResponse("Geçersiz istek gövdesi.", 400); }

    const email = optionalString(input.email)?.toLowerCase();
    const firstName = optionalString(input.first_name);
    const lastName = optionalString(input.last_name);
    const role = optionalString(input.role) ?? "staff";
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      return errorResponse("Geçerli bir e-posta adresi girin.", 400);
    if (!firstName || !lastName) return errorResponse("Ad ve soyad zorunludur.", 400);
    if (!ALLOWED_ROLES.has(role)) return errorResponse("Geçersiz sistem rolü.", 400);

    if (role !== "staff") {
      const { data: canManageRoles } = await ctx.supabase.rpc("has_permission", {
        _user_id: actorId, _permission: "roles.manage",
      });
      if (!canManageRoles) return errorResponse("Bu rolü atama yetkiniz yok.", 403);
    }
    if (role === "admin") {
      const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
        _user_id: actorId, _role: "admin",
      });
      if (!isAdmin) return errorResponse("Admin rolünü yalnızca admin atayabilir.", 403);
    }

    const { data: invite, error: inviteError } =
      await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName, last_name: lastName },
      });
    if (inviteError || !invite.user)
      return errorResponse(inviteError?.message ?? "Davet gönderilemedi.", 400);

    const userId = invite.user.id;
    const { error: profileError } = await ctx.supabaseAdmin.from("profiles").update({
      employee_no: optionalString(input.employee_no), phone: optionalString(input.phone),
      position: optionalString(input.position), shift: optionalString(input.shift),
      department_id: optionalString(input.department_id), unit_id: optionalString(input.unit_id),
      hired_at: optionalString(input.hired_at), is_active: true,
    }).eq("id", userId);
    if (profileError) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      return errorResponse("Personel profili oluşturulamadı.", 500);
    }

    const { error: deleteRoleError } = await ctx.supabaseAdmin
      .from("user_roles").delete().eq("user_id", userId);
    const { error: insertRoleError } = await ctx.supabaseAdmin
      .from("user_roles").insert({ user_id: userId, role });
    if (deleteRoleError || insertRoleError) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
      return errorResponse("Personel rolü atanamadı.", 500);
    }

    return Response.json({ user_id: userId, message: "Personel daveti gönderildi." });
  }),
};
