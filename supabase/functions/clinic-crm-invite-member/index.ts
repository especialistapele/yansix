import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Configuração administrativa do Supabase incompleta." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Sessão autenticada necessária." }, 401);
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const clinicId = String(body?.clinic_id || "").trim();
  const name = String(body?.display_name || "").trim().slice(0, 160);
  const email = String(body?.email || "").trim().toLowerCase();
  const role = String(body?.role || "").trim();
  const allowedRoles = ["admin", "manager", "reception", "clinician", "finance", "marketing"];
  if (!clinicId || !name || !email.includes("@") || !allowedRoles.includes(role)) {
    return json({ error: "Informe clínica, nome, e-mail válido e perfil permitido." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: requester, error: requesterError } = await admin
    .from("clinic_crm_members")
    .select("role,active")
    .eq("clinic_id", clinicId).eq("user_id", authData.user.id).maybeSingle();
  if (requesterError) return json({ error: "Não foi possível validar as permissões." }, 500);
  if (!requester || requester.active !== true || !["owner", "admin"].includes(requester.role)) {
    return json({ error: "Somente proprietário ou administrador pode gerenciar a equipe." }, 403);
  }

  const { data: duplicate, error: duplicateError } = await admin
    .from("clinic_crm_members").select("id").eq("clinic_id", clinicId).eq("email", email).maybeSingle();
  if (duplicateError) return json({ error: "Não foi possível verificar a equipe." }, 500);
  if (duplicate) return json({ error: "Este e-mail já está vinculado a esta clínica." }, 409);

  let existingUser: any = null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json({ error: "Não foi possível consultar a conta de autenticação." }, 500);
    existingUser = (data.users || []).find((u: any) => (u.email || "").toLowerCase() === email) || null;
    if (existingUser || (data.users || []).length < 1000) break;
  }

  let userId = existingUser?.id;
  let createdAuthUser = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: name, clinic_crm_invite: true } });
    if (error || !data.user) return json({ error: error?.message || "Não foi possível enviar o convite por e-mail." }, 400);
    userId = data.user.id;
    createdAuthUser = true;
  }

  const { data: member, error: insertError } = await admin.from("clinic_crm_members")
    .insert({ clinic_id: clinicId, user_id: userId, role, active: true, display_name: name, email })
    .select("id,clinic_id,user_id,role,active,display_name,email,created_at").single();

  if (insertError) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    return json({ error: "Não foi possível vincular o usuário à clínica: " + insertError.message }, 500);
  }

  await admin.from("clinic_crm_audit_events").insert({
    clinic_id: clinicId, actor_user_id: authData.user.id, action: "member_invited",
    entity_type: "member", entity_id: member.id,
    details: { email, role, existing_account: Boolean(existingUser) }
  });

  return json({ member, invited: !existingUser, message: existingUser ? "Conta existente vinculada à clínica." : "Convite enviado por e-mail." }, 201);
});