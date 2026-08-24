/**
 * YANSIX CRM — camada de dados
 * Backend: Supabase / PostgreSQL
 */
const STORAGE_KEY="yansix_crm_mock_v5";
const DEFAULT_DATA={CLIENTES:[],NEGOCIACOES:[],INTERACOES:[],TAREFAS:[],USUARIOS:[],CONFIGURACOES:[],PROPOSTAS:[],LOGS:[],HISTORICO:[]};
function cloneData(o){return JSON.parse(JSON.stringify(o))}
function normalizeClient(c){return {...CONFIG.CLIENT_DEFAULTS,...c}}
function normalizeDeal(n){const d={produtoServico:"",probabilidade:"",previsaoFechamento:n?.previsaoFechamento||n?.previsao||"",responsavel:"",origem:"",prioridade:"média",...n};if(d.probabilidade!=="")d.probabilidade=Number(d.probabilidade);return d}
function normalizeUser(u){const out={...CONFIG.USER_DEFAULTS,...u,ativo:u?.ativo!==false};return out}
function normalizeData(data){const out={...cloneData(DEFAULT_DATA),...data};out.USUARIOS=(out.USUARIOS||[]).map(normalizeUser);out.CLIENTES=(out.CLIENTES||[]).map(normalizeClient);out.NEGOCIACOES=(out.NEGOCIACOES||[]).map(normalizeDeal);return out}
let API_TOKEN=localStorage.getItem("yansix_crm_api_token_v1")||"";
function setApiToken(token){API_TOKEN=token||"";if(API_TOKEN)localStorage.setItem("yansix_crm_api_token_v1",API_TOKEN);else localStorage.removeItem("yansix_crm_api_token_v1")}
function tableName(sheet){const t=CONFIG.DB_TABLES[sheet];if(!t)throw new Error(`Tabela não configurada para ${sheet}.`);return t}
function cleanRecord(data){const out={...data};delete out.senha;return out}
async function currentUser(){const {data:{user},error}=await SUPABASE_CLIENT.auth.getUser();if(error)throw error;return user}
const API={
  async login(email,password){
    const {data,error}=await SUPABASE_CLIENT.auth.signInWithPassword({email,password});
    if(error)throw new Error(error.message||"E-mail ou senha inválidos.");
    const authUser=data.user;
    const {data:profile,error:profileError}=await SUPABASE_CLIENT.from(tableName("USUARIOS")).select("*").eq("id",String(authUser.id)).maybeSingle();
    if(profileError)throw new Error(profileError.message);
    if(!profile)throw new Error("Usuário autenticado, mas sem cadastro no CRM. Crie o perfil do usuário no banco antes do primeiro acesso.");
    if(profile.ativo===false){await SUPABASE_CLIENT.auth.signOut();throw new Error("Este usuário está inativo.");}
    const token=data.session?.access_token||"";setApiToken(token);
    return {token,user:normalizeUser(profile),expiresIn:data.session?.expires_in||3600};
  },
  async logout(){await SUPABASE_CLIENT.auth.signOut();setApiToken("");},
  async get(sheet){
    const {data,error}=await SUPABASE_CLIENT.from(tableName(sheet)).select("*");
    if(error)throw new Error(error.message);
    if(sheet===CONFIG.SHEETS.CLIENTES)return (data||[]).map(normalizeClient);
    if(sheet===CONFIG.SHEETS.NEGOCIACOES)return (data||[]).map(normalizeDeal);
    if(sheet===CONFIG.SHEETS.USUARIOS)return (data||[]).map(normalizeUser);
    return data||[];
  },
  async getUsuarios(){return (await this.get(CONFIG.SHEETS.USUARIOS)).map(normalizeUser)},
  async getAll(){
    const sheets=Object.values(CONFIG.SHEETS);
    const values=await Promise.all(sheets.map(s=>this.get(s)));
    const out=Object.fromEntries(sheets.map((s,i)=>[s,values[i]]));
    return {usuarios:out.USUARIOS||[],clientes:out.CLIENTES||[],negociacoes:out.NEGOCIACOES||[],interacoes:out.INTERACOES||[],tarefas:out.TAREFAS||[],propostas:out.PROPOSTAS||[],historico:out.HISTORICO||[],configuracoes:out.CONFIGURACOES||[],logs:out.LOGS||[]};
  },
  async create(sheet,data){
    if(sheet===CONFIG.SHEETS.USUARIOS){
      throw new Error("A criação de usuários exige o endpoint administrativo do Supabase. Configure ADMIN_USER_FUNCTION_URL após a etapa de adequação do Supabase.");
    }
    const prepared=sheet===CONFIG.SHEETS.CLIENTES?normalizeClient(data):sheet===CONFIG.SHEETS.NEGOCIACOES?normalizeDeal(data):cleanRecord(data);
    if(!prepared.id)prepared.id=crypto.randomUUID();
    const {data:created,error}=await SUPABASE_CLIENT.from(tableName(sheet)).insert(prepared).select("*").single();
    if(error)throw new Error(error.message);
    return sheet===CONFIG.SHEETS.CLIENTES?normalizeClient(created):sheet===CONFIG.SHEETS.NEGOCIACOES?normalizeDeal(created):created;
  },
  async update(sheet,id,data){
    const prepared=cleanRecord(data);delete prepared.id;
    const {data:updated,error}=await SUPABASE_CLIENT.from(tableName(sheet)).update(prepared).eq("id",id).select("*").single();
    if(error)throw new Error(error.message);
    return sheet===CONFIG.SHEETS.CLIENTES?normalizeClient(updated):sheet===CONFIG.SHEETS.NEGOCIACOES?normalizeDeal(updated):updated;
  },
  async adminCreateUser(payload){
    if(CONFIG.USER_PROVISIONING_MODE!=="supabase_edge_function")throw new Error("Modo de criação administrativa de usuários não configurado.");
    const url=String(CONFIG.ADMIN_USER_FUNCTION_URL||"").trim();
    if(!url)throw new Error("O endpoint administrativo de usuários ainda não foi configurado. Essa etapa será concluída no Supabase sem expor a service_role no navegador.");
    const {data:{session}}=await SUPABASE_CLIENT.auth.getSession();
    const token=session?.access_token||API_TOKEN;
    if(!token)throw new Error("Sessão administrativa inválida. Faça login novamente.");
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(payload),cache:"no-store"});
    let body={};try{body=await response.json()}catch{}
    if(!response.ok)throw new Error(body?.error||body?.message||`Falha ao criar usuário (${response.status}).`);
    return normalizeUser(body.user||body.profile||body);
  },
  async remove(sheet,id){
    const {error}=await SUPABASE_CLIENT.from(tableName(sheet)).delete().eq("id",id);
    if(error)throw new Error(error.message);return true;
  },
  async audit({clienteId="",entidade,registroId,acao,alteracao,usuario=CONFIG.CURRENT_USER}){
    const entry={id:crypto.randomUUID(),clienteId,entidade,registroId,dataHora:new Date().toISOString(),usuario,acao,alteracao};
    const history=await this.create(CONFIG.SHEETS.HISTORICO,entry);
    try{await this.create(CONFIG.SHEETS.LOGS,{tipo:"AUDITORIA",usuario,acao,entidade,registroId,detalhes:alteracao,dataHora:entry.dataHora})}catch(e){console.warn("LOGS:",e)}
    return history;
  },
  async removeClientCascade(id){
    const {error}=await SUPABASE_CLIENT.from(tableName(CONFIG.SHEETS.CLIENTES)).delete().eq("id",id);
    if(error)throw new Error(error.message);return true;
  }
};
