/**
 * YANSIX CRM — camada de dados
 * Fase 12: usuários, login/perfis, CRUD + histórico/auditoria + automações.
 */
const STORAGE_KEY="yansix_crm_mock_v5";
const DEFAULT_DATA={
  CLIENTES:[
    {id:"1",nome:"Studio Almeida Advocacia",contato:"(21) 99999-0001",whatsapp:"(21) 99999-0001",empresa:"Studio Almeida",origem:"Instagram",tags:"Advocacia",status:"ativo",criadoEm:"2026-08-02",segmento:"Serviços profissionais",potencial:"alto",email:"contato@studioalmeida.com.br"},
    {id:"2",nome:"Clínica Vitalis",contato:"(21) 99999-0002",whatsapp:"(21) 99999-0002",empresa:"Clínica Vitalis",origem:"Indicação",tags:"Saúde, Premium",status:"cliente",criadoEm:"2026-08-06",segmento:"Saúde",potencial:"alto"},
    {id:"3",nome:"Bravo Consultoria",contato:"(21) 99999-0003",whatsapp:"(21) 99999-0003",empresa:"Bravo",origem:"Site",tags:"Consultoria",status:"lead",criadoEm:"2026-08-10",segmento:"Consultoria",potencial:"médio"},
    {id:"4",nome:"Núcleo Óptica",contato:"(21) 99999-0004",whatsapp:"(21) 99999-0004",empresa:"Núcleo",origem:"WhatsApp",tags:"Saúde",status:"lead",criadoEm:"2026-08-11",segmento:"Varejo",potencial:"médio"}
  ],
  NEGOCIACOES:[
    {id:"1",clienteId:"1",etapa:"proposta",valor:4500,previsao:"2026-09-05"},
    {id:"2",clienteId:"2",etapa:"contato",valor:3200,previsao:"2026-09-12"},
    {id:"3",clienteId:"3",etapa:"lead",valor:2800,previsao:"2026-09-20"},
    {id:"4",clienteId:"4",etapa:"lead",valor:5600,previsao:"2026-09-25"},
    {id:"5",clienteId:"2",etapa:"fechado",valor:7500,previsao:"2026-08-08"}
  ],
  INTERACOES:[
    {id:"1",clienteId:"1",canal:"WhatsApp",tipo:"WhatsApp",data:"2026-08-08",hora:"10:30",descricao:"Envio de apresentação comercial.",resultado:"Apresentação enviada",proximoContato:"2026-08-13"},
    {id:"2",clienteId:"2",canal:"Reunião",tipo:"Reunião",data:"2026-08-09",hora:"15:00",descricao:"Reunião de diagnóstico inicial.",resultado:"Cliente demonstrou interesse",proximoContato:"2026-08-14"}
  ],
  TAREFAS:[
    {id:"1",clienteId:"1",titulo:"Retornar proposta comercial",data:"2026-08-12",hora:"10:00",canal:"Ligação",tipo:"Ligação",status:"pendente"},
    {id:"2",clienteId:"2",titulo:"Enviar materiais da reunião",data:"2026-08-13",hora:"14:00",canal:"E-mail",tipo:"E-mail",status:"pendente"},
    {id:"3",clienteId:"3",titulo:"Fazer primeiro contato",data:"2026-08-11",hora:"16:30",canal:"WhatsApp",tipo:"WhatsApp",status:"pendente"}
  ],
  USUARIOS:[],
  CONFIGURACOES:[
    {id:"pipelineStages",chave:"pipelineStages",valor:JSON.stringify(CONFIG.PIPELINE_STAGES)},
    {id:"automationRules",chave:"automationRules",valor:JSON.stringify(CONFIG.AUTOMATION_DEFAULTS)},
    {id:"integrations",chave:"integrations",valor:JSON.stringify(CONFIG.INTEGRATION_DEFAULTS)},
  ],
  PROPOSTAS:[],
  LOGS:[],
  HISTORICO:[
    {id:"h1",clienteId:"1",entidade:"CLIENTES",registroId:"1",dataHora:"2026-08-10T14:10:00",usuario:"Administrador",acao:"Cadastro",alteracao:"Cliente cadastrado"},
    {id:"h2",clienteId:"1",entidade:"NEGOCIACOES",registroId:"1",dataHora:"2026-08-10T15:20:00",usuario:"Administrador",acao:"Criação",alteracao:"Negociação criada · R$ 4.500,00"},
    {id:"h3",clienteId:"2",entidade:"CLIENTES",registroId:"2",dataHora:"2026-08-09T11:30:00",usuario:"Administrador",acao:"Cadastro",alteracao:"Cliente cadastrado"}
  ]
};
function cloneData(o){return JSON.parse(JSON.stringify(o))}
function normalizeClient(c){return {...CONFIG.CLIENT_DEFAULTS,...c}}
function normalizeDeal(n){const d={produtoServico:"",probabilidade:"",previsaoFechamento:n?.previsaoFechamento||n?.previsao||"",responsavel:"",origem:"",prioridade:"média",...n};if(d.probabilidade!=="")d.probabilidade=Number(d.probabilidade);return d}
function normalizeUser(u){const out={...CONFIG.USER_DEFAULTS,...u,ativo:u?.ativo!==false};if(out.id==="u-admin"||out.email==="admin@yansix.local")out.email=CONFIG.USER_DEFAULTS.email;return out}
function normalizeData(data){const out={...cloneData(DEFAULT_DATA),...data};out.USUARIOS=(out.USUARIOS||[]).map(normalizeUser);out.CLIENTES=(out.CLIENTES||[]).map(normalizeClient);out.NEGOCIACOES=(out.NEGOCIACOES||[]).map(normalizeDeal);out.HISTORICO=out.HISTORICO||[];out.LOGS=out.LOGS||[];out.PROPOSTAS=out.PROPOSTAS||[];out.CONFIGURACOES=out.CONFIGURACOES||cloneData(DEFAULT_DATA.CONFIGURACOES);return out}
let API_TOKEN=localStorage.getItem("yansix_crm_api_token_v1")||"";
function setApiToken(token){API_TOKEN=token||"";if(API_TOKEN)localStorage.setItem("yansix_crm_api_token_v1",API_TOKEN);else localStorage.removeItem("yansix_crm_api_token_v1")}
const API={
  _loadMock(){try{const s=localStorage.getItem(STORAGE_KEY);if(s){const d=normalizeData(JSON.parse(s));this._saveMock(d);return d}}catch(e){console.warn(e)}const d=normalizeData(DEFAULT_DATA);this._saveMock(d);return d},
  _saveMock(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d))}catch(e){console.warn(e)}},
  async _request(url,options={}){
    let lastError;
    for(let attempt=0;attempt<2;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        const res=await fetch(url,{...options,signal:controller.signal,cache:"no-store"});
        const text=await res.text();let p={};try{p=text?JSON.parse(text):{}}catch{p={ok:false,error:text}}
        if(!res.ok||p.ok===false)throw new Error(p.error||`HTTP ${res.status}`);
        return p.data!==undefined?p.data:p;
      }catch(e){lastError=e;if(attempt===0)await new Promise(r=>setTimeout(r,350));}
      finally{clearTimeout(timer)}
    }
    throw lastError||new Error("Falha de comunicação com a API.");
  },
  async login(email,password){if(CONFIG.MOCK){const u=this._loadMock().USUARIOS.find(x=>x.email.toLowerCase()===email.toLowerCase()&&(x.senha===password));if(!u)throw new Error("E-mail ou senha inválidos.");return {token:"mock",user:normalizeUser(u),expiresIn:1800}}const d=await this._request(CONFIG.SHEETS_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"login",email,password})});setApiToken(d.token);return d},
  async logout(){if(!CONFIG.MOCK&&API_TOKEN){try{await this._request(CONFIG.SHEETS_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"logout",token:API_TOKEN})})}catch{}}setApiToken("")},
  async get(sheet){if(CONFIG.MOCK)return this._loadMock()[sheet]||[];const d=await this._request(`${CONFIG.SHEETS_API_URL}?action=list&sheet=${encodeURIComponent(sheet)}&token=${encodeURIComponent(API_TOKEN)}`);return sheet===CONFIG.SHEETS.CLIENTES?(d||[]).map(normalizeClient):d},
  async getUsuarios(){return (await this.get(CONFIG.SHEETS.USUARIOS)).map(normalizeUser)},
  async getAll(){const sheets=Object.values(CONFIG.SHEETS).filter(s=>s!=="LOGS");const values=await Promise.all(sheets.map(s=>this.get(s)));const out=Object.fromEntries(sheets.map((s,i)=>[s,values[i]]));return {usuarios:(out.USUARIOS||[]).map(normalizeUser),clientes:out.CLIENTES||[],negociacoes:(out.NEGOCIACOES||[]).map(normalizeDeal),interacoes:out.INTERACOES||[],tarefas:out.TAREFAS||[],propostas:out.PROPOSTAS||[],historico:out.HISTORICO||[],configuracoes:out.CONFIGURACOES||[],logs:[]}},
  async create(sheet,data){const prepared=sheet===CONFIG.SHEETS.CLIENTES?normalizeClient(data):sheet===CONFIG.SHEETS.NEGOCIACOES?normalizeDeal(data):data;if(CONFIG.MOCK){const all=this._loadMock(),record={id:crypto.randomUUID(),...prepared};if(sheet===CONFIG.SHEETS.CLIENTES&&!record.criadoEm)record.criadoEm=new Date().toISOString().slice(0,10);(all[sheet]??=[]).push(record);this._saveMock(all);return record}return this._request(CONFIG.SHEETS_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"create",sheet,data:prepared,token:API_TOKEN})})},
  async update(sheet,id,data){if(CONFIG.MOCK){const all=this._loadMock(),list=all[sheet]||[],i=list.findIndex(x=>String(x.id)===String(id));if(i<0)throw new Error("Registro não encontrado.");list[i]={...list[i],...data};if(sheet===CONFIG.SHEETS.CLIENTES)list[i]=normalizeClient(list[i]);if(sheet===CONFIG.SHEETS.NEGOCIACOES)list[i]=normalizeDeal(list[i]);this._saveMock(all);return list[i]}return this._request(CONFIG.SHEETS_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"update",sheet,id,data,token:API_TOKEN})})},
  async remove(sheet,id){if(CONFIG.MOCK){const all=this._loadMock();all[sheet]=(all[sheet]||[]).filter(x=>String(x.id)!==String(id));this._saveMock(all);return true}return this._request(CONFIG.SHEETS_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"delete",sheet,id,token:API_TOKEN})})},
  async audit({clienteId="",entidade,registroId,acao,alteracao,usuario=CONFIG.CURRENT_USER}){
    const entry={clienteId,entidade,registroId,dataHora:new Date().toISOString(),usuario,acao,alteracao};
    const history=await this.create(CONFIG.SHEETS.HISTORICO,entry);
    try{await this.create("LOGS",{tipo:"AUDITORIA",usuario,acao,entidade,registroId,detalhes:alteracao,dataHora:entry.dataHora})}catch(e){console.warn("LOGS:",e)}
    return history;
  },
  async removeClientCascade(id){const all=this._loadMock();if(CONFIG.MOCK){for(const s of ["NEGOCIACOES","TAREFAS","INTERACOES"])all[s]=(all[s]||[]).filter(x=>String(x.clienteId)!==String(id));all.CLIENTES=(all.CLIENTES||[]).filter(x=>String(x.id)!==String(id));this._saveMock(all);return true}const related=["NEGOCIACOES","TAREFAS","INTERACOES"];for(const s of related){const list=await this.get(s);for(const r of list.filter(x=>String(x.clienteId)===String(id)))await this.remove(s,r.id)}return this.remove(CONFIG.SHEETS.CLIENTES,id)}
};
