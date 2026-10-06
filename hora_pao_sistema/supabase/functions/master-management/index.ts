import { withSupabase } from "npm:@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function slugOk(slug: string) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 60;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    const { data: master, error: masterError } = await ctx.supabase
      .from("profiles")
      .select("id,papel,ativo")
      .eq("id", ctx.userClaims?.sub)
      .single();

    if (masterError || master?.papel !== "master" || !master.ativo) {
      return json({ error: "Apenas o usuário Master pode executar esta operação." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const admin = ctx.supabaseAdmin;

    try {
      if (action === "create_padaria") {
        const nome = String(body.nome ?? "").trim();
        const nome_comercial = String(body.nome_comercial ?? "").trim() || nome;
        const slug = String(body.slug ?? "").trim().toLowerCase();
        if (!nome || !slug || !slugOk(slug)) return json({ error: "Nome e slug válidos são obrigatórios." }, 400);
        const { data: existing } = await admin.from("padarias").select("id").eq("slug", slug).maybeSingle();
        if (existing) return json({ error: "Esse slug já está cadastrado." }, 409);
        const { data: padaria, error } = await admin.from("padarias").insert({
          nome, nome_comercial, slug, endereco: body.endereco || null, cidade: body.cidade || null,
          estado: body.estado || null, telefone: body.telefone || null, email: body.email || null,
          informacoes_publicas: body.informacoes_publicas || null, ativa: body.ativa !== false,
        }).select().single();
        if (error) throw error;
        const { data: temaPadrao } = await admin.rpc("tema_padrao");
        const tema = temaPadrao ?? {
          index: { logo:null, logo_modo:"emblema_texto", logo_altura:52, subtitulo:"", fundo_posicao:"center bottom",
            fundos:{aguardando:null,pronto:null,proximo:null,fim:null},
            cores:{principal:"#e8a93c",secundaria:"#ffffff",fundo:"#1b1008",texto:"#ffffff",relogio:"#ffffff"},
            overlay:{rgb:"14,8,4",topo:.80,meio:.50,base:.18} },
          painel:{logo:null,fundo:null,estilo_cards:"suave",cores:{principal:"#e8a93c",secundaria:"#3b2414",botoes:"#e8a93c",menu:"#2a170b",cabecalho:"#1b1008"}}
        };
        if (tema.index) tema.index.subtitulo = "Pão · Café · Tradição";
        const { error: themeError } = await admin.from("temas_padaria").insert({
          padaria_id:padaria.id, rascunho:tema, publicado:tema, status:"publicado", versao:1,
          publicado_em:new Date().toISOString(), publicado_por:ctx.userClaims?.sub, atualizado_por:ctx.userClaims?.sub,
        });
        if (themeError) throw themeError;
        const { error: cfgError } = await admin.from("configuracoes_padaria").insert({
          padaria_id:padaria.id, modo:"programado", antecedencia_min:20,
          mensagens:{aguardando:"Seu próximo pão está sendo preparado.",proximo:"O próximo pão já está programado.",pronto:"Pão pronto quentinho esperando por você!",fim:"O próximo pão estará disponível {quando} às {hora}.",fim_sem_horarios:"Não há novos horários programados."}
        });
        if (cfgError) throw cfgError;
        const { error: pubError } = await admin.from("publicacoes").insert({padaria_id:padaria.id,versao:1});
        if (pubError) throw pubError;
        const { data: plano } = await admin.from("planos").select("id,valor_mensal").eq("nome","Hora do Pão — Básico").maybeSingle();
        if (plano) await admin.from("assinaturas_padaria").insert({padaria_id:padaria.id,plano_id:plano.id,valor_mensal:plano.valor_mensal,dia_vencimento:10,status:"ativa",inicio_em:new Date().toISOString().slice(0,10)});
        await admin.from("logs").insert({usuario_id:ctx.userClaims?.sub,padaria_id:padaria.id,acao:"criar_padaria",detalhe:{nome,slug}});
        return json({ok:true,padaria});
      }

      if (action === "create_admin") {
        const email=String(body.email??"").trim().toLowerCase(), password=String(body.password??""), nome=String(body.nome??"").trim()||email, padaria_id=String(body.padaria_id??"");
        if(!email||!password||password.length<8||!padaria_id)return json({error:"E-mail, senha de pelo menos 8 caracteres e padaria são obrigatórios."},400);
        const {data:padaria}=await admin.from("padarias").select("id").eq("id",padaria_id).maybeSingle();
        if(!padaria)return json({error:"Padaria não encontrada."},404);
        const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nome}});
        if(createError)throw createError;
        const {error:profileError}=await admin.from("profiles").upsert({id:created.user.id,papel:"admin",padaria_id,nome,login:email,ativo:true});
        if(profileError){await admin.auth.admin.deleteUser(created.user.id);throw profileError;}
        await admin.from("logs").insert({usuario_id:ctx.userClaims?.sub,padaria_id,acao:"criar_admin",detalhe:{admin_id:created.user.id,email}});
        return json({ok:true,user_id:created.user.id,email});
      }

      if (action === "set_admin_active") {
        const user_id=String(body.user_id??""), ativo=Boolean(body.ativo);
        const {data:profile,error:profileError}=await admin.from("profiles").select("id,papel,padaria_id,login").eq("id",user_id).single();
        if(profileError||profile?.papel!=="admin")return json({error:"Administrador não encontrado."},404);
        const {error}=await admin.from("profiles").update({ativo}).eq("id",user_id);if(error)throw error;
        await admin.from("logs").insert({usuario_id:ctx.userClaims?.sub,padaria_id:profile.padaria_id,acao:ativo?"ativar_admin":"desativar_admin",detalhe:{admin_id:user_id,login:profile.login}});
        return json({ok:true});
      }

      if (action === "reset_admin_password") {
        const user_id=String(body.user_id??""), password=String(body.password??"");
        if(password.length<8)return json({error:"A nova senha deve ter pelo menos 8 caracteres."},400);
        const {data:profile,error:profileError}=await admin.from("profiles").select("id,papel,padaria_id,login").eq("id",user_id).single();
        if(profileError||profile?.papel!=="admin")return json({error:"Administrador não encontrado."},404);
        const {error}=await admin.auth.admin.updateUserById(user_id,{password});if(error)throw error;
        await admin.from("logs").insert({usuario_id:ctx.userClaims?.sub,padaria_id:profile.padaria_id,acao:"redefinir_senha_admin",detalhe:{admin_id:user_id,login:profile.login}});
        return json({ok:true});
      }
      return json({error:"Ação inválida."},400);
    } catch(error) {
      console.error(error);
      return json({error:error instanceof Error?error.message:"Erro interno."},500);
    }
  }),
};
