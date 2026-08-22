import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES: Record<string, string> = {
  CLIENTES: "clientes",
  NEGOCIACOES: "negociacoes",
  INTERACOES: "interacoes",
  TAREFAS: "tarefas",
  PROPOSTAS: "propostas",
  HISTORICO: "historico",
  CONFIGURACOES: "configuracoes",
  LOGS: "logs",
  USUARIOS: "usuarios",
};

const ID_FIELDS: Record<string, string[]> = {
  NEGOCIACOES: ["clienteId"],
  INTERACOES: ["clienteId"],
  TAREFAS: ["clienteId"],
  PROPOSTAS: ["clienteId", "negociacaoId"],
  HISTORICO: ["clienteId"],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, data }), {
    status,
    headers: corsHeaders,
  });
}

function error(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: corsHeaders,
  });
}

function cleanPayload(data: Record<string, unknown> = {}) {
  const out = { ...data };
  delete out.id;
  return out;
}

function outputRow(sheet: string, row: any) {
  if (sheet === "USUARIOS") {
    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      perfil: row.perfil,
      gestorId: row.gestor_id || "",
      ativo: row.ativo,
      criadoEm: row.criado_em,
    };
  }
  if (sheet === "CONFIGURACOES") {
    return { id: row.id, chave: row.chave, valor: row.valor };
  }
  if (sheet === "HISTORICO") {
    return {
      ...row.payload,
      id: row.id,
      clienteId: row.cliente_id || row.payload?.clienteId || "",
      entidade: row.entidade,
      registroId: row.registro_id,
      dataHora: row.data_hora,
      usuario: row.usuario,
      acao: row.acao,
      alteracao: row.alteracao,
    };
  }
  if (sheet === "LOGS") {
    return {
      ...row.payload,
      id: row.id,
      tipo: row.tipo,
      usuario: row.usuario,
      acao: row.acao,
      entidade: row.entidade,
      registroId: row.registro_id,
      detalhes: row.detalhes,
      dataHora: row.data_hora,
    };
  }
  return { ...(row.payload || {}), id: row.id };
}

function dbFields(sheet: string, data: Record<string, any>) {
  const payload = cleanPayload(data);
  const fields: Record<string, any> = { payload };
  for (const field of ID_FIELDS[sheet] || []) {
    const value = data[field];
    fields[field.replace(/[A-Z]/g, (m: string) => `_${m.toLowerCase()}`)] = value || null;
  }
  if (sheet === "HISTORICO") {
    fields.entidade = data.entidade || "";
    fields.registro_id = data.registroId || null;
    fields.data_hora = data.dataHora || new Date().toISOString();
    fields.usuario = data.usuario || "Sistema";
    fields.acao = data.acao || "";
    fields.alteracao = data.alteracao || "";
  }
  if (sheet === "LOGS") {
    fields.tipo = data.tipo || "";
    fields.usuario = data.usuario || "Sistema";
    fields.acao = data.acao || "";
    fields.entidade = data.entidade || null;
    fields.registro_id = data.registroId || null;
    fields.detalhes = data.detalhes || "";
    fields.data_hora = data.dataHora || new Date().toISOString();
  }
  if (sheet === "CONFIGURACOES") {
    fields.id = String(data.id || data.chave || crypto.randomUUID());
    fields.chave = data.chave || fields.id;
    fields.valor = data.valor ?? "";
    fields.payload = { chave: fields.chave };
  }
  return fields;
}

async function currentUser(req: Request) {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Não autenticado");
  const { data, error: authError } = await authClient.auth.getUser(token);
  if (authError || !data.user) throw new Error("Sessão expirada");
  const { data: profile, error: profileError } = await adminClient
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.ativo === false) throw new Error("Usuário inválido");
  return profile;
}

async function requireUser(req: Request) {
  try {
    return await currentUser(req);
  } catch (e) {
    throw e;
  }
}

async function listRows(sheet: string) {
  const table = TABLES[sheet];
  if (!table) throw new Error(`Coleção desconhecida: ${sheet}`);
  const { data, error: dbError } = await adminClient.from(table).select("*").order("criado_em", { ascending: true });
  if (dbError) throw dbError;
  return (data || []).map((row: any) => outputRow(sheet, row));
}

async function createRow(sheet: string, data: Record<string, any>) {
  const table = TABLES[sheet];
  if (!table) throw new Error(`Coleção desconhecida: ${sheet}`);

  if (sheet === "USUARIOS") {
    if (!data.email || !data.senha) throw new Error("E-mail e senha são obrigatórios.");
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: String(data.email).toLowerCase(),
      password: String(data.senha),
      email_confirm: true,
    });
    if (authError || !authData.user) throw authError || new Error("Não foi possível criar o usuário.");
    const row = {
      auth_user_id: authData.user.id,
      nome: data.nome || "",
      email: String(data.email).toLowerCase(),
      perfil: data.perfil || "Vendedor",
      gestor_id: data.gestorId || null,
      ativo: data.ativo !== false,
    };
    const { data: profile, error: profileError } = await adminClient.from(table).insert(row).select().single();
    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }
    return outputRow(sheet, profile);
  }

  const fields = dbFields(sheet, data);
  if (sheet !== "CONFIGURACOES" && data.id) fields.id = data.id;
  const { data: row, error: dbError } = await adminClient.from(table).insert(fields).select().single();
  if (dbError) throw dbError;
  return outputRow(sheet, row);
}

async function updateRow(sheet: string, id: string, data: Record<string, any>) {
  const table = TABLES[sheet];
  if (!table) throw new Error(`Coleção desconhecida: ${sheet}`);

  if (sheet === "USUARIOS") {
    const { data: profile, error: getError } = await adminClient.from(table).select("*").eq("id", id).single();
    if (getError || !profile) throw new Error("Usuário não encontrado.");
    if (data.email && data.email !== profile.email) {
      const { error } = await adminClient.auth.admin.updateUserById(profile.auth_user_id, { email: String(data.email).toLowerCase(), email_confirm: true });
      if (error) throw error;
    }
    if (data.senha) {
      const { error } = await adminClient.auth.admin.updateUserById(profile.auth_user_id, { password: String(data.senha) });
      if (error) throw error;
    }
    const patch: Record<string, any> = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.email !== undefined) patch.email = String(data.email).toLowerCase();
    if (data.perfil !== undefined) patch.perfil = data.perfil;
    if (data.gestorId !== undefined) patch.gestor_id = data.gestorId || null;
    if (data.ativo !== undefined) patch.ativo = data.ativo !== false;
    const { data: updated, error: updateError } = await adminClient.from(table).update(patch).eq("id", id).select().single();
    if (updateError) throw updateError;
    return outputRow(sheet, updated);
  }

  const fields = dbFields(sheet, data);
  delete fields.id;
  const { data: row, error: dbError } = await adminClient.from(table).update(fields).eq("id", id).select().single();
  if (dbError) throw dbError;
  return outputRow(sheet, row);
}

async function deleteRow(sheet: string, id: string) {
  const table = TABLES[sheet];
  if (!table) throw new Error(`Coleção desconhecida: ${sheet}`);
  if (sheet === "USUARIOS") {
    const { data: profile, error: getError } = await adminClient.from(table).select("auth_user_id").eq("id", id).single();
    if (getError || !profile) throw new Error("Usuário não encontrado.");
    const { error: authError } = await adminClient.auth.admin.deleteUser(profile.auth_user_id);
    if (authError) throw authError;
  }
  const { error: dbError } = await adminClient.from(table).delete().eq("id", id);
  if (dbError) throw dbError;
  return true;
}

async function handle(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  let body: any = {};
  if (req.method !== "GET") {
    try { body = await req.json(); } catch { body = {}; }
  }

  if (action === "login" || body.action === "login") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) throw new Error("E-mail e senha são obrigatórios.");
    const { data, error: authError } = await authClient.auth.signInWithPassword({ email, password });
    if (authError || !data.session || !data.user) throw new Error("E-mail ou senha inválidos.");
    const { data: profile, error: profileError } = await adminClient.from("usuarios").select("*").eq("auth_user_id", data.user.id).single();
    if (profileError || !profile || profile.ativo === false) {
      await authClient.auth.signOut();
      throw new Error("Usuário inválido ou inativo.");
    }
    return { token: data.session.access_token, user: outputRow("USUARIOS", profile), expiresIn: data.session.expires_in };
  }

  if (action === "logout" || body.action === "logout") return true;

  // Webhook público para receber leads do site. Se um segredo estiver configurado
  // em CONFIGURACOES/integrations, ele passa a ser obrigatório.
  if (action === "lead" || body.action === "lead") {
    const { data: integration } = await adminClient
      .from("configuracoes")
      .select("valor")
      .eq("chave", "integrations")
      .maybeSingle();
    let settings: any = {};
    try { settings = integration?.valor ? JSON.parse(integration.valor) : {}; } catch { settings = {}; }
    if (settings.siteWebhookEnabled === false) throw new Error("Webhook de leads desativado.");
    const expected = String(settings.siteWebhookSecret || "");
    const supplied = String(req.headers.get("x-webhook-secret") || body.secret || "");
    if (expected && supplied !== expected) throw new Error("Segredo do webhook inválido.");
    const incoming = body.data || body.lead || body;
    const lead = {
      nome: incoming.nome || "",
      email: incoming.email || "",
      contato: incoming.contato || incoming.telefone || "",
      whatsapp: incoming.whatsapp || "",
      empresa: incoming.empresa || "",
      origem: incoming.origem || "Site",
      observacoes: incoming.observacoes || incoming.mensagem || "",
      status: "lead",
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    if (!lead.nome) throw new Error("Nome do lead é obrigatório.");
    return await createRow("CLIENTES", lead);
  }

  const user = await requireUser(req);
  const sheet = String(body.sheet || url.searchParams.get("sheet") || "").toUpperCase();

  if (action === "list" || body.action === "list") return await listRows(sheet);
  if (action === "create" || body.action === "create") {
    if (sheet === "USUARIOS" && user.perfil !== "Administrador") throw new Error("Apenas Administradores podem criar usuários.");
    return await createRow(sheet, body.data || {});
  }
  if (action === "update" || body.action === "update") {
    if (sheet === "USUARIOS" && user.perfil !== "Administrador") throw new Error("Apenas Administradores podem editar usuários.");
    return await updateRow(sheet, String(body.id), body.data || {});
  }
  if (action === "delete" || body.action === "delete") {
    if (sheet === "USUARIOS" && user.perfil !== "Administrador") throw new Error("Apenas Administradores podem excluir usuários.");
    if (sheet === "USUARIOS" && String(body.id) === String(user.id)) throw new Error("Não é permitido excluir o próprio usuário.");
    return await deleteRow(sheet, String(body.id));
  }

  throw new Error("Ação não reconhecida.");
}

Deno.serve(async (req) => {
  try {
    const result = await handle(req);
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = /Não autenticado|Sessão expirada|Usuário inválido/.test(message) ? 401 : 400;
    return error(message, status);
  }
});
