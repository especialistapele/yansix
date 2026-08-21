let STATE={usuarios:[],clientes:[],negociacoes:[],interacoes:[],tarefas:[],propostas:[],historico:[],configuracoes:[]};
let SESSION=null;
let SESSION_LAST_ACTIVITY=Date.now();
let SESSION_WARNING_SHOWN=false;
let LOGIN_LOCK={attempts:0,lockedUntil:0};
let agendaFilter="atrasadas";
let currentView="dashboard";
let AUTOMATION_RULES={...CONFIG.AUTOMATION_DEFAULTS};
let INTEGRATION_SETTINGS={...CONFIG.INTEGRATION_DEFAULTS};

/* =========================================================
   ESTADO DE CARREGAMENTO DOS BOTÕES
   Deriva o texto "...ando" a partir do verbo do rótulo atual
   (Criar → Criando..., Salvar/Registrar → Salvando..., Excluir → Excluindo...)
   e desabilita o botão durante o processamento (evita duplo clique).
   ========================================================= */
function loadingLabelFor(text){
  const t=String(text||"").trim().toLowerCase();
  if(t.startsWith("criar"))return"Criando...";
  if(t.startsWith("excluir"))return"Excluindo...";
  if(t.startsWith("salvar")||t.startsWith("registrar")||t.startsWith("atualizar"))return"Salvando...";
  return"Enviando...";
}
async function withButtonLoading(btn,task){
  if(!btn)return task();
  const original=btn.textContent;
  btn.disabled=true;btn.textContent=loadingLabelFor(original);
  try{return await task()}
  finally{btn.disabled=false;btn.textContent=original}
}
function submitButtonOf(e){return e?.submitter||e?.target?.querySelector?.('button[type="submit"]')||null}

document.addEventListener("DOMContentLoaded",async()=>{
  buildClientForm();initNav();initEvents();initClock();
  restoreSession();
  const hash=(location.hash||"#dashboard").slice(1);showView(document.querySelector(`[data-view="${hash}"]`)?hash:"dashboard");
  setInterval(()=>{enforceSession();syncAll({silent:true})},CONFIG.SYNC_INTERVAL_MS);
  setInterval(enforceSession,30000);
  ["click","keydown","mousemove","touchstart"].forEach(evt=>document.addEventListener(evt,()=>{if(SESSION)touchSession()},{passive:true}));
  loadLoginLock();
});

function initNav(){
  document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();showView(a.dataset.view);document.getElementById("sidebar").classList.remove("open")}));
  document.querySelectorAll("[data-go-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.goView)));
  document.getElementById("mobile-menu").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
}
function hasPermission(view){const p=SESSION?.perfil||"Vendedor",rules=CONFIG.USER_ROLES[p]?.permissions||[];return rules.includes("*")||rules.includes(view)}
function showView(view){
  if(view!=="dashboard"&&!hasPermission(view)){toast("Seu perfil não possui acesso a este módulo.","error");view="dashboard"}
  currentView=view;document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===`view-${view}`));history.replaceState(null,"",`#${view}`);
  if(view==="dashboard")renderDashboard();if(view==="clientes")renderClients();if(view==="funil")renderKanban();if(view==="tarefas")renderTasks();if(view==="interacoes")renderInteractions();if(view==="calendario")renderAgenda();if(view==="propostas")renderProposals();if(view==="relatorios")renderReports();if(view==="configuracoes")renderAutomationSettings();if(view==="integracoes")renderIntegrations();if(view==="usuarios")renderUsers();
}
function applyPermissions(){
  document.querySelectorAll(".nav-link").forEach(el=>{el.classList.toggle("permission-hidden",!hasPermission(el.dataset.view));});
  document.querySelectorAll(".admin-only,.admin-only-view").forEach(el=>el.classList.toggle("permission-hidden",SESSION?.perfil!=="Administrador"));
  const badge=document.getElementById("session-user");if(badge&&SESSION)badge.innerHTML=`<strong>${esc(SESSION.nome)}</strong> · ${esc(SESSION.perfil)} <button class="logout-button" id="logout-button" type="button">Sair</button>`;
  document.getElementById("logout-button")?.addEventListener("click",logout);
}
function loadLoginLock(){try{LOGIN_LOCK=JSON.parse(localStorage.getItem("yansix_login_lock_v1"))||LOGIN_LOCK}catch{}}
function saveLoginLock(){localStorage.setItem("yansix_login_lock_v1",JSON.stringify(LOGIN_LOCK))}
function clearLoginLock(){LOGIN_LOCK={attempts:0,lockedUntil:0};saveLoginLock()}
async function restoreSession(){
  try{
    const raw=localStorage.getItem(CONFIG.SESSION_KEY),now=Date.now();
    if(raw){const u=JSON.parse(raw);if(u.expiresAt>now&&API_TOKEN){SESSION=u;CONFIG.CURRENT_USER=u.nome;SESSION_LAST_ACTIVITY=now;applyPermissions();document.getElementById("login-overlay").hidden=true;await syncAll({silent:false});return;}}
  }catch{}
  setApiToken("");showLogin();
}
function showLogin(){document.getElementById("login-overlay").hidden=false;document.getElementById("login-email")?.focus();}
async function logout(reason="Sessão encerrada."){try{await API.logout()}catch{}SESSION=null;localStorage.removeItem(CONFIG.SESSION_KEY);SESSION_LAST_ACTIVITY=Date.now();SESSION_WARNING_SHOWN=false;showLogin();toast(reason);}
function touchSession(){if(!SESSION)return;SESSION_LAST_ACTIVITY=Date.now();SESSION_WARNING_SHOWN=false;SESSION.expiresAt=Date.now()+CONFIG.SECURITY.sessionTimeoutMs;localStorage.setItem(CONFIG.SESSION_KEY,JSON.stringify(SESSION));}
function enforceSession(){if(!SESSION)return;const idle=Date.now()-SESSION_LAST_ACTIVITY;if(idle>=CONFIG.SECURITY.sessionTimeoutMs){logout("Sua sessão expirou por inatividade.");return;}if(idle>=CONFIG.SECURITY.sessionTimeoutMs-CONFIG.SECURITY.inactivityWarningMs&&!SESSION_WARNING_SHOWN){SESSION_WARNING_SHOWN=true;toast("Sua sessão expirará em breve por inatividade.","error");}}
async function loginUser(e){
  e.preventDefault();const email=document.getElementById("login-email").value.trim().toLowerCase(),senha=document.getElementById("login-password").value,err=document.getElementById("login-error");
  loadLoginLock();if(LOGIN_LOCK.lockedUntil>Date.now()){const mins=Math.ceil((LOGIN_LOCK.lockedUntil-Date.now())/60000);err.textContent=`Acesso temporariamente bloqueado. Tente novamente em ${mins} min.`;return;}
  try{const result=await API.login(email,senha);clearLoginLock();setApiToken(result.token);const user=result.user;SESSION={...user,expiresAt:Date.now()+CONFIG.SECURITY.sessionTimeoutMs};CONFIG.CURRENT_USER=user.nome;SESSION_LAST_ACTIVITY=Date.now();localStorage.setItem(CONFIG.SESSION_KEY,JSON.stringify(SESSION));err.textContent="";document.getElementById("login-form").reset();document.getElementById("login-overlay").hidden=true;applyPermissions();await syncAll({silent:false});showView("dashboard");toast(`Bem-vindo, ${user.nome}.`);}catch(error){LOGIN_LOCK.attempts++;if(LOGIN_LOCK.attempts>=CONFIG.SECURITY.maxLoginAttempts)LOGIN_LOCK.lockedUntil=Date.now()+CONFIG.SECURITY.lockoutMs;saveLoginLock();err.textContent=LOGIN_LOCK.lockedUntil>Date.now()?"Muitas tentativas. Acesso bloqueado temporariamente.":(error.message||"E-mail ou senha inválidos.");setApiToken("");}
}
function initClock(){const el=document.getElementById("global-search");el.addEventListener("keydown",e=>{if(e.key==="Enter")globalSearch(el.value)});document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();el.focus()}})}
function globalSearch(q){q=q.trim().toLowerCase();if(!q)return;const c=STATE.clientes.find(x=>[x.nome,x.empresa,x.email,x.contato].join(" ").toLowerCase().includes(q));const d=STATE.negociacoes.find(x=>String(x.id)===q||[clientById(x.clienteId)?.nome,x.produtoServico,x.responsavel,x.origem].join(" ").toLowerCase().includes(q));const t=STATE.tarefas.find(x=>x.titulo.toLowerCase().includes(q));if(c){showView("clientes");document.getElementById("client-search").value=q;renderClients();openDetail(c.id)}else if(d){showView("funil");openDealModal(d.id)}else if(t){showView("tarefas");toast("Tarefa encontrada.")}else toast("Nenhum registro encontrado.","error")}

function initEvents(){
  document.getElementById("login-form").onsubmit=loginUser;
  document.getElementById("new-user").onclick=()=>openUserModal();
  document.getElementById("user-form").onsubmit=saveUser;
  document.getElementById("quick-new-client").onclick=()=>openClientModal();
  document.getElementById("new-client").onclick=()=>openClientModal();
  document.getElementById("new-deal").onclick=()=>openDealModal();
  document.getElementById("new-task").onclick=()=>openTaskModal();
  document.getElementById("new-interaction").onclick=()=>openInteractionModal();
  document.getElementById("new-proposal").onclick=()=>openProposalModal();
  document.getElementById("report-period").onchange=renderReports;document.getElementById("report-refresh").onclick=renderReports;
  document.getElementById("save-automation").onclick=saveAutomationRules;
  document.getElementById("save-integrations").onclick=saveIntegrationSettings;
  document.getElementById("test-email-link").onclick=testEmailIntegration;
  document.getElementById("test-whatsapp-link").onclick=testWhatsAppIntegration;
  document.getElementById("copy-webhook").onclick=copyWebhookInfo;
  document.getElementById("proposal-form").onsubmit=saveProposal;
  document.getElementById("proposal-delete").onclick=()=>deleteProposal(document.getElementById("proposal-id").value);
  document.getElementById("proposal-print").onclick=printProposalFromModal;
  ["proposal-qty","proposal-unit","proposal-discount"].forEach(id=>document.getElementById(id).addEventListener("input",updateProposalTotal));
  document.getElementById("proposal-client").onchange=()=>fillProposalDeals(document.getElementById("proposal-client").value);
  document.getElementById("proposal-search").addEventListener("input",renderProposals);
  document.getElementById("proposal-filter-status").addEventListener("change",renderProposals);
  document.getElementById("clear-proposal-filters").onclick=()=>{document.getElementById("proposal-search").value="";document.getElementById("proposal-filter-status").value="";renderProposals()};
  document.getElementById("calendar-new-task").onclick=()=>openTaskModal();
  document.querySelectorAll("#agenda-tabs button").forEach(b=>b.onclick=()=>{agendaFilter=b.dataset.agenda;document.querySelectorAll("#agenda-tabs button").forEach(x=>x.classList.toggle("active",x===b));renderAgenda()});
  ["client-search","filter-tag","filter-origin","filter-status"].forEach(id=>document.getElementById(id).addEventListener("input",renderClients));
  document.getElementById("clear-filters").onclick=()=>{["client-search","filter-tag","filter-origin","filter-status"].forEach(id=>document.getElementById(id).value="");renderClients()};
  document.getElementById("task-filter").onchange=renderTasks;
  ["deal-search","deal-filter-priority","deal-filter-responsavel","deal-filter-origin"].forEach(id=>document.getElementById(id).addEventListener(id==="deal-search"?"input":"change",renderKanban));
  document.getElementById("clear-deal-filters").onclick=()=>{["deal-search","deal-filter-priority","deal-filter-responsavel","deal-filter-origin"].forEach(id=>document.getElementById(id).value="");renderKanban()};
  document.getElementById("configure-pipeline").onclick=openPipelineModal;
  document.getElementById("pipeline-form").onsubmit=savePipelineStages;
  document.getElementById("client-form").onsubmit=saveClient;
  document.getElementById("deal-form").onsubmit=saveDeal;
  document.getElementById("task-form").onsubmit=saveTask;
  document.getElementById("interaction-form").onsubmit=saveInteraction;
  document.getElementById("interaction-delete").onclick=()=>deleteInteraction(document.getElementById("interaction-id").value);
  document.getElementById("deal-delete").onclick=()=>deleteDeal(document.getElementById("deal-id").value);
  document.getElementById("task-delete").onclick=()=>deleteTask(document.getElementById("task-id").value);
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.closeModal).close());
}
function gestorNome(id){return (STATE.usuarios||[]).find(u=>String(u.id)===String(id))?.nome||"—"}
function renderUsers(){if(SESSION?.perfil!=="Administrador")return;const rows=[`<div class="user-row user-head"><span>Nome</span><span>E-mail</span><span>Perfil</span><span>Gestor</span><span>Status</span><span></span></div>`];for(const u of STATE.usuarios||[]){rows.push(`<div class="user-row"><span><strong>${esc(u.nome)}</strong></span><span>${esc(u.email)}</span><span>${esc(u.perfil)}</span><span>${u.perfil==="Vendedor"?esc(gestorNome(u.gestorId)):"—"}</span><span class="user-status ${u.ativo!==false?"active":"inactive"}">${u.ativo!==false?"Ativo":"Inativo"}</span><span class="user-actions"><button class="btn btn-ghost" onclick="openUserModal('${esc(u.id)}')">Editar</button></span></div>`)}document.getElementById("users-table").innerHTML=rows.join("")}
function fillGestorSelect(selected=""){
  const el=document.getElementById("user-gestor");if(!el)return;
  const gestores=(STATE.usuarios||[]).filter(u=>u.perfil==="Gestor"&&u.ativo!==false);
  el.innerHTML=`<option value="">Sem gestor vinculado</option>`+gestores.map(g=>`<option value="${esc(g.id)}">${esc(g.nome)}</option>`).join("");
  el.value=selected||"";
}
function toggleGestorField(){const perfil=document.getElementById("user-role").value;document.getElementById("user-gestor-field").classList.toggle("hidden",perfil!=="Vendedor")}
function openUserModal(id=""){if(SESSION?.perfil!=="Administrador")return;const u=(STATE.usuarios||[]).find(x=>String(x.id)===String(id));document.getElementById("user-id").value=u?.id||"";document.getElementById("user-modal-title").textContent=u?"Editar usuário":"Novo usuário";document.getElementById("user-save-btn").textContent=u?"Salvar usuário":"Criar usuário";document.getElementById("user-name").value=u?.nome||"";document.getElementById("user-email").value=u?.email||"";document.getElementById("user-password").value="";document.getElementById("user-role").value=u?.perfil||"Vendedor";document.getElementById("user-role").onchange=toggleGestorField;fillGestorSelect(u?.gestorId||"");toggleGestorField();document.getElementById("user-active").checked=u?.ativo!==false;document.getElementById("user-modal").showModal()}
async function saveUser(e){e.preventDefault();if(SESSION?.perfil!=="Administrador")return;const id=document.getElementById("user-id").value,nome=document.getElementById("user-name").value.trim(),email=document.getElementById("user-email").value.trim().toLowerCase(),senha=document.getElementById("user-password").value,perfil=document.getElementById("user-role").value,gestorId=perfil==="Vendedor"?document.getElementById("user-gestor").value:"",ativo=document.getElementById("user-active").checked;
  const btn=submitButtonOf(e)||document.getElementById("user-save-btn");
  await withButtonLoading(btn,async()=>{
  try{const duplicate=(STATE.usuarios||[]).find(u=>u.email.toLowerCase()===email&&String(u.id)!==String(id));if(duplicate)throw new Error("Já existe um usuário com este e-mail.");if(!id&&!senha)throw new Error("Informe uma senha para o novo usuário.");const data={nome,email,perfil,gestorId,ativo};if(senha)data.senha=senha;let saved;if(id)saved=await API.update(CONFIG.SHEETS.USUARIOS,id,data);else saved=await API.create(CONFIG.SHEETS.USUARIOS,{...data,senha,criadoEm:new Date().toISOString()});const i=STATE.usuarios.findIndex(u=>String(u.id)===String(saved.id));if(i>=0)STATE.usuarios[i]={...STATE.usuarios[i],...saved};else STATE.usuarios.push(saved);document.getElementById("user-modal").close();renderUsers();toast("Usuário salvo. As permissões deste usuário são aplicadas a partir do próximo login ou da próxima renovação de sessão (até 30 min).");if(String(SESSION.id)===String(saved.id)){SESSION={...SESSION,...saved};localStorage.setItem(CONFIG.SESSION_KEY,JSON.stringify(SESSION));CONFIG.CURRENT_USER=SESSION.nome;applyPermissions()}}catch(err){toast(err.message||"Não foi possível salvar o usuário.","error")}
  });
}

function applyIntegrationConfig(configs){const rec=(configs||[]).find(x=>x.chave==="integrations");if(!rec){INTEGRATION_SETTINGS={...CONFIG.INTEGRATION_DEFAULTS};return}try{INTEGRATION_SETTINGS={...CONFIG.INTEGRATION_DEFAULTS,...JSON.parse(rec.valor||"{}")}}catch{INTEGRATION_SETTINGS={...CONFIG.INTEGRATION_DEFAULTS}}}
function renderIntegrations(){
  if(!document.getElementById("integration-email"))return;
  document.getElementById("integration-email").value=INTEGRATION_SETTINGS.email||CONFIG.USER_DEFAULTS.email;
  document.getElementById("integration-whatsapp").value=INTEGRATION_SETTINGS.whatsappBusiness||"";
  document.getElementById("integration-calendar").checked=INTEGRATION_SETTINGS.googleCalendarEnabled!==false;
  document.getElementById("integration-webhook").checked=INTEGRATION_SETTINGS.siteWebhookEnabled!==false;
  document.getElementById("integration-meta").checked=INTEGRATION_SETTINGS.metaEnabled===true;
  document.getElementById("integration-secret").value=INTEGRATION_SETTINGS.siteWebhookSecret||"";
  document.getElementById("webhook-status").textContent=INTEGRATION_SETTINGS.siteWebhookEnabled!==false?"Ativo no endpoint do Apps Script":"Desativado";
}
async function saveIntegrationSettings(){if(!hasPermission("integracoes"))return;const settings={email:document.getElementById("integration-email").value.trim().toLowerCase()||CONFIG.USER_DEFAULTS.email,whatsappBusiness:document.getElementById("integration-whatsapp").value.trim(),googleCalendarEnabled:document.getElementById("integration-calendar").checked,siteWebhookEnabled:document.getElementById("integration-webhook").checked,metaEnabled:document.getElementById("integration-meta").checked,siteWebhookSecret:document.getElementById("integration-secret").value.trim()};try{const rec=STATE.configuracoes?.find(x=>x.chave==="integrations");if(rec)await API.update(CONFIG.SHEETS.CONFIGURACOES,rec.id,{valor:JSON.stringify(settings)});else await API.create(CONFIG.SHEETS.CONFIGURACOES,{chave:"integrations",valor:JSON.stringify(settings)});INTEGRATION_SETTINGS=settings;await syncAll({silent:true});toast("Integrações salvas.")}catch(e){toast(e.message||"Não foi possível salvar as integrações.","error")}}
function testEmailIntegration(){const to=INTEGRATION_SETTINGS.email||CONFIG.USER_DEFAULTS.email;window.location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("Teste de integração — YANSIX CRM")}&body=${encodeURIComponent("Este é um teste da integração de e-mail do YANSIX CRM.")}`}
function testWhatsAppIntegration(){const n=String(INTEGRATION_SETTINGS.whatsappBusiness||"").replace(/\D/g,"");if(!n){toast("Cadastre o número do WhatsApp Business primeiro.","error");return}window.open(`https://wa.me/${n.length<=11?"55":""}${n}?text=${encodeURIComponent("Teste de integração — YANSIX CRM")}`,"_blank","noopener")}
async function copyWebhookInfo(){const url=CONFIG.SHEETS_API_URL||"URL do Web App do Google Apps Script";try{await navigator.clipboard.writeText(url);toast("URL do Web App copiada.")}catch{toast(url,"error")}}

async function syncAll({silent=false}={}){
  if(!CONFIG.MOCK&&!SESSION)return;
  try{
    const data=await API.getAll();
    applyPipelineConfig(data.configuracoes||[]);
    applyAutomationConfig(data.configuracoes||[]);
    applyIntegrationConfig(data.configuracoes||[]);
    STATE=data;
    document.getElementById("notification-count").textContent=String(STATE.tarefas.filter(t=>t.status!=="concluida"&&isOverdue(t.data)).length);
    renderDashboard();if(currentView==="clientes")renderClients();if(currentView==="funil")renderKanban();if(currentView==="tarefas")renderTasks();if(currentView==="interacoes")renderInteractions();if(currentView==="calendario")renderAgenda();if(currentView==="propostas")renderProposals();if(currentView==="relatorios")renderReports();if(currentView==="integracoes")renderIntegrations()
  }catch(e){if(!CONFIG.MOCK&&/Sessão inválida|Não autenticado|Usuário inválido|Sessão expirada/i.test(String(e.message||""))){await logout("Sua sessão expirou. Faça login novamente.");return;}try{await API.create("LOGS",{tipo:"ERRO",usuario:SESSION?.nome||"Sistema",acao:"Sincronização",detalhes:e.message||String(e),dataHora:new Date().toISOString()})}catch{}if(!silent)toast(e.message||"Falha ao sincronizar.","error")}
}
function automationConfigRecord(){return STATE.configuracoes?.find(x=>x.chave==="automationRules")}
function applyAutomationConfig(configs){const rec=(configs||[]).find(x=>x.chave==="automationRules");if(!rec){AUTOMATION_RULES={...CONFIG.AUTOMATION_DEFAULTS};return}try{AUTOMATION_RULES={...CONFIG.AUTOMATION_DEFAULTS,...JSON.parse(rec.valor||"{}")}}catch{AUTOMATION_RULES={...CONFIG.AUTOMATION_DEFAULTS}}}
function renderAutomationSettings(){document.getElementById("automation-enabled").checked=AUTOMATION_RULES.enabled!==false;document.getElementById("automation-proposal-days").value=AUTOMATION_RULES.followupProposalDays;document.getElementById("automation-stalled-days").value=AUTOMATION_RULES.stalledLeadDays;document.getElementById("automation-recovery-days").value=AUTOMATION_RULES.recoveryDays}
async function saveAutomationRules(){const rules={enabled:document.getElementById("automation-enabled").checked,followupProposalDays:Math.max(1,Number(document.getElementById("automation-proposal-days").value||3)),stalledLeadDays:Math.max(1,Number(document.getElementById("automation-stalled-days").value||7)),recoveryDays:Math.max(7,Number(document.getElementById("automation-recovery-days").value||30)),reminderDays:0};try{const rec=automationConfigRecord();if(rec)await API.update(CONFIG.SHEETS.CONFIGURACOES,rec.id,{valor:JSON.stringify(rules)});else await API.create(CONFIG.SHEETS.CONFIGURACOES,{chave:"automationRules",valor:JSON.stringify(rules)});AUTOMATION_RULES=rules;await syncAll({silent:true});toast("Regras de automação salvas.")}catch(e){toast(e.message||"Não foi possível salvar as regras.","error")}}
function daysAgo(date,days){if(!date)return false;const d=new Date(`${String(date).slice(0,10)}T23:59:59`);return (Date.now()-d.getTime())>=days*86400000}
function lastInteractionDate(clienteId){const dates=STATE.interacoes.filter(i=>String(i.clienteId)===String(clienteId)).map(i=>i.data).filter(Boolean).sort();return dates.at(-1)||clientById(clienteId)?.criadoEm||""}
function hasAutomation(key){return STATE.tarefas.some(t=>t.automationKey===key&&t.status!=="concluida")}
async function createAutomationTask({clienteId,titulo,data,canal="Observação",automationKey,origemAutomacao}){if(hasAutomation(automationKey))return null;const task=await API.create(CONFIG.SHEETS.TAREFAS,{clienteId,titulo,data,hora:"09:00",canal,tipo:canal,status:"pendente",criadoEm:new Date().toISOString(),automationKey,origemAutomacao});STATE.tarefas.push(task);return task}
async function runAutomations(){if(!AUTOMATION_RULES.enabled)return;const today=new Date();today.setHours(0,0,0,0);
  // 1. Proposta enviada → follow-up automático.
  for(const p of STATE.propostas){if(!["enviada","visualizada","negociacao"].includes(p.status)||!p.clienteId)continue;const base=new Date(p.atualizadoEm||p.criadoEm||today);if(isNaN(base))continue;const due=new Date(base.getTime()+AUTOMATION_RULES.followupProposalDays*86400000);const data=due.toISOString().slice(0,10);await createAutomationTask({clienteId:p.clienteId,titulo:`Follow-up da proposta ${p.numero||""}`.trim(),data,canal:"Proposta",automationKey:`proposal-followup:${p.id}`,origemAutomacao:"Proposta enviada"})}
  // 2. Lead/oportunidade parada → follow-up.
  for(const n of STATE.negociacoes){if(["fechado","perdido"].includes(n.etapa)||!n.clienteId)continue;const last=lastInteractionDate(n.clienteId);if(!daysAgo(last,AUTOMATION_RULES.stalledLeadDays))continue;await createAutomationTask({clienteId:n.clienteId,titulo:`Follow-up: oportunidade parada · ${n.produtoServico||"negociação"}`,data:today.toISOString().slice(0,10),canal:"Ligação",automationKey:`stalled:${n.id}:${last}`,origemAutomacao:"Lead parado"})}
  // 3. Status do cliente acompanha o resultado do negócio.
  for(const n of STATE.negociacoes){const c=clientById(n.clienteId);if(!c)continue;if(n.etapa==="fechado"&&c.status!=="cliente"){await API.update(CONFIG.SHEETS.CLIENTES,c.id,{status:"cliente"});c.status="cliente";await API.audit({clienteId:c.id,entidade:"CLIENTES",registroId:c.id,acao:"Automação",alteracao:"Negócio fechado → cliente"})}else if(n.etapa==="perdido"&&c.status!=="perdido"){await API.update(CONFIG.SHEETS.CLIENTES,c.id,{status:"perdido"});c.status="perdido";await API.audit({clienteId:c.id,entidade:"CLIENTES",registroId:c.id,acao:"Automação",alteracao:"Negócio perdido → cliente marcado como perdido"})}else if(!["fechado","perdido"].includes(n.etapa)&&c.status==="perdido"){await API.update(CONFIG.SHEETS.CLIENTES,c.id,{status:"ativo"});c.status="ativo";await API.audit({clienteId:c.id,entidade:"CLIENTES",registroId:c.id,acao:"Automação",alteracao:"Oportunidade recuperada → acompanhamento ativo"})}}
  // 4. Recuperação de oportunidades perdidas.
  for(const n of STATE.negociacoes){if(n.etapa!=="perdido"||!n.clienteId)continue;const base=n.atualizadoEm||n.criadoEm||n.previsaoFechamento||n.previsao;if(!daysAgo(base,AUTOMATION_RULES.recoveryDays))continue;const due=new Date(today.getTime());await createAutomationTask({clienteId:n.clienteId,titulo:`Recuperar oportunidade · ${n.produtoServico||"negociação"}`,data:due.toISOString().slice(0,10),canal:"WhatsApp",automationKey:`recovery:${n.id}:${String(base).slice(0,10)}`,origemAutomacao:"Recuperação de oportunidade"})}
}
function toast(message,type="success"){const el=document.createElement("div");el.className=`toast ${type}`;el.textContent=message;document.getElementById("toast-region").appendChild(el);setTimeout(()=>el.remove(),3500)}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function dateBR(v){if(!v)return"—";const d=new Date(String(v).includes("T")?v:`${v}T12:00:00`);return isNaN(d)?"—":d.toLocaleDateString("pt-BR")}
function dateTimeBR(v){if(!v)return"—";const d=new Date(v);return isNaN(d)?"—":d.toLocaleDateString("pt-BR")+" · "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
function clientById(id){return STATE.clientes.find(c=>String(c.id)===String(id))}
function dealByClient(id){return STATE.negociacoes.filter(n=>String(n.clienteId)===String(id))}
function tasksByClient(id){return STATE.tarefas.filter(t=>String(t.clienteId)===String(id))}
function isOverdue(v){return v&&new Date(`${v}T23:59:59`) < new Date()}
function waLink(contact,text="Olá! Gostaria de falar com você."){const d=String(contact||"").replace(/\D/g,"");if(!d)return"#";return`https://wa.me/${(d.length===10||d.length===11?"55":"")+d}?text=${encodeURIComponent(text)}`}
function val(id){return document.getElementById(id)?.value||""}

function renderDashboard(){
  const now=new Date(),ym=now.toISOString().slice(0,7);
  const leads=STATE.clientes.filter(c=>String(c.status).toLowerCase()==="lead");
  const opportunities=STATE.negociacoes.filter(n=>!["fechado","perdido"].includes(n.etapa));
  const wins=STATE.negociacoes.filter(n=>n.etapa==="fechado");
  const pipeline=opportunities.reduce((s,n)=>s+Number(n.valor||0),0);
  const leadMonth=STATE.clientes.filter(c=>String(c.criadoEm||"").slice(0,7)===ym).length;
  const overdue=STATE.tarefas.filter(t=>t.status!=="concluida"&&isOverdue(t.data)).length;
  document.getElementById("stat-leads-mes").textContent=leads.length;
  document.getElementById("stat-leads-meta").textContent=`${leadMonth} cadastrados no mês`;
  document.getElementById("stat-oportunidades").textContent=opportunities.length;
  document.getElementById("stat-oportunidades-meta").textContent=`${money(pipeline)} em aberto`;
  document.getElementById("stat-fechados").textContent=wins.length;
  document.getElementById("stat-fechados-meta").textContent=`${money(wins.reduce((s,n)=>s+Number(n.valor||0),0))} ganhos`;
  document.getElementById("stat-pipeline-total").textContent=money(pipeline);
  document.getElementById("stat-pipeline-meta").textContent=`${overdue} tarefa${overdue===1?"":"s"} atrasada${overdue===1?"":"s"}`;
  renderDashboardPipeline();renderDashboardTasks();renderActivities();renderSourceChart();renderStageChart();renderStageValues();
}
function renderDashboardPipeline(){
  const box=document.getElementById("dashboard-pipeline");
  box.innerHTML=CONFIG.PIPELINE_STAGES.map(stage=>{
    const deals=STATE.negociacoes.filter(n=>n.etapa===stage.id);
    return `<div class="pipeline-col"><div class="pipeline-col-head"><strong>${esc(stage.label)}</strong><span>${deals.length}</span></div>
      ${deals.slice(0,3).map(n=>{const c=clientById(n.clienteId);return`<article class="deal-mini" data-open-deal="${esc(n.id)}"><strong>${esc(c?.nome||"Cliente removido")}</strong><small>${esc(c?.origem||"")}</small><div class="deal-amount">${money(n.valor)}</div></article>`}).join("")}
      ${deals.length>3?`<div class="deal-more">＋ Ver mais ${deals.length-3}</div>`:""}
      ${!deals.length?`<div class="empty">Sem registros</div>`:""}</div>`
  }).join("");
  document.querySelectorAll("[data-open-deal]").forEach(x=>x.onclick=()=>openDealModal(x.dataset.openDeal));
}
function renderDashboardTasks(){
  const list=STATE.tarefas.filter(t=>t.status!=="concluida").sort((a,b)=>`${a.data}${a.hora||""}`.localeCompare(`${b.data}${b.hora||""}`)).slice(0,4);
  document.getElementById("dashboard-tasks").innerHTML=list.length?list.map(t=>{const c=clientById(t.clienteId);return`<div class="compact-item"><span class="compact-bullet">○</span><div><strong>${esc(t.titulo)}</strong><small>${esc(c?.nome||"Follow-up")} · ${esc(t.canal||"")}</small></div><time>${dateBR(t.data)}</time></div>`}).join(""):`<div class="empty">Nenhuma tarefa pendente.</div>`;
}
function renderActivities(){
  const history=[...STATE.historico].sort((a,b)=>String(b.dataHora).localeCompare(String(a.dataHora))).slice(0,4);
  document.getElementById("dashboard-activities").innerHTML=history.length?history.map(h=>`<div class="compact-item"><span class="compact-bullet">${h.acao==="Exclusão"?"×":"✓"}</span><div><strong>${esc(h.acao)}</strong><small>${esc(clientById(h.clienteId)?.nome||h.alteracao||h.entidade)}</small></div><time>${relativeTime(h.dataHora)}</time></div>`).join(""):`<div class="empty">Nenhuma atividade registrada.</div>`;
}
function relativeTime(v){const d=new Date(v),diff=Math.max(0,Date.now()-d.getTime()),m=Math.floor(diff/60000);if(m<60)return`há ${m||1} min`;const h=Math.floor(m/60);if(h<24)return`há ${h} h`;return dateBR(v)}
function renderSourceChart(){
  const counts={};STATE.clientes.forEach(c=>{const k=c.origem||"Outros";counts[k]=(counts[k]||0)+1});const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6),max=Math.max(1,...rows.map(x=>x[1]));
  document.getElementById("source-chart").innerHTML=rows.length?rows.map(([k,v])=>`<div class="source-row"><span>${esc(k)}</span><div class="bar-track"><i style="width:${Math.round(v/max*100)}%"></i></div><strong>${v}</strong></div>`).join(""):`<div class="empty">Sem dados.</div>`;
}
function renderStageChart(){
  const vals=CONFIG.PIPELINE_STAGES.map(s=>[s,STATE.negociacoes.filter(n=>n.etapa===s.id).length]),max=Math.max(1,...vals.map(x=>x[1]));
  document.getElementById("stage-chart").innerHTML=vals.map(([s,v])=>`<div class="stage-bar-wrap"><b>${v}</b><div class="stage-bar" style="height:${Math.max(4,v/max*105)}px"></div><span>${esc(s.label)}</span></div>`).join("");
}
function renderStageValues(){
  const vals=CONFIG.PIPELINE_STAGES.map(s=>{const v=STATE.negociacoes.filter(n=>n.etapa===s.id).reduce((a,n)=>a+Number(n.valor||0),0);return[s,v]}),max=Math.max(1,...vals.map(x=>x[1]));
  document.getElementById("stage-values").innerHTML=vals.map(([s,v])=>`<div class="value-row"><span>${esc(s.label)}</span><div class="bar-track"><i style="width:${Math.round(v/max*100)}%"></i></div><strong>${money(v)}</strong></div>`).join("");
}

function reportDate(value){
  if(!value)return null;const d=new Date(String(value).includes("T")?value:`${value}T12:00:00`);return isNaN(d)?null:d;
}
function reportWindow(){
  const days=val("report-period")||"365",end=new Date();end.setHours(23,59,59,999);
  if(days==="all")return{start:null,end};const start=new Date();start.setDate(start.getDate()-Number(days)+1);start.setHours(0,0,0,0);return{start,end};
}
function inReportPeriod(value,w){const d=reportDate(value);return !!d&&(!w.start||d>=w.start)&&d<=w.end}
function reportMonthKey(value){const d=reportDate(value);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`:""}
function reportMonthLabel(key){if(!key)return"—";const [y,m]=key.split("-");return new Date(Number(y),Number(m)-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}).replace(".","")}
function reportDealDate(n){return n.previsaoFechamento||n.previsao||n.criadoEm}
function reportDealValue(n){return Number(n.valor||0)}
function reportProposalValue(p){return Number(p.total||0)>0?Number(p.total):Number(p.valorUnitario||0)*Math.max(1,Number(p.quantidade||1))-Number(p.desconto||0)}
function renderReports(){
  const w=reportWindow(),clients=STATE.clientes.filter(c=>inReportPeriod(c.criadoEm,w)),deals=STATE.negociacoes.filter(n=>inReportPeriod(n.criadoEm||n.previsaoFechamento||n.previsao,w)),wins=deals.filter(n=>n.etapa==="fechado"),losses=deals.filter(n=>n.etapa==="perdido"),open=deals.filter(n=>!['fechado','perdido'].includes(n.etapa));
  const revenue=wins.reduce((a,n)=>a+reportDealValue(n),0),avgTicket=wins.length?revenue/wins.length:0,totalClosed=wins.length+losses.length,conversion=totalClosed?wins.length/totalClosed*100:0,pipeline=open.reduce((a,n)=>a+reportDealValue(n),0),weighted=open.reduce((a,n)=>a+reportDealValue(n)*Number(n.probabilidade||0)/100,0);
  const proposals=STATE.propostas.filter(p=>inReportPeriod(p.criadoEm||p.atualizadoEm,w)),approved=proposals.filter(p=>p.status==="aprovada"),proposalRate=proposals.length?approved.length/proposals.length*100:0;
  const cycle=reportSalesCycle(wins),topSource=reportTop(clients,c=>c.origem||"Não informado"),topService=reportTop(wins,n=>n.produtoServico||"Não informado");
  document.getElementById("report-summary").innerHTML=[
    reportCard("Leads",clients.length,`${clients.filter(c=>String(c.status).toLowerCase()==="lead").length} ainda em lead`),
    reportCard("Oportunidades",open.length,`${money(pipeline)} em aberto`),
    reportCard("Faturamento",money(revenue),`${wins.length} negócio${wins.length===1?"":"s"} ganho${wins.length===1?"":"s"}`),
    reportCard("Ticket médio",money(avgTicket),`${conversion.toFixed(1)}% de conversão`),
    reportCard("Pipeline ponderado",money(weighted),`${proposalRate.toFixed(1)}% de aprovação de propostas`),
    reportCard("Ciclo médio",cycle===null?"—":`${cycle.toFixed(0)} dias`,"da criação ao fechamento")
  ].join("");
  renderReportSources(clients);renderReportStages(deals);renderReportRevenue(wins);renderReportPerformance(wins,topSource,topService);renderReportHistory(w,clients,deals,wins,losses,proposals);
}
function reportCard(label,value,meta){return`<div class="report-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(meta)}</small></div>`}
function reportTop(list,fn){const map={};list.forEach(x=>{const k=String(fn(x)||"Não informado");map[k]=(map[k]||0)+1});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5)}
function renderReportSources(clients){const rows=reportTop(clients,c=>c.origem||"Não informado"),max=Math.max(1,...rows.map(x=>x[1]));document.getElementById("report-source-chart").innerHTML=rows.length?rows.map(([k,v])=>`<div class="report-bar-row"><div><span>${esc(k)}</span><strong>${v}</strong></div><div class="bar-track"><i style="width:${Math.round(v/max*100)}%"></i></div></div>`).join(""):"<div class='empty'>Sem leads no período.</div>"}
function renderReportStages(deals){const rows=CONFIG.PIPELINE_STAGES.map(s=>{const ds=deals.filter(n=>n.etapa===s.id);return{s,count:ds.length,value:ds.reduce((a,n)=>a+reportDealValue(n),0)}});const max=Math.max(1,...rows.map(x=>x.count));document.getElementById("report-stage-chart").innerHTML=rows.map(x=>`<div class="report-stage-row"><div class="report-stage-label"><span>${esc(x.s.label)}</span><b>${x.count}</b></div><div class="report-stage-track"><i style="width:${Math.round(x.count/max*100)}%"></i></div><small>${money(x.value)}</small></div>`).join("")}
function renderReportRevenue(wins){const map={};wins.forEach(n=>{const k=reportMonthKey(n.criadoEm||n.previsaoFechamento||n.previsao);if(k)map[k]=(map[k]||0)+reportDealValue(n)});const rows=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12),max=Math.max(1,...rows.map(x=>x[1]));document.getElementById("report-revenue-chart").innerHTML=rows.length?rows.map(([k,v])=>`<div class="report-bar-row"><div><span>${esc(reportMonthLabel(k))}</span><strong>${money(v)}</strong></div><div class="bar-track"><i style="width:${Math.round(v/max*100)}%"></i></div></div>`).join(""):"<div class='empty'>Sem vendas no período.</div>"}
function renderReportPerformance(wins,topSource,topService){const source=topSource[0],service=topService[0];document.getElementById("report-performance").innerHTML=`<div class="rank-item"><span>Melhor origem</span><strong>${esc(source?.[0]||"—")}</strong><small>${source?.[1]||0} lead${source?.[1]===1?"":"s"}</small></div><div class="rank-item"><span>Melhor serviço / oportunidade</span><strong>${esc(service?.[0]||"—")}</strong><small>${service?.[1]||0} venda${service?.[1]===1?"":"s"}</small></div><div class="rank-list"><h4>Top origens</h4>${topSource.map(([k,v])=>`<div><span>${esc(k)}</span><b>${v}</b></div>`).join("")||"<small>Sem dados.</small>"}</div>`}
function renderReportHistory(w,clients,deals,wins,losses,proposals){const months={};const add=(date,type,value=1)=>{const k=reportMonthKey(date);if(!k)return;(months[k]??={leads:0,oportunidades:0,vendas:0,valor:0});months[k][type]+=value};clients.forEach(c=>add(c.criadoEm,"leads"));deals.forEach(n=>add(n.criadoEm||n.previsaoFechamento||n.previsao,"oportunidades"));wins.forEach(n=>{add(n.criadoEm||n.previsaoFechamento||n.previsao,"vendas");add(n.criadoEm||n.previsaoFechamento||n.previsao,"valor",reportDealValue(n))});const rows=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8);document.getElementById("report-history").innerHTML=`<div class="history-kpis"><span>Perdas <b>${losses.length}</b></span><span>Propostas <b>${proposals.length}</b></span></div><div class="history-table"><div class="history-head"><span>Mês</span><span>Leads</span><span>Oport.</span><span>Vendas</span><span>Faturamento</span></div>${rows.map(([k,v])=>`<div class="history-row"><span>${esc(reportMonthLabel(k))}</span><span>${v.leads}</span><span>${v.oportunidades}</span><span>${v.vendas}</span><span>${money(v.valor)}</span></div>`).join("")||"<div class='empty'>Sem histórico suficiente.</div>"}</div>`}
function reportSalesCycle(wins){const values=wins.map(n=>{const start=reportDate(n.criadoEm);const end=reportDate(n.dataFechamento||n.fechadoEm||n.previsaoFechamento);if(!start||!end||end<start)return null;return(end-start)/86400000}).filter(x=>x!==null);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}

function populateFilters(){
  const tags=[...new Set(STATE.clientes.flatMap(c=>String(c.tags||"").split(",").map(x=>x.trim()).filter(Boolean)))].sort(),origins=[...new Set(STATE.clientes.map(c=>c.origem).filter(Boolean))].sort();
  const tag=document.getElementById("filter-tag"),origin=document.getElementById("filter-origin"),tv=tag.value,ov=origin.value;
  tag.innerHTML='<option value="">Todas as tags</option>'+tags.map(x=>`<option>${esc(x)}</option>`).join("");origin.innerHTML='<option value="">Todas as origens</option>'+origins.map(x=>`<option>${esc(x)}</option>`).join("");tag.value=tv;origin.value=ov;
}
function renderClients(){
  populateFilters();const q=val("client-search").toLowerCase().trim(),tag=val("filter-tag"),origin=val("filter-origin"),status=val("filter-status");
  const list=STATE.clientes.filter(c=>{const hay=[c.nome,c.contato,c.empresa,c.email,c.origem,c.tags].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!tag||String(c.tags||"").split(",").map(x=>x.trim()).includes(tag))&&(!origin||c.origem===origin)&&(!status||c.status===status)});
  document.getElementById("client-count").textContent=`${list.length} registro${list.length===1?"":"s"}`;
  document.getElementById("clients-table").innerHTML=list.length?list.map(c=>`<tr><td><span class="client-name" data-client="${esc(c.id)}">${esc(c.nome)}</span></td><td>${esc(c.whatsapp||c.contato||"—")}</td><td>${esc(c.empresa||"—")}</td><td>${esc(c.origem||"—")}</td><td>${String(c.tags||"").split(",").map(x=>x.trim()).filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join("")||"—"}</td><td><span class="badge badge-${esc(c.status||"lead")}">${esc(c.status||"lead")}</span></td><td><button class="icon-button" data-client-edit="${esc(c.id)}" title="Editar">✎</button><button class="icon-button" data-client-open="${esc(c.id)}" title="Abrir ficha">↗</button></td></tr>`).join(""):`<tr><td colspan="7"><div class="empty">Nenhum cliente encontrado.</div></td></tr>`;
  document.querySelectorAll("[data-client]").forEach(x=>x.onclick=()=>openDetail(x.dataset.client));
  document.querySelectorAll("[data-client-edit]").forEach(x=>x.onclick=()=>openClientModal(x.dataset.client));
  document.querySelectorAll("[data-client-open]").forEach(x=>x.onclick=()=>openDetail(x.dataset.clientOpen));
}
function populateDealFilters(){
  const responsible=[...new Set(STATE.negociacoes.map(n=>String(n.responsavel||"").trim()).filter(Boolean))].sort();
  const origins=[...new Set(STATE.negociacoes.map(n=>String(n.origem||"").trim()).filter(Boolean))].sort();
  const r=document.getElementById("deal-filter-responsavel"),o=document.getElementById("deal-filter-origin"),rv=r.value,ov=o.value;
  r.innerHTML='<option value="">Todos os responsáveis</option>'+responsible.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  o.innerHTML='<option value="">Todas as origens</option>'+origins.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  r.value=rv;o.value=ov;
}
function dealMatches(n){
  const q=val("deal-search").toLowerCase().trim(),priority=val("deal-filter-priority"),responsavel=val("deal-filter-responsavel"),origin=val("deal-filter-origin"),c=clientById(n.clienteId);
  const hay=[c?.nome,c?.empresa,n.produtoServico,n.responsavel,n.origem].join(" ").toLowerCase();
  return (!q||hay.includes(q))&&(!priority||n.prioridade===priority)&&(!responsavel||n.responsavel===responsavel)&&(!origin||n.origem===origin);
}
function priorityLabel(v){return ({baixa:"Baixa",média:"Média",alta:"Alta",urgente:"Urgente"})[v]||"Média"}
function renderPipelineSummary(filtered){
  const open=filtered.filter(n=>!['fechado','perdido'].includes(n.etapa));
  const total=open.reduce((a,n)=>a+Number(n.valor||0),0);
  const weighted=open.reduce((a,n)=>a+Number(n.valor||0)*Number(n.probabilidade||0)/100,0);
  const urgent=open.filter(n=>n.prioridade==='urgente').length;
  document.getElementById("pipeline-summary").innerHTML=`<div class="pipeline-summary-card"><span>Oportunidades</span><strong>${open.length}</strong></div><div class="pipeline-summary-card"><span>Pipeline aberto</span><strong>${money(total)}</strong></div><div class="pipeline-summary-card"><span>Pipeline ponderado</span><strong>${money(weighted)}</strong></div><div class="pipeline-summary-card"><span>Urgentes</span><strong>${urgent}</strong></div>`;
}
function renderKanban(){
  populateDealFilters();
  const filtered=STATE.negociacoes.filter(dealMatches);
  renderPipelineSummary(filtered);
  document.getElementById("kanban").innerHTML=CONFIG.PIPELINE_STAGES.map(stage=>{
    const deals=filtered.filter(n=>n.etapa===stage.id),stageValue=deals.reduce((a,n)=>a+Number(n.valor||0),0);
    return `<div class="kanban-column" data-stage="${esc(stage.id)}"><div class="kanban-head"><div><strong>${esc(stage.label)}</strong><small>${deals.length} · ${money(stageValue)}</small></div><span>${deals.length}</span></div><div class="kanban-cards">${deals.length?deals.map(n=>{const c=clientById(n.clienteId);return `<article class="deal-card priority-${esc(n.prioridade||'média')}" draggable="true" data-deal="${esc(n.id)}"><div class="deal-card-top"><span class="deal-priority">${esc(priorityLabel(n.prioridade))}</span><span>${Number(n.probabilidade||0)}%</span></div><strong>${esc(c?.nome||"Cliente removido")}</strong><div class="deal-product">${esc(n.produtoServico||"Produto/serviço não informado")}</div><div class="deal-value">${money(n.valor)}</div><div class="deal-meta"><span>Fechamento<br><b>${dateBR(n.previsaoFechamento||n.previsao)}</b></span><span>Origem<br><b>${esc(n.origem||"—")}</b></span></div><div class="deal-footer"><small>${esc(n.responsavel||"Sem responsável")}</small>${c?`<a class="wa-mini" target="_blank" rel="noopener" href="${waLink(c.whatsapp||c.contato,`Olá, ${c.nome}! Estou acompanhando nossa negociação.`)}">WhatsApp ↗</a>`:""}</div></article>`}).join(""):`<div class="empty">Solte aqui</div>`}</div></div>`
  }).join("");
  document.querySelectorAll(".deal-card").forEach(card=>{card.addEventListener("click",e=>{if(!e.target.closest("a"))openDealModal(card.dataset.deal)});card.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",card.dataset.deal))});
  document.querySelectorAll(".kanban-column").forEach(col=>{col.addEventListener("dragover",e=>{e.preventDefault();col.classList.add("drag-over")});col.addEventListener("dragleave",()=>col.classList.remove("drag-over"));col.addEventListener("drop",async e=>{e.preventDefault();col.classList.remove("drag-over");const id=e.dataTransfer.getData("text/plain"),n=STATE.negociacoes.find(x=>String(x.id)===String(id));if(!n||n.etapa===col.dataset.stage)return;const old=n.etapa;try{await API.update(CONFIG.SHEETS.NEGOCIACOES,id,{etapa:col.dataset.stage});await auditChange(n.clienteId,"NEGOCIACOES",id,"Mudança de etapa",`Etapa: ${stageLabel(old)} → ${stageLabel(col.dataset.stage)}`);await syncAll({silent:true});toast(`Negociação movida para ${stageLabel(col.dataset.stage)}.`)}catch(err){toast(err.message,"error")}})});
}
function stageLabel(id){return CONFIG.PIPELINE_STAGES.find(x=>x.id===id)?.label||id}
function renderTasks(){
  const filter=val("task-filter");const list=STATE.tarefas.filter(t=>!filter||t.status===filter).sort((a,b)=>`${a.data}${a.hora||""}`.localeCompare(`${b.data}${b.hora||""}`));
  document.getElementById("tasks-list").innerHTML=list.length?list.map(t=>{const c=clientById(t.clienteId),done=t.status==="concluida";return`<div class="task-item ${done?"done":""}"><div class="task-main"><strong>${esc(t.titulo)}</strong><span>${esc(c?.nome||"Sem cliente")} · ${esc(t.tipo||t.canal||"")}</span></div><div class="task-date">${dateBR(t.data)}${t.hora?" · "+esc(t.hora):""}</div><button class="task-check" data-task="${esc(t.id)}" title="Editar">✎</button><button class="task-check" data-task-toggle="${esc(t.id)}" title="${done?"Reabrir":"Concluir"}">${done?"✓":"○"}</button></div>`}).join(""):`<div class="empty">Nenhuma tarefa neste filtro.</div>`;
  document.querySelectorAll("[data-task]").forEach(b=>b.onclick=()=>openTaskModal(b.dataset.task,true));
  document.querySelectorAll("[data-task-toggle]").forEach(b=>{b.onclick=async()=>{const t=STATE.tarefas.find(x=>String(x.id)===String(b.dataset.taskToggle));if(!t)return;try{const next=t.status==="concluida"?"pendente":"concluida";await API.update(CONFIG.SHEETS.TAREFAS,t.id,{status:next});await auditChange(t.clienteId,"TAREFAS",t.id,"Edição",`Status: ${t.status} → ${next}`);await syncAll({silent:true});toast("Tarefa atualizada.")}catch(e){toast(e.message,"error")}}});
}
function renderInteractions(){
  const list=[...STATE.interacoes].sort((a,b)=>`${b.data||""}${b.hora||""}`.localeCompare(`${a.data||""}${a.hora||""}`));
  const today=todayISO(), overdue=STATE.tarefas.filter(t=>t.status!=="concluida"&&isOverdue(t.data)).length, next=list.filter(i=>i.proximoContato&&i.proximoContato>=today).length;
  document.getElementById("activity-summary").innerHTML=`<div><span>Atividades</span><strong>${list.length}</strong></div><div><span>Follow-ups atrasados</span><strong>${overdue}</strong></div><div><span>Próximos contatos</span><strong>${next}</strong></div>`;
  document.getElementById("interactions-table").innerHTML=list.length?list.map(i=>`<tr><td>${dateBR(i.data)}${i.hora?`<small class="table-sub">${esc(i.hora)}</small>`:""}</td><td>${esc(clientById(i.clienteId)?.nome||"—")}</td><td><span class="activity-pill">${esc(i.tipo||i.canal||"—")}</span></td><td>${esc(i.resultado||i.descricao||"—")}</td><td>${i.proximoContato?dateBR(i.proximoContato):"—"}</td><td><button class="text-btn" data-edit-interaction="${esc(i.id)}">Editar</button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty">Nenhuma atividade registrada.</div></td></tr>`;
  document.querySelectorAll("[data-edit-interaction]").forEach(b=>b.onclick=()=>openInteractionModal(b.dataset.editInteraction));
}
function todayISO(){return new Date().toISOString().slice(0,10)}
function renderAgenda(){
  const today=todayISO(), now=new Date(), end=new Date(now);end.setDate(end.getDate()+7);
  let list=STATE.tarefas.filter(t=>{if(agendaFilter==="concluidas")return t.status==="concluida";if(t.status==="concluida")return false;if(agendaFilter==="atrasadas")return isOverdue(t.data)&&t.data!==today;if(agendaFilter==="hoje")return t.data===today;if(agendaFilter==="proximas"){const d=new Date(`${t.data}T23:59:59`);return d>now&&d<=end}return false});
  list.sort((a,b)=>`${a.data}${a.hora||""}`.localeCompare(`${b.data}${b.hora||""}`));
  document.getElementById("agenda-grid").innerHTML=list.length?list.map(t=>{const c=clientById(t.clienteId),over=isOverdue(t.data)&&t.status!=="concluida";return`<article class="agenda-card ${over?"overdue":""}"><div><span class="agenda-type">${esc(t.tipo||t.canal||"Follow-up")}</span><time>${dateBR(t.data)}${t.hora?` · ${esc(t.hora)}`:""}</time></div><h3>${esc(t.titulo)}</h3><p>${esc(c?.nome||"Sem cliente")}</p><div class="agenda-actions"><button class="btn btn-ghost" data-agenda-edit="${esc(t.id)}">Editar</button>${c?`<a class="btn btn-primary" target="_blank" rel="noopener" href="${waLink(c.whatsapp||c.contato,`Olá, ${c.nome}! Estou fazendo seu follow-up.`)}">WhatsApp</a>`:""}</div></article>`}).join(""):`<div class="empty-state"><span>✓</span><h2>Nenhuma tarefa</h2><p>Não há registros nesta visão.</p></div>`;
  document.querySelectorAll("[data-agenda-edit]").forEach(b=>b.onclick=()=>openTaskModal(b.dataset.agendaEdit,true));
}
function fillInteractionSelects(selected=""){
  document.getElementById("interaction-client").innerHTML=STATE.clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  document.getElementById("interaction-type").innerHTML=CONFIG.ACTIVITY_TYPES.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if(selected)document.getElementById("interaction-client").value=selected;
}
function openInteractionModal(id="",clientId=""){
  const i=id?STATE.interacoes.find(x=>String(x.id)===String(id)):null;document.getElementById("interaction-form").reset();fillInteractionSelects(i?.clienteId||clientId);document.getElementById("interaction-id").value=i?.id||"";document.getElementById("interaction-modal-title").textContent=i?"Editar atividade":"Nova atividade";document.getElementById("interaction-delete").classList.toggle("hidden",!i);document.getElementById("interaction-save-btn").textContent=i?"Salvar atividade":"Registrar atividade";document.getElementById("interaction-client").value=i?.clienteId||clientId||STATE.clientes[0]?.id||"";document.getElementById("interaction-type").value=i?.tipo||i?.canal||CONFIG.ACTIVITY_TYPES[0];document.getElementById("interaction-date").value=i?.data||todayISO();document.getElementById("interaction-time").value=i?.hora||"";document.getElementById("interaction-result").value=i?.resultado||"";document.getElementById("interaction-next").value=i?.proximoContato||"";document.getElementById("interaction-description").value=i?.descricao||"";document.getElementById("interaction-modal").showModal();
}
async function saveInteraction(e){
  e.preventDefault();const id=val("interaction-id"),data={clienteId:val("interaction-client"),tipo:val("interaction-type"),canal:val("interaction-type"),data:val("interaction-date"),hora:val("interaction-time"),resultado:val("interaction-result").trim(),proximoContato:val("interaction-next"),descricao:val("interaction-description").trim()};if(!data.clienteId||!data.data){toast("Informe cliente e data da atividade.","error");return}
  const btn=submitButtonOf(e)||document.getElementById("interaction-save-btn");
  await withButtonLoading(btn,async()=>{
  try{if(id){const old=STATE.interacoes.find(x=>String(x.id)===String(id));await API.update(CONFIG.SHEETS.INTERACOES,id,data);await auditChange(data.clienteId,"INTERACOES",id,"Edição",diffInteraction(old,data))}else{const i=await API.create(CONFIG.SHEETS.INTERACOES,data);await auditChange(data.clienteId,"INTERACOES",i.id,"Criação",`Atividade criada · ${data.tipo} · ${data.resultado||data.descricao||"sem descrição"}`)}document.getElementById("interaction-modal").close();await syncAll({silent:true});toast(id?"Atividade atualizada.":"Atividade registrada.");}catch(e){toast(e.message,"error")}
  });
}
function diffInteraction(o,n){const p=[];if((o.tipo||o.canal)!==n.tipo)p.push(`Tipo: ${o.tipo||o.canal||"—"} → ${n.tipo}`);if(o.data!==n.data)p.push(`Data: ${dateBR(o.data)} → ${dateBR(n.data)}`);if(o.resultado!==n.resultado)p.push(`Resultado: "${o.resultado||"—"}" → "${n.resultado||"—"}"`);if(o.proximoContato!==n.proximoContato)p.push(`Próximo contato: ${dateBR(o.proximoContato)} → ${dateBR(n.proximoContato)}`);return p.join(" · ")||"Atividade editada"}
async function deleteInteraction(id){const i=STATE.interacoes.find(x=>String(x.id)===String(id));if(!i||!confirm("Excluir esta atividade?"))return;const btn=document.getElementById("interaction-delete");await withButtonLoading(btn,async()=>{try{await API.remove(CONFIG.SHEETS.INTERACOES,id);await auditChange(i.clienteId,"INTERACOES",id,"Exclusão",`Atividade excluída · ${i.tipo||i.canal||""}`);document.getElementById("interaction-modal").close();await syncAll({silent:true});toast("Atividade excluída.")}catch(e){toast(e.message,"error")}});}

function buildClientForm(){
  const wrap=document.getElementById("client-form-sections");
  const fieldMap={pessoais:["nome","cpfCnpj","contato","whatsapp","email","dataNascimento"],comerciais:["empresa","cargo","segmento","porte","origem","responsavel","status","potencial"],endereco:["cep","rua","numero","complemento","bairro","cidade","estado"],digital:["instagram","facebook","linkedin","site"],interno:["tags","preferencias","observacoes"]};
  wrap.innerHTML=CONFIG.CLIENT_SECTIONS.map((section,idx)=>`<section class="form-section"><div class="form-section-head"><p class="eyebrow">${String(idx+1).padStart(2,"0")}</p><h4>${esc(section.label)}</h4></div><div class="form-grid">${(fieldMap[section.id]||[]).map(id=>fieldHtml(CONFIG.CLIENT_FIELDS.find(f=>f.id===id))).join("")}</div></section>`).join("");
}
function fieldHtml(f){
  if(!f)return"";const req=f.required?"required":"";if(f.type==="textarea")return`<label class="span-2">${esc(f.label)}<textarea id="client-${f.id}" rows="${f.id==="observacoes"?4:3}" ${req}></textarea></label>`;
  if(f.type==="select")return`<label>${esc(f.label)}<select id="client-${f.id}" ${req}><option value="">Selecione</option>${f.options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></label>`;
  return`<label>${esc(f.label)}${f.required?" *":""}<input id="client-${f.id}" type="${f.type}" ${req}></label>`;
}
function openClientModal(id=""){
  const form=document.getElementById("client-form");form.reset();document.getElementById("client-id").value=id||"";
  const c=id?clientById(id):null;document.getElementById("client-modal-title").textContent=c?"Editar cliente":"Novo cliente / lead";document.getElementById("client-save-btn").textContent=c?"Salvar alterações":"Salvar cliente";
  CONFIG.CLIENT_FIELDS.forEach(f=>{const el=document.getElementById(`client-${f.id}`);if(!el)return;el.value=c?String(c[f.id]??""):String(CONFIG.CLIENT_DEFAULTS[f.id]??"")});
  document.getElementById("client-modal").showModal();
}
async function saveClient(e){
  e.preventDefault();const id=val("client-id"),data={};CONFIG.CLIENT_FIELDS.forEach(f=>{const el=document.getElementById(`client-${f.id}`);if(el)data[f.id]=el.value.trim()});
  if(!data.nome){toast("Informe o nome do cliente.","error");return}
  const btn=submitButtonOf(e)||document.getElementById("client-save-btn");
  await withButtonLoading(btn,async()=>{
  try{
    if(id){const old=clientById(id);const changes=diffFields(old,data);await API.update(CONFIG.SHEETS.CLIENTES,id,data);if(changes)await auditChange(id,"CLIENTES",id,"Edição",changes)}
    else{data.criadoEm=new Date().toISOString().slice(0,10);const c=await API.create(CONFIG.SHEETS.CLIENTES,data);await auditChange(c.id,"CLIENTES",c.id,"Cadastro","Cliente cadastrado")}
    document.getElementById("client-modal").close();await syncAll({silent:true});showView("clientes");toast(id?"Cliente atualizado com sucesso.":"Cliente cadastrado com sucesso.");
  }catch(err){toast(err.message||"Não foi possível salvar o cliente.","error")}
  });
}
function diffFields(old,next){const labels=Object.fromEntries(CONFIG.CLIENT_FIELDS.map(f=>[f.id,f.label]));const parts=[];for(const [k,v] of Object.entries(next)){if(String(old?.[k]??"")!==String(v??""))parts.push(`${labels[k]||k}: "${String(old?.[k]??"—")}" → "${String(v??"—")}"`)}return parts.slice(0,8).join(" · ")+(parts.length>8?` · +${parts.length-8} alterações`:"")}
function auditChange(clienteId,entidade,registroId,acao,alteracao){return API.audit({clienteId,entidade,registroId,acao,alteracao})}

function openDetail(id){
  const c=clientById(id);if(!c)return;const deals=dealByClient(id),tasks=tasksByClient(id),ints=STATE.interacoes.filter(x=>String(x.clienteId)===String(id)).sort((a,b)=>String(b.data).localeCompare(String(a.data))),history=STATE.historico.filter(x=>String(x.clienteId)===String(id)).sort((a,b)=>String(b.dataHora).localeCompare(String(a.dataHora)));
  document.getElementById("detail-heading").innerHTML=`<p class="eyebrow">Ficha do cliente</p><h3>${esc(c.nome)}</h3>`;
  const fieldMap={pessoais:["nome","cpfCnpj","contato","whatsapp","email","dataNascimento"],comerciais:["empresa","cargo","segmento","porte","origem","responsavel","status","potencial"],endereco:["cep","rua","numero","complemento","bairro","cidade","estado"],digital:["instagram","facebook","linkedin","site"],interno:["tags","preferencias","observacoes"]};
  const sections=CONFIG.CLIENT_SECTIONS.map(s=>`<div class="detail-section"><h4>${esc(s.label)}</h4>${(fieldMap[s.id]||[]).map(fid=>{const f=CONFIG.CLIENT_FIELDS.find(x=>x.id===fid);let v=c[fid];if(fid==="dataNascimento")v=dateBR(v);if(f.type==="url"&&v)v=`<a class="detail-link" href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>`;else v=esc(v||"—");return`<div class="detail-row"><span>${esc(f.label)}</span><strong>${v}</strong></div>`}).join("")}</div>`).join("");
  document.getElementById("client-detail").innerHTML=`<div class="detail-grid"><div class="detail-card"><h4>Contato principal</h4><p>${esc(c.whatsapp||c.contato||"—")}</p><p>${esc(c.email||"—")}</p></div><div class="detail-card"><h4>Comercial</h4><p>${esc(c.empresa||"Sem empresa")}</p><p>${esc(c.segmento||"Sem segmento")}</p></div><div class="detail-card"><h4>Status</h4><p>${esc(c.status||"lead")} · potencial ${esc(c.potencial||"—")}</p><a class="btn btn-ghost" href="${waLink(c.whatsapp||c.contato,`Olá, ${c.nome}! Tudo bem?`)}" target="_blank" rel="noopener">WhatsApp</a></div></div>
    <div class="detail-actions"><button class="btn btn-primary" id="detail-edit">✎ Editar cliente</button><button class="btn btn-danger-outline" id="detail-delete">Excluir cliente</button><button class="btn btn-ghost" id="detail-task">＋ Nova tarefa</button><button class="btn btn-ghost" id="detail-interaction">＋ Registrar atividade</button></div>${sections}
    <div class="detail-section"><h4>Negociações vinculadas</h4>${deals.length?deals.map(n=>`<div class="detail-row"><span>${esc(n.produtoServico||"Produto/serviço")} · ${esc(stageLabel(n.etapa))} · ${dateBR(n.previsaoFechamento||n.previsao)}<br><small>${Number(n.probabilidade||0)}% · ${esc(priorityLabel(n.prioridade))} · ${esc(n.responsavel||"Sem responsável")}</small></span><strong>${money(n.valor)} <button class="text-btn" data-detail-deal="${esc(n.id)}">Editar</button></strong></div>`).join(""):`<div class="empty">Nenhuma negociação.</div>`}</div>
    <div class="detail-section"><h4>Tarefas</h4>${tasks.length?tasks.map(t=>`<div class="detail-row"><span>${esc(t.titulo)} · ${dateBR(t.data)}</span><strong>${esc(t.status)} <button class="text-btn" data-detail-task="${esc(t.id)}">Editar</button></strong></div>`).join(""):`<div class="empty">Nenhuma tarefa.</div>`}</div>
    <div class="detail-section"><h4>Interações</h4>${ints.length?ints.map(i=>`<div class="detail-row"><span>${esc(i.canal)} · ${dateBR(i.data)}<br>${esc(i.descricao||"")}</span></div>`).join(""):`<div class="empty">Nenhuma interação registrada.</div>`}</div>
    <div class="detail-section"><h4>Timeline / Auditoria</h4>${history.length?`<div class="timeline">${history.map(h=>`<div class="timeline-item"><strong>${esc(h.acao)} · ${esc(h.usuario||"Sistema")}</strong><small>${dateTimeBR(h.dataHora)} · ${esc(h.entidade||"")}</small><p>${esc(h.alteracao||"")}</p></div>`).join("")}</div>`:`<div class="empty">Nenhum evento de auditoria.</div>`}</div>`;
  document.getElementById("detail-modal").showModal();
  document.getElementById("detail-edit").onclick=()=>{document.getElementById("detail-modal").close();openClientModal(id)};
  document.getElementById("detail-delete").onclick=()=>deleteClient(id);
  document.getElementById("detail-task").onclick=()=>openTaskModal("",false,id);document.getElementById("detail-interaction").onclick=()=>openInteractionModal("",id);
  document.querySelectorAll("[data-detail-deal]").forEach(x=>x.onclick=()=>openDealModal(x.dataset.detailDeal));
  document.querySelectorAll("[data-detail-task]").forEach(x=>x.onclick=()=>openTaskModal(x.dataset.detailTask,true));
}
async function deleteClient(id){
  const c=clientById(id);if(!c)return;if(!confirm(`Excluir "${c.nome}"? Esta ação removerá também negociações, tarefas e interações vinculadas. O registro de auditoria será preservado.`))return;
  const btn=document.getElementById("detail-delete");
  await withButtonLoading(btn,async()=>{
  try{await API.removeClientCascade(id);await auditChange(id,"CLIENTES",id,"Exclusão",`Cliente excluído: ${c.nome}`);document.getElementById("detail-modal").close();await syncAll({silent:true});showView("clientes");toast("Cliente excluído.");}catch(e){toast(e.message,"error")}
  });
}

function fillDealSelects(selected=""){
  document.getElementById("deal-client").innerHTML=STATE.clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  document.getElementById("deal-stage").innerHTML=CONFIG.PIPELINE_STAGES.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join("");
  document.getElementById("deal-origin").innerHTML='<option value="">Selecione</option>'+CONFIG.DEAL_ORIGINS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  document.getElementById("deal-priority").innerHTML=CONFIG.DEAL_PRIORITIES.map(x=>`<option value="${esc(x)}">${esc(priorityLabel(x))}</option>`).join("");
  if(selected)document.getElementById("deal-client").value=selected;
}
function defaultDealProbability(stage){return CONFIG.PIPELINE_STAGES.find(x=>x.id===stage)?.defaultProbability??50}
function openDealModal(id=""){
  const n=id?STATE.negociacoes.find(x=>String(x.id)===String(id)):null;
  document.getElementById("deal-form").reset();fillDealSelects(n?.clienteId);
  document.getElementById("deal-id").value=n?.id||"";document.getElementById("deal-probability").dataset.manual="";document.getElementById("deal-modal-title").textContent=n?"Editar negociação":"Nova negociação";document.getElementById("deal-delete").classList.toggle("hidden",!n);document.getElementById("deal-save-btn").textContent=n?"Salvar negociação":"Criar negociação";
  document.getElementById("deal-client").value=n?.clienteId||STATE.clientes[0]?.id||"";document.getElementById("deal-product").value=n?.produtoServico||"";document.getElementById("deal-stage").value=n?.etapa||"lead";document.getElementById("deal-value").value=n?.valor??"";document.getElementById("deal-probability").value=n?.probabilidade??defaultDealProbability(n?.etapa||"lead");document.getElementById("deal-date").value=n?.previsaoFechamento||n?.previsao||"";document.getElementById("deal-owner").value=n?.responsavel||CONFIG.CURRENT_USER;document.getElementById("deal-origin").value=n?.origem||"";document.getElementById("deal-priority").value=n?.prioridade||"média";
  document.getElementById("deal-stage").onchange=()=>{if(!n||document.getElementById("deal-probability").dataset.manual!=="true")document.getElementById("deal-probability").value=defaultDealProbability(document.getElementById("deal-stage").value)};
  document.getElementById("deal-probability").oninput=()=>document.getElementById("deal-probability").dataset.manual="true";
  document.getElementById("deal-modal").showModal();
}
async function saveDeal(e){
  e.preventDefault();
  const id=val("deal-id"),prob=Math.max(0,Math.min(100,Number(val("deal-probability")||0))),data={clienteId:val("deal-client"),produtoServico:val("deal-product").trim(),etapa:val("deal-stage"),valor:Number(val("deal-value")||0),probabilidade:prob,previsaoFechamento:val("deal-date"),responsavel:val("deal-owner").trim()||CONFIG.CURRENT_USER,origem:val("deal-origin"),prioridade:val("deal-priority")||"média",criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()};
  data.previsao=data.previsaoFechamento;
  if(!data.clienteId||!data.produtoServico){toast("Informe cliente e produto/serviço.","error");return}
  const btn=submitButtonOf(e);
  await withButtonLoading(btn,async()=>{
  try{if(id){const old=STATE.negociacoes.find(x=>String(x.id)===String(id));await API.update(CONFIG.SHEETS.NEGOCIACOES,id,data);const changes=diffDeal(old,data);if(changes)await auditChange(data.clienteId,"NEGOCIACOES",id,"Edição",changes)}else{const n=await API.create(CONFIG.SHEETS.NEGOCIACOES,data);await auditChange(data.clienteId,"NEGOCIACOES",n.id,"Criação",`Negociação criada · ${data.produtoServico} · ${money(data.valor)} · ${stageLabel(data.etapa)}`)}document.getElementById("deal-modal").close();await syncAll({silent:true});toast(id?"Negociação atualizada.":"Negociação criada.");}catch(e){toast(e.message,"error")}
  });
}
function diffDeal(o,n){const p=[];if(o.etapa!==n.etapa)p.push(`Etapa: ${stageLabel(o.etapa)} → ${stageLabel(n.etapa)}`);if(String(o.produtoServico||"")!==String(n.produtoServico||""))p.push(`Produto/serviço: "${o.produtoServico||"—"}" → "${n.produtoServico||"—"}"`);if(Number(o.valor)!==Number(n.valor))p.push(`Valor: ${money(o.valor)} → ${money(n.valor)}`);if(Number(o.probabilidade)!==Number(n.probabilidade))p.push(`Probabilidade: ${Number(o.probabilidade||0)}% → ${Number(n.probabilidade||0)}%`);if((o.previsaoFechamento||o.previsao)!==n.previsaoFechamento)p.push(`Fechamento: ${dateBR(o.previsaoFechamento||o.previsao)} → ${dateBR(n.previsaoFechamento)}`);if(o.responsavel!==n.responsavel)p.push(`Responsável: ${o.responsavel||"—"} → ${n.responsavel||"—"}`);if(o.origem!==n.origem)p.push(`Origem: ${o.origem||"—"} → ${n.origem||"—"}`);if(o.prioridade!==n.prioridade)p.push(`Prioridade: ${priorityLabel(o.prioridade)} → ${priorityLabel(n.prioridade)}`);return p.join(" · ")||"Negociação editada"}
async function deleteDeal(id){const n=STATE.negociacoes.find(x=>String(x.id)===String(id));if(!n||!confirm(`Excluir a negociação de ${clientById(n.clienteId)?.nome||"cliente"}?`))return;const btn=document.getElementById("deal-delete");await withButtonLoading(btn,async()=>{try{await API.remove(CONFIG.SHEETS.NEGOCIACOES,id);await auditChange(n.clienteId,"NEGOCIACOES",id,"Exclusão",`Negociação excluída · ${n.produtoServico||"sem produto/serviço"} · ${money(n.valor)}`);document.getElementById("deal-modal").close();await syncAll({silent:true});toast("Negociação excluída.");}catch(e){toast(e.message,"error")}});}

function applyPipelineConfig(rows){
  const row=(rows||[]).find(x=>x.chave==="pipelineStages"||x.id==="pipelineStages");if(!row?.valor)return;
  try{const parsed=typeof row.valor==="string"?JSON.parse(row.valor):row.valor;if(Array.isArray(parsed)&&parsed.length>=2){const merged=parsed.map((x,i)=>{const base=CONFIG.PIPELINE_STAGES[i]||{};return {...base,...x}});CONFIG.PIPELINE_STAGES=merged}}catch(e){console.warn("Configuração do pipeline inválida",e)}
}
function openPipelineModal(){
  document.getElementById("pipeline-stage-editor").innerHTML=CONFIG.PIPELINE_STAGES.map((s,i)=>`<label><span>${i+1}</span><input data-stage-id="${esc(s.id)}" value="${esc(s.label)}" maxlength="40" required><small>${s.defaultProbability}% padrão</small></label>`).join("");
  document.getElementById("pipeline-modal").showModal();
}
async function savePipelineStages(e){
  e.preventDefault();
  const inputs=[...document.querySelectorAll("#pipeline-stage-editor input[data-stage-id]")];
  const next=CONFIG.PIPELINE_STAGES.map(s=>({...s,label:inputs.find(i=>i.dataset.stageId===s.id)?.value.trim()||s.label}));
  if(next.some(s=>!s.label)){toast("Todas as etapas precisam ter um nome.","error");return}
  const btn=submitButtonOf(e)||document.getElementById("pipeline-save-btn");
  await withButtonLoading(btn,async()=>{
  try{
    const rows=await API.get(CONFIG.SHEETS.CONFIGURACOES),current=rows.find(x=>x.chave==="pipelineStages"||x.id==="pipelineStages"),data={id:current?.id||"pipelineStages",chave:"pipelineStages",valor:JSON.stringify(next)};
    if(current)await API.update(CONFIG.SHEETS.CONFIGURACOES,current.id,data);else await API.create(CONFIG.SHEETS.CONFIGURACOES,data);
    CONFIG.PIPELINE_STAGES=next;document.getElementById("pipeline-modal").close();renderDashboard();renderKanban();toast("Etapas do funil atualizadas.");
  }catch(err){toast(err.message||"Não foi possível salvar as etapas.","error")}
  });
}


function proposalStatusLabel(v){return CONFIG.PROPOSAL_STATUSES_LABEL?.[v]||v||"—"}
function proposalById(id){return STATE.propostas.find(p=>String(p.id)===String(id))}
function proposalTotal(p){return Math.max(0,Number(p.total??((Number(p.quantidade||1)*Number(p.valorUnitario||0))-Number(p.desconto||0))))}
function nextProposalNumber(){const nums=STATE.propostas.map(p=>String(p.numero||"").match(/(\d+)$/)?.[1]).filter(Boolean).map(Number);const n=(nums.length?Math.max(...nums):0)+1;return `PROP-${String(n).padStart(4,"0")}`}
function fillProposalStatus(selected=""){const el=document.getElementById("proposal-status");el.innerHTML=CONFIG.PROPOSAL_STATUS.map(x=>`<option value="${esc(x)}">${esc(proposalStatusLabel(x))}</option>`).join("");el.value=selected||"rascunho"}
function fillProposalClients(selected=""){document.getElementById("proposal-client").innerHTML=STATE.clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");if(selected)document.getElementById("proposal-client").value=selected;fillProposalDeals(selected)}
function fillProposalDeals(clientId="",selected=""){
  const el=document.getElementById("proposal-deal");const deals=STATE.negociacoes.filter(n=>!clientId||String(n.clienteId)===String(clientId));el.innerHTML=`<option value="">Sem negociação vinculada</option>`+deals.map(n=>`<option value="${esc(n.id)}">${esc(n.produtoServico||"Negociação")} · ${money(n.valor)}</option>`).join("");if(selected)el.value=selected;
}
function openProposalModal(id=""){
  const p=id?proposalById(id):null;document.getElementById("proposal-form").reset();document.getElementById("proposal-id").value=p?.id||"";document.getElementById("proposal-modal-title").textContent=p?`Editar proposta ${p.numero||""}`:"Nova proposta";document.getElementById("proposal-delete").classList.toggle("hidden",!p);document.getElementById("proposal-save-btn").textContent=p?"Salvar proposta":"Criar proposta";fillProposalStatus(p?.status||"rascunho");fillProposalClients(p?.clienteId||STATE.clientes[0]?.id||"");fillProposalDeals(p?.clienteId||STATE.clientes[0]?.id||"",p?.negociacaoId||"");document.getElementById("proposal-number").value=p?.numero||nextProposalNumber();document.getElementById("proposal-service").value=p?.servico||p?.servicoDescricao||"";document.getElementById("proposal-qty").value=p?.quantidade||1;document.getElementById("proposal-unit").value=p?.valorUnitario??"";document.getElementById("proposal-discount").value=p?.desconto??0;document.getElementById("proposal-validity").value=p?.validade||"";document.getElementById("proposal-notes").value=p?.observacoes||"";updateProposalTotal();document.getElementById("proposal-modal").showModal();
}
function updateProposalTotal(){const qty=Math.max(1,Number(val("proposal-qty")||1)),unit=Math.max(0,Number(val("proposal-unit")||0)),discount=Math.max(0,Number(val("proposal-discount")||0)),total=Math.max(0,qty*unit-discount);document.getElementById("proposal-total").value=total.toFixed(2);document.getElementById("proposal-total-display").textContent=money(total)}
function proposalDiff(o,n){const parts=[];if(o.status!==n.status)parts.push(`Status: ${proposalStatusLabel(o.status)} → ${proposalStatusLabel(n.status)}`);if(o.servico!==n.servico)parts.push(`Serviço: "${o.servico||"—"}" → "${n.servico||"—"}"`);if(proposalTotal(o)!==proposalTotal(n))parts.push(`Total: ${money(proposalTotal(o))} → ${money(proposalTotal(n))}`);if(o.validade!==n.validade)parts.push(`Validade: ${dateBR(o.validade)} → ${dateBR(n.validade)}`);return parts.join(" · ")||"Proposta editada"}
async function saveProposal(e){
  e.preventDefault();updateProposalTotal();const id=val("proposal-id"),data={numero:val("proposal-number")||nextProposalNumber(),clienteId:val("proposal-client"),negociacaoId:val("proposal-deal"),servico:val("proposal-service").trim(),quantidade:Math.max(1,Number(val("proposal-qty")||1)),valorUnitario:Math.max(0,Number(val("proposal-unit")||0)),desconto:Math.max(0,Number(val("proposal-discount")||0)),total:Math.max(0,Number(val("proposal-total")||0)),validade:val("proposal-validity"),status:val("proposal-status"),observacoes:val("proposal-notes").trim(),atualizadoEm:new Date().toISOString()};
  if(!data.clienteId||!data.servico){toast("Informe cliente e serviço/item.","error");return}
  const btn=submitButtonOf(e)||document.getElementById("proposal-save-btn");
  await withButtonLoading(btn,async()=>{
  try{let saved;if(id){const old=proposalById(id);await API.update(CONFIG.SHEETS.PROPOSTAS,id,data);saved={...old,...data};const changes=proposalDiff(old,saved);if(changes)await auditChange(data.clienteId,"PROPOSTAS",id,"Edição",changes)}else{data.criadoEm=new Date().toISOString();saved=await API.create(CONFIG.SHEETS.PROPOSTAS,data);await auditChange(data.clienteId,"PROPOSTAS",saved.id,"Criação",`Proposta criada · ${saved.numero} · ${money(saved.total)}`)}
    if(saved.status==="aprovada"&&saved.negociacaoId){const deal=STATE.negociacoes.find(n=>String(n.id)===String(saved.negociacaoId));if(deal&&deal.etapa!=="fechado"){await API.update(CONFIG.SHEETS.NEGOCIACOES,deal.id,{etapa:"fechado",probabilidade:100});await auditChange(deal.clienteId,"NEGOCIACOES",deal.id,"Edição",`Proposta ${saved.numero} aprovada → negócio ganho`);}}
    document.getElementById("proposal-modal").close();await syncAll({silent:true});toast(id?"Proposta atualizada.":"Proposta criada.");
  }catch(err){toast(err.message||"Não foi possível salvar a proposta.","error")}
  });
}
async function deleteProposal(id){const p=proposalById(id);if(!p||!confirm(`Excluir a proposta ${p.numero||""}?`))return;const btn=document.getElementById("proposal-delete");await withButtonLoading(btn,async()=>{try{await API.remove(CONFIG.SHEETS.PROPOSTAS,id);await auditChange(p.clienteId,"PROPOSTAS",id,"Exclusão",`Proposta excluída · ${p.numero||""}`);document.getElementById("proposal-modal").close();await syncAll({silent:true});toast("Proposta excluída.")}catch(e){toast(e.message,"error")}});}
function renderProposals(){
  const q=val("proposal-search").trim().toLowerCase(),filter=val("proposal-filter-status");const list=STATE.propostas.filter(p=>{const c=clientById(p.clienteId);const hay=[p.numero,c?.nome,p.servico,p.observacoes].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!filter||p.status===filter)}).sort((a,b)=>String(b.atualizadoEm||b.criadoEm||"").localeCompare(String(a.atualizadoEm||a.criadoEm||"")));
  document.getElementById("proposal-filter-status").innerHTML='<option value="">Todos os status</option>'+CONFIG.PROPOSAL_STATUS.map(x=>`<option value="${esc(x)}">${esc(proposalStatusLabel(x))}</option>`).join("");document.getElementById("proposal-filter-status").value=filter;
  const total=list.reduce((sum,p)=>sum+proposalTotal(p),0),approved=STATE.propostas.filter(p=>p.status==="aprovada").length,pending=STATE.propostas.filter(p=>["enviada","visualizada","negociacao"].includes(p.status)).length;document.getElementById("proposal-summary").innerHTML=`<div><span>Total de propostas</span><strong>${STATE.propostas.length}</strong></div><div><span>Em andamento</span><strong>${pending}</strong></div><div><span>Aprovadas</span><strong>${approved}</strong></div><div><span>Valor filtrado</span><strong>${money(total)}</strong></div>`;
  document.getElementById("proposal-count").textContent=`${list.length} proposta${list.length===1?"":"s"}`;
  document.getElementById("proposals-table").innerHTML=list.length?list.map(p=>{const c=clientById(p.clienteId);return`<tr><td><strong>${esc(p.numero||"—")}</strong></td><td>${esc(c?.nome||"—")}</td><td>${esc(p.servico||"—")}</td><td>${money(proposalTotal(p))}</td><td>${dateBR(p.validade)}</td><td><span class="proposal-status status-${esc(p.status)}">${esc(proposalStatusLabel(p.status))}</span></td><td><button class="text-btn" data-proposal-edit="${esc(p.id)}">Editar</button> <button class="text-btn" data-proposal-print-row="${esc(p.id)}">PDF</button></td></tr>`}).join(""):`<tr><td colspan="7"><div class="empty">Nenhuma proposta encontrada.</div></td></tr>`;
  document.querySelectorAll("[data-proposal-edit]").forEach(b=>b.onclick=()=>openProposalModal(b.dataset.proposalEdit));document.querySelectorAll("[data-proposal-print-row]").forEach(b=>b.onclick=()=>printProposal(b.dataset.proposalPrintRow));
}
function proposalPrintMarkup(p){const c=clientById(p.clienteId);return`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.numero)} — YANSIX</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#20233a;margin:0}header{display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #5B3DF5;padding-bottom:18px}h1{font-size:25px;margin:0 0 6px}h2{font-size:16px;margin:28px 0 10px}p{font-size:12px;line-height:1.6}.brand{color:#5B3DF5;font-weight:800;letter-spacing:.08em}.meta{text-align:right;font-size:11px;color:#646a88}.box{border:1px solid #ddd;border-radius:8px;padding:14px;margin-top:18px}.line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:12px}.line:last-child{border:0}.total{font-size:19px;font-weight:800;color:#5B3DF5;text-align:right;margin-top:18px}.foot{margin-top:45px;color:#777;font-size:10px;border-top:1px solid #ddd;padding-top:10px}</style></head><body><header><div><div class="brand">YANSIX</div><h1>Proposta Comercial</h1><p>${esc(p.numero||"")}</p></div><div class="meta">Validade: ${esc(dateBR(p.validade))}<br>Status: ${esc(proposalStatusLabel(p.status))}</div></header><h2>Cliente</h2><div class="box"><p><strong>${esc(c?.nome||"—")}</strong><br>${esc(c?.empresa||"")}<br>${esc(c?.email||"")} · ${esc(c?.whatsapp||c?.contato||"")}</p></div><h2>Objeto da proposta</h2><div class="box"><div class="line"><span>${esc(p.servico||"—")}</span><span>${esc(p.quantidade||1)} × ${esc(money(p.valorUnitario))}</span></div>${Number(p.desconto||0)>0?`<div class="line"><span>Desconto</span><span>- ${esc(money(p.desconto))}</span></div>`:""}<div class="total">Total: ${esc(money(proposalTotal(p)))}</div></div><h2>Observações</h2><div class="box"><p>${esc(p.observacoes||"Sem observações adicionais.").replace(/\n/g,"<br>")}</p></div><div class="foot">YANSIX CRM · Documento gerado a partir da proposta ${esc(p.numero||"")}. Ao imprimir, escolha “Salvar como PDF” para gerar o arquivo PDF.</div></body></html>`}
function printProposal(id){const p=proposalById(id);if(!p)return;const w=window.open("","_blank","width=900,height=900");if(!w){toast("Permita pop-ups para gerar o PDF.","error");return}w.document.write(proposalPrintMarkup(p));w.document.close();w.focus();setTimeout(()=>w.print(),350)}
function printProposalFromModal(){const id=val("proposal-id");if(id)printProposal(id);else{updateProposalTotal();const p={id:"preview",numero:val("proposal-number"),clienteId:val("proposal-client"),servico:val("proposal-service"),quantidade:Number(val("proposal-qty")||1),valorUnitario:Number(val("proposal-unit")||0),desconto:Number(val("proposal-discount")||0),total:Number(val("proposal-total")||0),validade:val("proposal-validity"),status:val("proposal-status"),observacoes:val("proposal-notes")};const w=window.open("","_blank","width=900,height=900");if(!w){toast("Permita pop-ups para gerar o PDF.","error");return}w.document.write(proposalPrintMarkup(p));w.document.close();w.focus();setTimeout(()=>w.print(),350)}}

function fillTaskSelect(selected=""){document.getElementById("task-client").innerHTML=`<option value="">Sem cliente</option>`+STATE.clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");document.getElementById("task-channel").innerHTML=CONFIG.CHANNELS.map(c=>`<option>${esc(c)}</option>`).join("");if(selected)document.getElementById("task-client").value=selected}
function openTaskModal(id="",edit=false,clientId=""){
  const t=edit?STATE.tarefas.find(x=>String(x.id)===String(id)):null;document.getElementById("task-form").reset();fillTaskSelect(t?.clienteId||clientId);document.getElementById("task-id").value=t?.id||"";document.getElementById("task-modal-title").textContent=t?"Editar tarefa":"Nova tarefa";document.getElementById("task-delete").classList.toggle("hidden",!t);document.getElementById("task-save-btn").textContent=t?"Salvar tarefa":"Criar tarefa";document.getElementById("task-title").value=t?.titulo||"";document.getElementById("task-date").value=t?.data||new Date().toISOString().slice(0,10);document.getElementById("task-time").value=t?.hora||"";document.getElementById("task-channel").value=t?.canal||CONFIG.CHANNELS[0];document.getElementById("task-status").value=t?.status||"pendente";document.getElementById("task-modal").showModal();
}
async function saveTask(e){
  e.preventDefault();const id=val("task-id"),data={titulo:val("task-title"),clienteId:val("task-client"),data:val("task-date"),hora:val("task-time"),canal:val("task-channel"),tipo:val("task-channel"),status:val("task-status"),criadoEm:new Date().toISOString()};if(!data.titulo||!data.data){toast("Preencha tarefa e data.","error");return}
  const btn=submitButtonOf(e)||document.getElementById("task-save-btn");
  await withButtonLoading(btn,async()=>{
  try{if(id){const old=STATE.tarefas.find(x=>String(x.id)===String(id));await API.update(CONFIG.SHEETS.TAREFAS,id,data);await auditChange(data.clienteId,"TAREFAS",id,"Edição",diffTask(old,data))}else{const t=await API.create(CONFIG.SHEETS.TAREFAS,data);await auditChange(data.clienteId,"TAREFAS",t.id,"Criação",`Tarefa criada: ${data.titulo}`)}document.getElementById("task-modal").close();await syncAll({silent:true});toast(id?"Tarefa atualizada.":"Tarefa criada.");}catch(e){toast(e.message,"error")}
  });
}
function diffTask(o,n){const p=[];if(o.titulo!==n.titulo)p.push(`Título: "${o.titulo}" → "${n.titulo}"`);if(o.data!==n.data)p.push(`Data: ${dateBR(o.data)} → ${dateBR(n.data)}`);if(o.status!==n.status)p.push(`Status: ${o.status} → ${n.status}`);if(o.canal!==n.canal)p.push(`Canal: ${o.canal} → ${n.canal}`);return p.join(" · ")||"Tarefa editada"}
async function deleteTask(id){const t=STATE.tarefas.find(x=>String(x.id)===String(id));if(!t||!confirm(`Excluir a tarefa "${t.titulo}"?`))return;const btn=document.getElementById("task-delete");await withButtonLoading(btn,async()=>{try{await API.remove(CONFIG.SHEETS.TAREFAS,id);await auditChange(t.clienteId,"TAREFAS",id,"Exclusão",`Tarefa excluída: ${t.titulo}`);document.getElementById("task-modal").close();await syncAll({silent:true});toast("Tarefa excluída.");}catch(e){toast(e.message,"error")}});}
