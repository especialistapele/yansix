/**
 * YANSIX CRM — Configuração central
 * PostgreSQL online via Supabase.
 */
const CONFIG={
  APP_NAME:"YANSIX CRM",
  MOCK:false,
  SUPABASE_URL:"https://zxeupenncextzrqgthqx.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:"sb_publishable_WceObQ8ZcYPKPvNPBBvSEg_MMKx5VJ-",
  SYNC_INTERVAL_MS:60000,
  SESSION_TIMEOUT_MS:30*60*1000,
  INACTIVITY_WARNING_MS:5*60*1000,
  MAX_LOGIN_ATTEMPTS:5,
  LOCKOUT_MS:15*60*1000,
  BACKUP_INTERVAL_MS:24*60*60*1000,
  CURRENT_USER:"Administrador",
  SESSION_KEY:"yansix_crm_session_v1",
  DEFAULT_USER_ROLE:"Administrador",
  SHEETS:{LOGS:"LOGS",USUARIOS:"USUARIOS",CLIENTES:"CLIENTES",NEGOCIACOES:"NEGOCIACOES",INTERACOES:"INTERACOES",TAREFAS:"TAREFAS",PROPOSTAS:"PROPOSTAS",HISTORICO:"HISTORICO",CONFIGURACOES:"CONFIGURACOES"},
  DB_TABLES:{LOGS:"logs",USUARIOS:"usuarios",CLIENTES:"clientes",NEGOCIACOES:"negociacoes",INTERACOES:"interacoes",TAREFAS:"tarefas",PROPOSTAS:"propostas",HISTORICO:"historico",CONFIGURACOES:"configuracoes"},
  PIPELINE_STAGES:[
    {id:"lead",label:"Lead",defaultProbability:10},{id:"contato",label:"Contato",defaultProbability:25},{id:"qualificacao",label:"Qualificação",defaultProbability:40},{id:"reuniao",label:"Reunião",defaultProbability:60},{id:"proposta",label:"Proposta",defaultProbability:75},{id:"negociacao",label:"Negociação",defaultProbability:85},{id:"fechado",label:"Fechado",defaultProbability:100},{id:"perdido",label:"Perdido",defaultProbability:0}
  ],
  DEAL_ORIGINS:["Instagram","Facebook","WhatsApp","Site","Google","Indicação","Evento","E-mail","Prospecção","Outbound","Outro"],
  DEAL_PRIORITIES:["baixa","média","alta","urgente"],
  CHANNELS:["WhatsApp","Ligação","E-mail","Reunião","Proposta","Visita","Observação"],
  ACTIVITY_TYPES:["Ligação","WhatsApp","E-mail","Reunião","Proposta","Visita","Observação"],
  TASK_STATUS:["pendente","concluida"],
  PROPOSAL_STATUS:["rascunho","enviada","visualizada","negociacao","aprovada","recusada","expirada"],
  PROPOSAL_STATUSES_LABEL:{rascunho:"Rascunho",enviada:"Enviada",visualizada:"Visualizada",negociacao:"Negociação",aprovada:"Aprovada",recusada:"Recusada",expirada:"Expirada"},
  USER_ROLES:{
    Administrador:{label:"Administrador",permissions:["*"]},
    Gestor:{label:"Gestor",permissions:["dashboard","clientes","funil","tarefas","interacoes","calendario","propostas","relatorios","configuracoes"]},
    Vendedor:{label:"Vendedor",permissions:["dashboard","clientes","funil","tarefas","interacoes","calendario","propostas"]}
  },
  USER_DEFAULTS:{nome:"Administrador",email:"yansix.tech@gmail.com",perfil:"Administrador",gestorId:"",ativo:true},
  AUTOMATION_DEFAULTS:{followupProposalDays:3,stalledLeadDays:7,recoveryDays:30,reminderDays:0,enabled:true},
  SECURITY:{sessionTimeoutMs:30*60*1000,inactivityWarningMs:5*60*1000,maxLoginAttempts:5,lockoutMs:15*60*1000,backupIntervalMs:24*60*60*1000},
  INTEGRATION_DEFAULTS:{email:"yansix.tech@gmail.com",whatsappBusiness:"",googleCalendarEnabled:true,siteWebhookEnabled:true,metaEnabled:false,siteWebhookSecret:""},
  CLIENT_SECTIONS:[
    {id:"pessoais",label:"Dados pessoais"},{id:"comerciais",label:"Dados comerciais"},{id:"endereco",label:"Endereço"},{id:"digital",label:"Presença digital"},{id:"interno",label:"Informações internas"}
  ],
  CLIENT_FIELDS:[
    {id:"nome",label:"Nome completo",section:"pessoais",type:"text",required:true},{id:"cpfCnpj",label:"CPF / CNPJ",section:"pessoais",type:"text"},{id:"contato",label:"Telefone",section:"pessoais",type:"tel"},{id:"whatsapp",label:"WhatsApp",section:"pessoais",type:"tel"},{id:"email",label:"E-mail",section:"pessoais",type:"email"},{id:"dataNascimento",label:"Data de nascimento",section:"pessoais",type:"date"},{id:"empresa",label:"Empresa",section:"comerciais",type:"text"},{id:"cargo",label:"Cargo",section:"comerciais",type:"text"},{id:"segmento",label:"Segmento",section:"comerciais",type:"text"},{id:"porte",label:"Porte da empresa",section:"comerciais",type:"select",options:["MEI","Microempresa","Pequena empresa","Média empresa","Grande empresa","Pessoa física","Outro"]},{id:"origem",label:"Origem do lead",section:"comerciais",type:"select",options:["Instagram","Facebook","WhatsApp","Site","Google","Indicação","Evento","E-mail","Prospecção","Outro"]},{id:"responsavel",label:"Responsável",section:"comerciais",type:"text"},{id:"status",label:"Status",section:"comerciais",type:"select",required:true,options:["lead","prospect","ativo","cliente","inativo","perdido"]},{id:"potencial",label:"Potencial comercial",section:"comerciais",type:"select",options:["baixo","médio","alto"]},{id:"cep",label:"CEP",section:"endereco",type:"text"},{id:"rua",label:"Rua",section:"endereco",type:"text"},{id:"numero",label:"Número",section:"endereco",type:"text"},{id:"complemento",label:"Complemento",section:"endereco",type:"text"},{id:"bairro",label:"Bairro",section:"endereco",type:"text"},{id:"cidade",label:"Cidade",section:"endereco",type:"text"},{id:"estado",label:"Estado",section:"endereco",type:"text"},{id:"instagram",label:"Instagram",section:"digital",type:"url"},{id:"facebook",label:"Facebook",section:"digital",type:"url"},{id:"linkedin",label:"LinkedIn",section:"digital",type:"url"},{id:"site",label:"Site",section:"digital",type:"url"},{id:"tags",label:"Tags",section:"interno",type:"text"},{id:"preferencias",label:"Preferências",section:"interno",type:"textarea"},{id:"observacoes",label:"Observações",section:"interno",type:"textarea"}
  ],
  CLIENT_DEFAULTS:{nome:"",cpfCnpj:"",contato:"",whatsapp:"",email:"",dataNascimento:"",empresa:"",cargo:"",segmento:"",porte:"",origem:"",responsavel:"",status:"lead",potencial:"",cep:"",rua:"",numero:"",complemento:"",bairro:"",cidade:"",estado:"",instagram:"",facebook:"",linkedin:"",site:"",tags:"",preferencias:"",observacoes:""}
};

if(!window.supabase?.createClient) console.error("Supabase SDK não carregado.");
const SUPABASE_CLIENT=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
