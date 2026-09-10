let STATE={usuarios:[],clientes:[],negociacoes:[],interacoes:[],tarefas:[],propostas:[],historico:[],configuracoes:[],comissoes:[],produtos:[],faturas:[],pesquisas:[]};
let SESSION=null;
let SESSION_LAST_ACTIVITY=Date.now();
let SESSION_WARNING_SHOWN=false;
let LOGIN_LOCK={attempts:0,lockedUntil:0};
let agendaFilter="atrasadas";
let currentView="dashboard";
let AUTOMATION_RULES={...CONFIG.AUTOMATION_DEFAULTS};
let INTEGRATION_SETTINGS={...CONFIG.INTEGRATION_DEFAULTS};
let commissionsSubview="vendedores";
let commissionsTeamFilter="";
let commissionsOriginFilter="";
let commissionsProductFilter="";
let lastCommissionsRanking=[];
let commissionsPeriod=currentMonthKey();
let commissionsDetailPeriod=currentMonthKey();
let commissionsDetailContext=null;

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

function nivelStorage(pct){const t=[95,85,70];if(pct>=t[0])return{key:"acao_necessaria",label:"Ação necessária",color:"var(--danger)"};if(pct>=t[1])return{key:"critico",label:"Crítico",color:"#E08A2B"};if(pct>=t[2])return{key:"atencao",label:"Atenção",color:"#C79A1E"};return{key:"ok",label:"Normal",color:"var(--success)"}}

async function renderCrmStatus(){
  const limites=CONFIG.PLAN_LIMITS||{administradores:2,gestores:5,vendedores:20,clientes:3000,storageMb:500};
  const usuariosAtivos=(STATE.usuarios||[]).filter(u=>u.ativo!==false);
  const totalAdmins=usuariosAtivos.filter(u=>u.perfil==="Administrador").length;
  const totalGestores=usuariosAtivos.filter(u=>u.perfil==="Gestor").length;
  const totalVendedores=usuariosAtivos.filter(u=>u.perfil==="Vendedor").length;
  const totalClientes=(STATE.clientes||[]).length;

  document.getElementById("status-admins").textContent=`${totalAdmins} / ${limites.administradores}`;
  document.getElementById("status-gestores").textContent=`${totalGestores} / ${limites.gestores}`;
  document.getElementById("status-vendedores").textContent=`${totalVendedores} / ${limites.vendedores}`;
  document.getElementById("status-clientes").textContent=`${totalClientes} / ${limites.clientes.toLocaleString("pt-BR")}`;

  const sistemaEl=document.getElementById("status-sistema");
  const verificadoEl=document.getElementById("status-verificado");
  const armazenamentoEl=document.getElementById("status-armazenamento");
  const armazenamentoMetaEl=document.getElementById("status-armazenamento-meta");

  try{
    const{data,error}=await SUPABASE_CLIENT.rpc("obter_status_operacional");
    if(error)throw error;
    const linha=Array.isArray(data)?data[0]:data;
    const usadoMb=Number(linha?.tamanho_mb||0);
    const pct=Math.min(100,Math.round((usadoMb/limites.storageMb)*100));
    const nivel=nivelStorage(pct);

    sistemaEl.innerHTML=`<span style="color:${nivel.color}">●</span> ${nivel.key==="ok"?"Operacional":nivel.label}`;
    verificadoEl.textContent=`Verificado agora`;
    armazenamentoEl.innerHTML=`<span style="color:${nivel.color}">${pct}%</span> utilizado`;
    armazenamentoMetaEl.textContent=nivel.key==="ok"?"Dentro do esperado":nivel.label;
  }catch(err){
    sistemaEl.innerHTML=`<span style="color:var(--success)">●</span> Operacional`;
    verificadoEl.textContent="Verificação de armazenamento indisponível";
    armazenamentoEl.textContent="—";
    armazenamentoMetaEl.textContent="Rode sql/status_operacional.sql no Supabase deste CRM";
  }
}

function initNav(){
  document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",e=>{if(!a.dataset.view)return;e.preventDefault();showView(a.dataset.view);document.getElementById("sidebar").classList.remove("open")}));
  document.querySelectorAll("[data-go-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.goView)));
  document.getElementById("mobile-menu").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
}
function hasPermission(view){const p=SESSION?.perfil||"Vendedor",rules=CONFIG.USER_ROLES[p]?.permissions||[];return rules.includes("*")||rules.includes(view)}
function showView(view){
  if(view!=="dashboard"&&!hasPermission(view)){toast("Seu perfil não possui acesso a este módulo.","error");view="dashboard"}
  currentView=view;document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===`view-${view}`));history.replaceState(null,"",`#${view}`);
  if(view==="dashboard")renderDashboard();if(view==="clientes")renderClients();if(view==="funil")renderKanban();if(view==="tarefas")renderTasks();if(view==="interacoes")renderInteractions();if(view==="calendario")renderAgenda();if(view==="propostas")renderProposals();if(view==="relatorios")renderReports();if(view==="configuracoes"){renderAutomationSettings();renderCrmStatus();}if(view==="integracoes")renderIntegrations();if(view==="usuarios")renderUsers();
  if(view==="comissoes"){renderCommissions();if(hasPermission("comissoes"))ensureCommissionRecords().then(()=>{if(currentView==="comissoes")renderCommissions()});}
  if(view==="produtos")renderProducts();if(view==="financeiro")renderFinance();if(view==="satisfacao")renderSatisfaction();
}
function applyPermissions(){
  document.querySelectorAll(".nav-link").forEach(el=>{if(!el.dataset.view)return;el.classList.toggle("permission-hidden",!hasPermission(el.dataset.view));});
  document.querySelectorAll(".admin-only,.admin-only-view").forEach(el=>el.classList.toggle("permission-hidden",SESSION?.perfil!=="Administrador"));
  const badge=document.getElementById("session-user");if(badge&&SESSION){const chamadoUrl=`${CONFIG.SUPORTE_CHAMADO_URL}?origem=crm&produto=crm&nome=${encodeURIComponent(SESSION.nome||"")}&email=${encodeURIComponent(SESSION.email||"")}`;badge.innerHTML=`<strong>${esc(SESSION.nome)}</strong> · ${esc(SESSION.perfil)} <a class="ticket-link" href="${chamadoUrl}" target="_blank" rel="noopener" title="Abrir chamado de suporte">Abrir chamado</a> <button class="logout-button" id="logout-button" type="button">Sair</button>`;}
  const welcomeName=document.getElementById("welcome-name");if(welcomeName&&SESSION?.nome)welcomeName.textContent=SESSION.nome.trim().split(" ")[0];
  document.getElementById("logout-button")?.addEventListener("click",logout);
}
function loadLoginLock(){try{LOGIN_LOCK=JSON.parse(localStorage.getItem("yansix_login_lock_v1"))||LOGIN_LOCK}catch{}}
function saveLoginLock(){localStorage.setItem("yansix_login_lock_v1",JSON.stringify(LOGIN_LOCK))}
function clearLoginLock(){LOGIN_LOCK={attempts:0,lockedUntil:0};saveLoginLock()}
async function restoreSession(){
  try{
    const {data:{session},error}=await SUPABASE_CLIENT.auth.getSession();
    if(error)throw error;
    if(!session?.user){setApiToken("");localStorage.removeItem(CONFIG.SESSION_KEY);showLogin();return;}
    const authUser=session.user;
    const {data:profile,error:profileError}=await SUPABASE_CLIENT.from(CONFIG.DB_TABLES.USUARIOS).select("*").eq("id",String(authUser.id)).maybeSingle();
    if(profileError)throw profileError;
    if(!profile){await SUPABASE_CLIENT.auth.signOut();throw new Error("Usuário autenticado, mas sem perfil no CRM.");}
    if(profile.ativo===false){await SUPABASE_CLIENT.auth.signOut();throw new Error("Este usuário está inativo.");}
    const user=normalizeUser(profile);
    setApiToken(session.access_token||"");
    SESSION={...user,expiresAt:Date.now()+CONFIG.SECURITY.sessionTimeoutMs};
    CONFIG.CURRENT_USER=user.nome;
    SESSION_LAST_ACTIVITY=Date.now();
    localStorage.setItem(CONFIG.SESSION_KEY,JSON.stringify(SESSION));
    applyPermissions();
    document.getElementById("login-overlay").hidden=true;
    await syncAll({silent:false});
    return;
  }catch(error){
    console.warn("Falha ao restaurar sessão Supabase:",error);
    setApiToken("");
    localStorage.removeItem(CONFIG.SESSION_KEY);
    showLogin();
  }
}
function showLogin(){document.getElementById("login-overlay").hidden=false;document.getElementById("login-email")?.focus();}
SUPABASE_CLIENT.auth.onAuthStateChange(async(event,session)=>{
  if(event==="SIGNED_OUT"){
    SESSION=null;
    setApiToken("");
    localStorage.removeItem(CONFIG.SESSION_KEY);
    showLogin();
    return;
  }
  if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"){
    if(!SESSION && session?.user){
      try{await restoreSession()}catch(error){console.warn("Não foi possível sincronizar a sessão:",error);}
    }
  }
});
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
  document.getElementById("notification-btn").onclick=e=>{e.stopPropagation();const panel=document.getElementById("notification-panel");const willOpen=panel.classList.contains("hidden");if(willOpen)renderNotifications();panel.classList.toggle("hidden",!willOpen)};
  document.addEventListener("click",e=>{const panel=document.getElementById("notification-panel");if(panel&&!panel.classList.contains("hidden")&&!panel.contains(e.target)&&e.target.id!=="notification-btn")panel.classList.add("hidden")});
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
  document.querySelectorAll("#comissoes-tabs button").forEach(b=>b.onclick=()=>{commissionsSubview=b.dataset.commissionsTab;renderCommissions()});
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
  document.getElementById("product-form").onsubmit=saveProduct;
  document.getElementById("product-delete").onclick=deleteProduct;
  document.getElementById("invoice-form").onsubmit=saveInvoice;
  document.getElementById("invoice-delete").onclick=deleteInvoice;
  document.getElementById("satisfaction-form").onsubmit=saveSatisfaction;
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.closeModal).close());
}
function renderNotifications(){
  const panel=document.getElementById("notification-panel");if(!panel)return;
  const overdue=(STATE.tarefas||[]).filter(t=>t.status!=="concluida"&&isOverdue(t.data)).sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  if(!overdue.length){panel.innerHTML=`<div class="notification-empty">Nenhuma tarefa em atraso.</div>`;return}
  panel.innerHTML=`<h4>Tarefas em atraso</h4>`+overdue.map(t=>`<button type="button" class="notification-item" data-notification-task="${esc(t.id)}"><strong>${esc(t.titulo)}</strong><small>${esc(clientById(t.clienteId)?.nome||"Sem cliente")} · vencida em ${dateBR(t.data)}</small></button>`).join("");
  panel.querySelectorAll("[data-notification-task]").forEach(b=>b.onclick=()=>{panel.classList.add("hidden");showView("tarefas");openTaskModal(b.dataset.notificationTask,true)});
}
function gestorNome(id){return (STATE.usuarios||[]).find(u=>String(u.id)===String(id))?.nome||"—"}
function renderUsers(){if(SESSION?.perfil!=="Administrador")return;const rows=[`<div class="user-row user-head"><span>Nome</span><span>E-mail</span><span>Perfil</span><span>Gestor</span><span>Status</span><span></span></div>`];for(const u of STATE.usuarios||[]){rows.push(`<div class="user-row"><span><strong>${esc(u.nome)}</strong></span><span>${esc(u.email)}</span><span>${esc(u.perfil)}</span><span>${u.perfil==="Vendedor"?esc(gestorNome(u.gestorId)):"—"}</span><span class="user-status ${u.ativo!==false?"active":"inactive"}">${u.ativo!==false?"Ativo":"Inativo"}</span><span class="user-actions"><button type="button" class="btn btn-ghost" data-edit-user="${esc(u.id)}">Editar</button></span></div>`)}document.getElementById("users-table").innerHTML=rows.join("");document.querySelectorAll("[data-edit-user]").forEach(b=>b.onclick=()=>openUserModal(b.dataset.editUser))}
function fillGestorSelect(selected=""){
  const el=document.getElementById("user-gestor");if(!el)return;
  const gestores=(STATE.usuarios||[]).filter(u=>u.perfil==="Gestor"&&u.ativo!==false);
  const placeholder=gestores.length?`<option value="">Selecione o gestor</option>`:`<option value="">Nenhum gestor cadastrado ainda</option>`;
  el.innerHTML=placeholder+gestores.map(g=>`<option value="${esc(g.id)}">${esc(g.nome)}</option>`).join("");
  el.value=selected||"";
  el.required=gestores.length>0;
}
function toggleGestorField(){const perfil=document.getElementById("user-role").value;const isVendedor=perfil==="Vendedor";document.getElementById("user-gestor-field").classList.toggle("hidden",!isVendedor);const gestorEl=document.getElementById("user-gestor");if(gestorEl)gestorEl.required=isVendedor&&(STATE.usuarios||[]).some(u=>u.perfil==="Gestor"&&u.ativo!==false)}
function openUserModal(id=""){if(SESSION?.perfil!=="Administrador")return;const u=(STATE.usuarios||[]).find(x=>String(x.id)===String(id));document.getElementById("user-id").value=u?.id||"";document.getElementById("user-modal-title").textContent=u?"Editar usuário":"Novo usuário";document.getElementById("user-save-btn").textContent=u?"Salvar usuário":"Criar usuário";document.getElementById("user-name").value=u?.nome||"";document.getElementById("user-email").value=u?.email||"";document.getElementById("user-password").value="";document.getElementById("user-role").value=u?.perfil||"Vendedor";document.getElementById("user-role").onchange=toggleGestorField;fillGestorSelect(u?.gestorId||"");toggleGestorField();document.getElementById("user-active").checked=u?.ativo!==false;document.getElementById("user-modal").showModal()}
async function saveUser(e){e.preventDefault();if(SESSION?.perfil!=="Administrador")return;const id=document.getElementById("user-id").value,nome=document.getElementById("user-name").value.trim(),email=document.getElementById("user-email").value.trim().toLowerCase(),senha=document.getElementById("user-password").value,perfil=document.getElementById("user-role").value,gestorId=perfil==="Vendedor"?document.getElementById("user-gestor").value:"",ativo=document.getElementById("user-active").checked;
  const btn=submitButtonOf(e)||document.getElementById("user-save-btn");
  await withButtonLoading(btn,async()=>{
  try{const duplicate=(STATE.usuarios||[]).find(u=>u.email.toLowerCase()===email&&String(u.id)!==String(id));if(duplicate)throw new Error("Já existe um usuário com este e-mail.");if(!id&&!senha)throw new Error("Informe uma senha para o novo usuário.");const gestoresAtivos=(STATE.usuarios||[]).some(u=>u.perfil==="Gestor"&&u.ativo!==false);if(perfil==="Vendedor"&&gestoresAtivos&&!gestorId)throw new Error("Selecione o gestor responsável por este vendedor.");const data={nome,email,perfil,gestorId,ativo};let saved;if(id){saved=await API.update(CONFIG.SHEETS.USUARIOS,id,data)}else{saved=await API.adminCreateUser({nome,email,senha,perfil,gestorId,ativo})}const i=STATE.usuarios.findIndex(u=>String(u.id)===String(saved.id));if(i>=0)STATE.usuarios[i]={...STATE.usuarios[i],...saved};else STATE.usuarios.push(saved);document.getElementById("user-modal").close();renderUsers();toast("Usuário salvo. As permissões deste usuário são aplicadas a partir do próximo login ou da próxima renovação de sessão (até 30 min).");if(String(SESSION.id)===String(saved.id)){SESSION={...SESSION,...saved};localStorage.setItem(CONFIG.SESSION_KEY,JSON.stringify(SESSION));CONFIG.CURRENT_USER=SESSION.nome;applyPermissions()}}catch(err){toast(err.message||"Não foi possível salvar o usuário.","error")}
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
    filterVisibleState();
    await runAutomations();
    if(hasPermission("comissoes"))await ensureCommissionRecords();
    document.getElementById("notification-count").textContent=String(STATE.tarefas.filter(t=>t.status!=="concluida"&&isOverdue(t.data)).length);
    if(!document.getElementById("notification-panel")?.classList.contains("hidden"))renderNotifications();
    renderDashboard();if(currentView==="clientes")renderClients();if(currentView==="funil")renderKanban();if(currentView==="tarefas")renderTasks();if(currentView==="interacoes")renderInteractions();if(currentView==="calendario")renderAgenda();if(currentView==="propostas")renderProposals();if(currentView==="relatorios")renderReports();if(currentView==="integracoes")renderIntegrations();if(currentView==="comissoes")renderCommissions();if(currentView==="produtos")renderProducts();if(currentView==="financeiro")renderFinance();if(currentView==="satisfacao")renderSatisfaction()
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
function userById(id){return (STATE.usuarios||[]).find(u=>String(u.id)===String(id))}
function resolveUserId(value){
  const v=String(value||"").trim().toLowerCase(); if(!v)return "";
  const exact=(STATE.usuarios||[]).find(u=>String(u.id||"").toLowerCase()===v); if(exact)return String(exact.id);
  const byEmail=(STATE.usuarios||[]).find(u=>String(u.email||"").trim().toLowerCase()===v); if(byEmail)return String(byEmail.id);
  const byLocal=(STATE.usuarios||[]).find(u=>String(u.email||"").split("@")[0].trim().toLowerCase()===v); if(byLocal)return String(byLocal.id);
  const byName=(STATE.usuarios||[]).find(u=>String(u.nome||"").trim().toLowerCase()===v); return byName?String(byName.id):"";
}
function ownerIdForClient(c){return String(c?.responsavelId||resolveUserId(c?.responsavel)||"")}
function ownerName(value){const u=userById(resolveUserId(value));return u?.nome||String(value||"Sem responsável")}
function visibleClientIds(){
  if(!SESSION||SESSION.perfil==="Administrador")return new Set((STATE.clientes||[]).map(c=>String(c.id)));
  const me=String(SESSION.id),allowedUsers=new Set([me]);
  if(SESSION.perfil==="Gestor")for(const u of STATE.usuarios||[]){if(u.ativo!==false&&u.perfil==="Vendedor"&&String(u.gestorId||"")===me)allowedUsers.add(String(u.id))}
  return new Set((STATE.clientes||[]).filter(c=>allowedUsers.has(ownerIdForClient(c))||allowedUsers.has(String(c?.segundoResponsavel||""))).map(c=>String(c.id)));
}
function filterVisibleState(){
  const ids=visibleClientIds();
  STATE.clientes=(STATE.clientes||[]).filter(c=>ids.has(String(c.id)));
  const byClient=rows=>(rows||[]).filter(r=>!r.clienteId||ids.has(String(r.clienteId)));
  STATE.negociacoes=byClient(STATE.negociacoes); STATE.interacoes=byClient(STATE.interacoes); STATE.tarefas=byClient(STATE.tarefas); STATE.propostas=byClient(STATE.propostas); STATE.historico=byClient(STATE.historico); STATE.comissoes=byClient(STATE.comissoes); STATE.faturas=byClient(STATE.faturas); STATE.pesquisas=byClient(STATE.pesquisas);
}
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
  document.getElementById("source-chart").innerHTML=rows.length?rows.map(([k,v])=>`<div class="source-row"><span>${esc(k)}</span><div class="bar-track"><i class="pct-${Math.round(v/max*100)}"></i></div><strong>${v}</strong></div>`).join(""):`<div class="empty">Sem dados.</div>`;
}
function renderStageChart(){
  const vals=CONFIG.PIPELINE_STAGES.map(s=>[s,STATE.negociacoes.filter(n=>n.etapa===s.id).length]),max=Math.max(1,...vals.map(x=>x[1]));
  document.getElementById("stage-chart").innerHTML=vals.map(([s,v])=>`<div class="stage-bar-wrap"><b>${v}</b><div class="stage-bar barh-${Math.round(Math.max(4,v/max*105))}"></div><span>${esc(s.label)}</span></div>`).join("");
}
function renderStageValues(){
  const vals=CONFIG.PIPELINE_STAGES.map(s=>{const v=STATE.negociacoes.filter(n=>n.etapa===s.id).reduce((a,n)=>a+Number(n.valor||0),0);return[s,v]}),max=Math.max(1,...vals.map(x=>x[1]));
  document.getElementById("stage-values").innerHTML=vals.map(([s,v])=>`<div class="value-row"><span>${esc(s.label)}</span><div class="bar-track"><i class="pct-${Math.round(v/max*100)}"></i></div><strong>${money(v)}</strong></div>`).join("");
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
function reportDealDate(n){return n.dataFechamento||n.previsaoFechamento||n.previsao||n.criadoEm}
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
  renderReportSources(clients);renderReportStages(deals);renderReportRevenue(wins);renderReportPerformance(wins,topSource,topService);renderReportHistory(w,clients,deals,wins,losses,proposals);renderReportLossReasons(losses);
}
function reportCard(label,value,meta){return`<div class="report-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(meta)}</small></div>`}
function reportTop(list,fn){const map={};list.forEach(x=>{const k=String(fn(x)||"Não informado");map[k]=(map[k]||0)+1});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5)}
function renderReportSources(clients){const rows=reportTop(clients,c=>c.origem||"Não informado"),max=Math.max(1,...rows.map(x=>x[1]));document.getElementById("report-source-chart").innerHTML=rows.length?rows.map(([k,v])=>`<div class="report-bar-row"><div><span>${esc(k)}</span><strong>${v}</strong></div><div class="bar-track"><i class="pct-${Math.round(v/max*100)}"></i></div></div>`).join(""):"<div class='empty'>Sem leads no período.</div>"}
function renderReportStages(deals){const rows=CONFIG.PIPELINE_STAGES.map(s=>{const ds=deals.filter(n=>n.etapa===s.id);return{s,count:ds.length,value:ds.reduce((a,n)=>a+reportDealValue(n),0)}});const max=Math.max(1,...rows.map(x=>x.count));document.getElementById("report-stage-chart").innerHTML=rows.map(x=>`<div class="report-stage-row"><div class="report-stage-label"><span>${esc(x.s.label)}</span><b>${x.count}</b></div><div class="report-stage-track"><i class="pct-${Math.round(x.count/max*100)}"></i></div><small>${money(x.value)}</small></div>`).join("")}
function renderReportRevenue(wins){const map={};wins.forEach(n=>{const k=reportMonthKey(n.dataFechamento||n.criadoEm||n.previsaoFechamento||n.previsao);if(k)map[k]=(map[k]||0)+reportDealValue(n)});const rows=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12),max=Math.max(1,...rows.map(x=>x[1]));document.getElementById("report-revenue-chart").innerHTML=rows.length?rows.map(([k,v])=>`<div class="report-bar-row"><div><span>${esc(reportMonthLabel(k))}</span><strong>${money(v)}</strong></div><div class="bar-track"><i class="pct-${Math.round(v/max*100)}"></i></div></div>`).join(""):"<div class='empty'>Sem vendas no período.</div>"}
function renderReportPerformance(wins,topSource,topService){const source=topSource[0],service=topService[0];document.getElementById("report-performance").innerHTML=`<div class="rank-item"><span>Melhor origem</span><strong>${esc(source?.[0]||"—")}</strong><small>${source?.[1]||0} lead${source?.[1]===1?"":"s"}</small></div><div class="rank-item"><span>Melhor serviço / oportunidade</span><strong>${esc(service?.[0]||"—")}</strong><small>${service?.[1]||0} venda${service?.[1]===1?"":"s"}</small></div><div class="rank-list"><h4>Top origens</h4>${topSource.map(([k,v])=>`<div><span>${esc(k)}</span><b>${v}</b></div>`).join("")||"<small>Sem dados.</small>"}</div>`}
function renderReportHistory(w,clients,deals,wins,losses,proposals){const months={};const add=(date,type,value=1)=>{const k=reportMonthKey(date);if(!k)return;(months[k]??={leads:0,oportunidades:0,vendas:0,valor:0});months[k][type]+=value};clients.forEach(c=>add(c.criadoEm,"leads"));deals.forEach(n=>add(n.criadoEm||n.previsaoFechamento||n.previsao,"oportunidades"));wins.forEach(n=>{add(n.dataFechamento||n.criadoEm||n.previsaoFechamento||n.previsao,"vendas");add(n.dataFechamento||n.criadoEm||n.previsaoFechamento||n.previsao,"valor",reportDealValue(n))});const rows=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8);document.getElementById("report-history").innerHTML=`<div class="history-kpis"><span>Perdas <b>${losses.length}</b></span><span>Propostas <b>${proposals.length}</b></span></div><div class="history-table"><div class="history-head"><span>Mês</span><span>Leads</span><span>Oport.</span><span>Vendas</span><span>Faturamento</span></div>${rows.map(([k,v])=>`<div class="history-row"><span>${esc(reportMonthLabel(k))}</span><span>${v.leads}</span><span>${v.oportunidades}</span><span>${v.vendas}</span><span>${money(v.valor)}</span></div>`).join("")||"<div class='empty'>Sem histórico suficiente.</div>"}</div>`}
function reportSalesCycle(wins){const values=wins.map(n=>{const start=reportDate(n.criadoEm);const end=reportDate(n.dataFechamento||n.fechadoEm||n.previsaoFechamento);if(!start||!end||end<start)return null;return(end-start)/86400000}).filter(x=>x!==null);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}
function renderReportLossReasons(losses){
  const reasons=reportTop(losses,n=>n.motivoPerda||"Não informado");
  const origins=reportTop(losses,n=>clientById(n.clienteId)?.origem||"Não informado");
  const maxR=Math.max(1,...reasons.map(x=>x[1])),maxO=Math.max(1,...origins.map(x=>x[1]));
  document.getElementById("report-loss-reasons").innerHTML=`
    <div><h4>Motivos mais comuns</h4>${reasons.length?reasons.map(([k,v])=>`<div class="report-bar-row"><div><span>${esc(k)}</span><strong>${v}</strong></div><div class="bar-track"><i class="pct-${Math.round(v/maxR*100)}"></i></div></div>`).join(""):`<div class="empty">Nenhuma negociação perdida no período.</div>`}</div>
    <div><h4>Perdas por origem do lead</h4>${origins.length?origins.map(([k,v])=>`<div class="report-bar-row"><div><span>${esc(k)}</span><strong>${v}</strong></div><div class="bar-track"><i class="pct-${Math.round(v/maxO*100)}"></i></div></div>`).join(""):`<div class="empty">Sem dados.</div>`}</div>`;
}

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
    return `<div class="kanban-column" data-stage="${esc(stage.id)}"><div class="kanban-head"><div><strong>${esc(stage.label)}</strong><small>${deals.length} · ${money(stageValue)}</small></div><span>${deals.length}</span></div><div class="kanban-cards">${deals.length?deals.map(n=>{const c=clientById(n.clienteId);return `<article class="deal-card priority-${esc(n.prioridade||'média')}" draggable="true" data-deal="${esc(n.id)}"><div class="deal-card-top"><span class="deal-priority">${esc(priorityLabel(n.prioridade))}</span><span>${Number(n.probabilidade||0)}%</span></div><strong>${esc(c?.nome||"Cliente removido")}</strong><div class="deal-product">${esc(n.produtoServico||"Produto/serviço não informado")}</div><div class="deal-value">${money(n.valor)}</div><div class="deal-meta"><span>Fechamento<br><b>${dateBR(n.previsaoFechamento||n.previsao)}</b></span><span>Origem<br><b>${esc(n.origem||"—")}</b></span></div><div class="deal-footer"><small>${esc(ownerName(n.responsavel)||"Sem responsável")}</small>${c?`<a class="wa-mini" target="_blank" rel="noopener" href="${waLink(c.whatsapp||c.contato,`Olá, ${c.nome}! Estou acompanhando nossa negociação.`)}">WhatsApp ↗</a>`:""}</div></article>`}).join(""):`<div class="empty">Solte aqui</div>`}</div></div>`
  }).join("");
  document.querySelectorAll(".deal-card").forEach(card=>{card.addEventListener("click",e=>{if(!e.target.closest("a"))openDealModal(card.dataset.deal)});card.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",card.dataset.deal))});
  document.querySelectorAll(".kanban-column").forEach(col=>{col.addEventListener("dragover",e=>{e.preventDefault();col.classList.add("drag-over")});col.addEventListener("dragleave",()=>col.classList.remove("drag-over"));col.addEventListener("drop",async e=>{e.preventDefault();col.classList.remove("drag-over");const id=e.dataTransfer.getData("text/plain"),n=STATE.negociacoes.find(x=>String(x.id)===String(id));if(!n||n.etapa===col.dataset.stage)return;const old=n.etapa;const patch={etapa:col.dataset.stage};if(col.dataset.stage==="fechado"&&old!=="fechado")patch.dataFechamento=new Date().toISOString().slice(0,10);if(col.dataset.stage==="perdido"){const motivo=prompt("Motivo da perda:","");if(motivo===null)return;patch.motivoPerda=motivo.trim()}try{await API.update(CONFIG.SHEETS.NEGOCIACOES,id,patch);await auditChange(n.clienteId,"NEGOCIACOES",id,"Mudança de etapa",`Etapa: ${stageLabel(old)} → ${stageLabel(col.dataset.stage)}`+(patch.motivoPerda?` · Motivo: ${patch.motivoPerda}`:""));await syncAll({silent:true});toast(`Negociação movida para ${stageLabel(col.dataset.stage)}.`)}catch(err){toast(err.message,"error")}})});
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

/* =========================================================
   RESPONSÁVEL — SELEÇÃO A PARTIR DOS USUÁRIOS CADASTRADOS
   Antes, "responsavel" era um texto livre: bastava deixar em
   branco ou digitar um nome diferente para o cliente/negociação
   ficar sem visibilidade para ninguém (nem para quem cadastrou).
   Agora ele é escolhido em uma lista dos usuários já cadastrados,
   filtrada conforme quem está logado, para nunca ficar vazio nem
   apontar para um nome que não existe no sistema.
   ========================================================= */
function getResponsavelOptions(){
  const all=(STATE.usuarios||[]).filter(u=>u.ativo!==false);
  if(!SESSION||SESSION.perfil==="Administrador")return all;
  if(SESSION.perfil==="Gestor")return all.filter(u=>String(u.id)===String(SESSION.id)||(u.perfil==="Vendedor"&&String(u.gestorId||"")===String(SESSION.id)));
  return all.filter(u=>String(u.id)===String(SESSION.id));
}
function populateResponsavelSelect(el,currentValue,{optional=false,lockForSeller=true}={}){
  if(!el)return;
  const options=getResponsavelOptions(),currentId=resolveUserId(currentValue);
  const emptyLabel=optional?"Nenhum":"Selecione um responsável";
  el.innerHTML=`<option value="">${esc(emptyLabel)}</option>`+options.map(u=>`<option value="${esc(u.id)}">${esc(u.nome)}${u.perfil?` · ${esc(u.perfil)}`:""}</option>`).join("");
  if(options.some(u=>String(u.id)===currentId))el.value=currentId;
  else el.value=optional?"":(SESSION?.id||"");
  el.disabled=lockForSeller&&SESSION?.perfil==="Vendedor";
}
function buildClientForm(){
  const wrap=document.getElementById("client-form-sections");
  const fieldMap={pessoais:["nome","cpfCnpj","contato","whatsapp","email","dataNascimento"],comerciais:["empresa","cargo","segmento","porte","origem","responsavel","segundoResponsavel","status","potencial"],endereco:["cep","rua","numero","complemento","bairro","cidade","estado"],digital:["instagram","facebook","linkedin","site"],interno:["tags","preferencias","observacoes"]};
  wrap.innerHTML=CONFIG.CLIENT_SECTIONS.map((section,idx)=>`<section class="form-section"><div class="form-section-head"><p class="eyebrow">${String(idx+1).padStart(2,"0")}</p><h4>${esc(section.label)}</h4></div><div class="form-grid">${(fieldMap[section.id]||[]).map(id=>fieldHtml(CONFIG.CLIENT_FIELDS.find(f=>f.id===id))).join("")}</div></section>`).join("");
}
function fieldHtml(f){
  if(!f)return"";const req=f.required?"required":"";
  if(f.id==="responsavel"||f.id==="segundoResponsavel")return`<label>${esc(f.label)}<select id="client-${f.id}"></select></label>`;
  if(f.type==="textarea")return`<label class="span-2">${esc(f.label)}<textarea id="client-${f.id}" rows="${f.id==="observacoes"?4:3}" ${req}></textarea></label>`;
  if(f.type==="select")return`<label>${esc(f.label)}<select id="client-${f.id}" ${req}><option value="">Selecione</option>${f.options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></label>`;
  return`<label>${esc(f.label)}${f.required?" *":""}<input id="client-${f.id}" type="${f.type}" ${req}></label>`;
}
function openClientModal(id=""){
  const form=document.getElementById("client-form");form.reset();document.getElementById("client-id").value=id||"";
  const c=id?clientById(id):null;document.getElementById("client-modal-title").textContent=c?"Editar cliente":"Novo cliente / lead";document.getElementById("client-save-btn").textContent=c?"Salvar alterações":"Salvar cliente";
  CONFIG.CLIENT_FIELDS.forEach(f=>{if(f.id==="responsavel"||f.id==="segundoResponsavel")return;const el=document.getElementById(`client-${f.id}`);if(!el)return;el.value=c?String(c[f.id]??""):String(CONFIG.CLIENT_DEFAULTS[f.id]??"")});
  populateResponsavelSelect(document.getElementById("client-responsavel"),c?c.responsavel:"");
  populateResponsavelSelect(document.getElementById("client-segundoResponsavel"),c?c.segundoResponsavel:"",{optional:true,lockForSeller:false});
  document.getElementById("client-modal").showModal();
}
async function saveClient(e){
  e.preventDefault();const id=val("client-id"),data={};CONFIG.CLIENT_FIELDS.forEach(f=>{const el=document.getElementById(`client-${f.id}`);if(el)data[f.id]=el.value.trim()});
  const selectedOwnerId=resolveUserId(data.responsavel)||String(SESSION?.id||""); if(selectedOwnerId){data.responsavel=selectedOwnerId;}
  data.segundoResponsavel=resolveUserId(data.segundoResponsavel)||null;
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
  const fieldMap={pessoais:["nome","cpfCnpj","contato","whatsapp","email","dataNascimento"],comerciais:["empresa","cargo","segmento","porte","origem","responsavel","segundoResponsavel","status","potencial"],endereco:["cep","rua","numero","complemento","bairro","cidade","estado"],digital:["instagram","facebook","linkedin","site"],interno:["tags","preferencias","observacoes"]};
  const sections=CONFIG.CLIENT_SECTIONS.map(s=>`<div class="detail-section"><h4>${esc(s.label)}</h4>${(fieldMap[s.id]||[]).map(fid=>{const f=CONFIG.CLIENT_FIELDS.find(x=>x.id===fid);let v=c[fid];if(fid==="responsavel")v=ownerName(c.responsavelId||c.responsavel);if(fid==="segundoResponsavel")v=c.segundoResponsavel?ownerName(c.segundoResponsavel):"Nenhum";if(fid==="dataNascimento")v=dateBR(v);if(f.type==="url"&&v)v=`<a class="detail-link" href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>`;else v=esc(v||"—");return`<div class="detail-row"><span>${esc(f.label)}</span><strong>${v}</strong></div>`}).join("")}</div>`).join("");
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
  document.getElementById("deal-product-list").innerHTML=(STATE.produtos||[]).filter(p=>p.ativo!==false).map(p=>`<option value="${esc(p.nome)}">`).join("");
  document.getElementById("deal-loss-reason-list").innerHTML=CONFIG.LOSS_REASONS.map(x=>`<option value="${esc(x)}">`).join("");
  if(selected)document.getElementById("deal-client").value=selected;
}
function defaultDealProbability(stage){return CONFIG.PIPELINE_STAGES.find(x=>x.id===stage)?.defaultProbability??50}
function toggleLossReasonField(){const isLost=document.getElementById("deal-stage").value==="perdido";document.getElementById("deal-loss-reason-wrap").classList.toggle("hidden",!isLost)}
function openDealModal(id=""){
  const n=id?STATE.negociacoes.find(x=>String(x.id)===String(id)):null;
  document.getElementById("deal-form").reset();fillDealSelects(n?.clienteId);
  document.getElementById("deal-id").value=n?.id||"";document.getElementById("deal-probability").dataset.manual="";document.getElementById("deal-modal-title").textContent=n?"Editar negociação":"Nova negociação";document.getElementById("deal-delete").classList.toggle("hidden",!n);document.getElementById("deal-save-btn").textContent=n?"Salvar negociação":"Criar negociação";
  document.getElementById("deal-client").value=n?.clienteId||STATE.clientes[0]?.id||"";document.getElementById("deal-product").value=n?.produtoServico||"";document.getElementById("deal-stage").value=n?.etapa||"lead";document.getElementById("deal-value").value=n?.valor??"";document.getElementById("deal-probability").value=n?.probabilidade??defaultDealProbability(n?.etapa||"lead");document.getElementById("deal-date").value=n?.previsaoFechamento||n?.previsao||"";populateResponsavelSelect(document.getElementById("deal-owner"),n?.responsavel||"");document.getElementById("deal-origin").value=n?.origem||"";document.getElementById("deal-priority").value=n?.prioridade||"média";document.getElementById("deal-loss-reason").value=n?.motivoPerda||"";
  toggleLossReasonField();
  document.getElementById("deal-product").oninput=()=>{if(document.getElementById("deal-value").value)return;const p=(STATE.produtos||[]).find(x=>x.nome===document.getElementById("deal-product").value);if(p?.precoPadrao)document.getElementById("deal-value").value=p.precoPadrao};
  document.getElementById("deal-stage").onchange=()=>{if(!n||document.getElementById("deal-probability").dataset.manual!=="true")document.getElementById("deal-probability").value=defaultDealProbability(document.getElementById("deal-stage").value);toggleLossReasonField()};
  document.getElementById("deal-probability").oninput=()=>document.getElementById("deal-probability").dataset.manual="true";
  document.getElementById("deal-modal").showModal();
}
async function saveDeal(e){
  e.preventDefault();
  const id=val("deal-id"),prob=Math.max(0,Math.min(100,Number(val("deal-probability")||0)));
  const old=id?STATE.negociacoes.find(x=>String(x.id)===String(id)):null;
  const data={clienteId:val("deal-client"),produtoServico:val("deal-product").trim(),etapa:val("deal-stage"),valor:Number(val("deal-value")||0),probabilidade:prob,previsaoFechamento:val("deal-date"),responsavel:val("deal-owner").trim()||CONFIG.CURRENT_USER,origem:val("deal-origin"),prioridade:val("deal-priority")||"média",motivoPerda:val("deal-stage")==="perdido"?val("deal-loss-reason").trim():"",criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()};
  data.previsao=data.previsaoFechamento;
  if(data.etapa==="fechado"&&old?.etapa!=="fechado")data.dataFechamento=new Date().toISOString().slice(0,10);
  if(!data.clienteId||!data.produtoServico){toast("Informe cliente e produto/serviço.","error");return}
  if(data.etapa==="perdido"&&!data.motivoPerda){toast("Informe o motivo da perda.","error");return}
  const btn=submitButtonOf(e);
  await withButtonLoading(btn,async()=>{
  try{if(id){await API.update(CONFIG.SHEETS.NEGOCIACOES,id,data);const changes=diffDeal(old,data);if(changes)await auditChange(data.clienteId,"NEGOCIACOES",id,"Edição",changes)}else{const n=await API.create(CONFIG.SHEETS.NEGOCIACOES,data);await auditChange(data.clienteId,"NEGOCIACOES",n.id,"Criação",`Negociação criada · ${data.produtoServico} · ${money(data.valor)} · ${stageLabel(data.etapa)}`)}document.getElementById("deal-modal").close();await syncAll({silent:true});toast(id?"Negociação atualizada.":"Negociação criada.");}catch(e){toast(e.message,"error")}
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
    if(saved.status==="aprovada"&&saved.negociacaoId){const deal=STATE.negociacoes.find(n=>String(n.id)===String(saved.negociacaoId));if(deal&&deal.etapa!=="fechado"){await API.update(CONFIG.SHEETS.NEGOCIACOES,deal.id,{etapa:"fechado",probabilidade:100,dataFechamento:new Date().toISOString().slice(0,10)});await auditChange(deal.clienteId,"NEGOCIACOES",deal.id,"Edição",`Proposta ${saved.numero} aprovada → negócio ganho`);}}
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

/* =========================================================
   FASE — COMISSÕES DE VENDEDORES E GESTORES
   Cada negociação com etapa "fechado" gera até 2 linhas na
   tabela COMISSOES: uma para o vendedor responsável (papel
   "vendedor") e, se ele tiver gestor vinculado (gestorId),
   outra para o gestor (papel "gestor"), cada uma com seu
   próprio percentual preenchido manualmente. O valor da
   comissão é sempre recalculado a partir do valor atual da
   negociação, para nunca ficar desatualizado.
   ========================================================= */
function monthKeyFromDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function currentMonthKey(){return monthKeyFromDate(new Date())}
function previousMonthKey(key){if(!key)return"";const [y,m]=key.split("-").map(Number);return monthKeyFromDate(new Date(y,m-2,1))}
function teamMembers(gestorId){return (STATE.usuarios||[]).filter(u=>u.perfil==="Vendedor"&&String(u.gestorId||"")===String(gestorId))}
function allSellers(){return (STATE.usuarios||[]).filter(u=>u.perfil==="Vendedor"&&u.ativo!==false)}
function allManagers(){return (STATE.usuarios||[]).filter(u=>u.perfil==="Gestor"&&u.ativo!==false)}
function commissionRow(negociacaoId,papel){return STATE.comissoes.find(c=>String(c.negociacaoId)===String(negociacaoId)&&c.papel===papel)}
function commissionValue(row,deal){const base=Number(deal?.valor??row?.valorVenda??0);return Math.max(0,base*Number(row?.percentual||0)/100)}
function commissionStatusLabel(v){return CONFIG.COMMISSION_STATUS_LABELS?.[v]||v||"Pendente"}
function sellerClosedDeals(sellerId){return STATE.negociacoes.filter(n=>n.etapa==="fechado"&&resolveUserId(n.responsavel)===String(sellerId))}
function sellerSecondResponsavelDeals(sellerId){return STATE.negociacoes.filter(n=>n.etapa==="fechado"&&String(clientById(n.clienteId)?.segundoResponsavel||"")===String(sellerId))}
function managerClosedDeals(managerId){const ids=new Set(teamMembers(managerId).map(u=>String(u.id)));return STATE.negociacoes.filter(n=>n.etapa==="fechado"&&ids.has(resolveUserId(n.responsavel)))}
function filterDealsByPeriod(deals,period){return period?deals.filter(n=>reportMonthKey(reportDealDate(n))===period):deals}
function sellerSoldInPeriod(sellerId,period){return filterDealsByPeriod(sellerClosedDeals(sellerId),period).reduce((a,n)=>a+Number(n.valor||0),0)}
function conversionForSeller(sellerId,period){
  const myClients=STATE.clientes.filter(c=>ownerIdForClient(c)===String(sellerId));
  const myClientIds=new Set(myClients.map(c=>String(c.id)));
  const meetingClientIds=new Set(STATE.interacoes.filter(i=>{if((i.tipo||i.canal)!=="Reunião")return false;if(period&&reportMonthKey(i.data)!==period)return false;return myClientIds.has(String(i.clienteId))}).map(i=>String(i.clienteId)));
  if(!meetingClientIds.size)return{meetings:0,closed:0,rate:0};
  const closed=[...meetingClientIds].filter(cid=>STATE.negociacoes.some(n=>String(n.clienteId)===cid&&n.etapa==="fechado")).length;
  return{meetings:meetingClientIds.size,closed,rate:closed/meetingClientIds.size*100};
}
async function ensureCommissionRecords(){
  const closed=STATE.negociacoes.filter(n=>n.etapa==="fechado");
  for(const n of closed){
    const vendedorId=resolveUserId(n.responsavel);
    if(!vendedorId)continue;
    if(!commissionRow(n.id,"vendedor")){
      try{const rec=await API.create(CONFIG.SHEETS.COMISSOES,{negociacaoId:n.id,clienteId:n.clienteId,usuarioId:vendedorId,papel:"vendedor",valorVenda:Number(n.valor||0),percentual:null,valorComissao:0,status:"pendente",dataPagamento:"",criadoEm:new Date().toISOString()});STATE.comissoes.push(rec)}catch(e){console.warn("Comissão (vendedor):",e)}
    }
    const gestorId=userById(vendedorId)?.gestorId?String(userById(vendedorId).gestorId):"";
    if(gestorId&&!commissionRow(n.id,"gestor")){
      try{const rec=await API.create(CONFIG.SHEETS.COMISSOES,{negociacaoId:n.id,clienteId:n.clienteId,usuarioId:gestorId,papel:"gestor",valorVenda:Number(n.valor||0),percentual:null,valorComissao:0,status:"pendente",dataPagamento:"",criadoEm:new Date().toISOString()});STATE.comissoes.push(rec)}catch(e){console.warn("Comissão (gestor):",e)}
    }
    const cliente=clientById(n.clienteId),segundoId=cliente?.segundoResponsavel?resolveUserId(cliente.segundoResponsavel):"";
    if(segundoId&&!commissionRow(n.id,"segundo_responsavel")){
      try{const rec=await API.create(CONFIG.SHEETS.COMISSOES,{negociacaoId:n.id,clienteId:n.clienteId,usuarioId:segundoId,papel:"segundo_responsavel",valorVenda:Number(n.valor||0),percentual:null,valorComissao:0,status:"pendente",dataPagamento:"",criadoEm:new Date().toISOString()});STATE.comissoes.push(rec)}catch(e){console.warn("Comissão (segundo responsável):",e)}
    }
  }
}
function availableCommissionPeriods(){const set=new Set(STATE.negociacoes.filter(n=>n.etapa==="fechado").map(n=>reportMonthKey(reportDealDate(n))).filter(Boolean));set.add(currentMonthKey());return[...set].sort().reverse()}
function commissionPeriodOptions(selected){return `<option value="">Todos os períodos</option>`+availableCommissionPeriods().map(k=>`<option value="${k}" ${k===selected?"selected":""}>${esc(reportMonthLabel(k))}</option>`).join("")}
function commissionTeamOptions(selected){return `<option value="">Todas as equipes</option>`+allManagers().map(g=>`<option value="${esc(g.id)}" ${String(g.id)===String(selected)?"selected":""}>${esc(g.nome)}</option>`).join("")}

function renderCommissions(){
  document.querySelectorAll("#comissoes-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.commissionsTab===commissionsSubview));
  const body=document.getElementById("comissoes-body");if(!body)return;
  if(commissionsSubview==="vendedores")body.innerHTML=commissionsSellersMarkup();
  else if(commissionsSubview==="gestores")body.innerHTML=commissionsManagersMarkup();
  else body.innerHTML=commissionsPerformanceMarkup();
  bindCommissionsEvents();
}
function commissionsSellersMarkup(){
  const sellers=allSellers().filter(u=>!commissionsTeamFilter||String(u.gestorId||"")===commissionsTeamFilter);
  const rows=sellers.map(u=>{const deals=filterDealsByPeriod(sellerClosedDeals(u.id),commissionsPeriod);const totalVendido=deals.reduce((a,n)=>a+Number(n.valor||0),0);const totalComissao=deals.reduce((a,n)=>a+commissionValue(commissionRow(n.id,"vendedor"),n),0);const pago=deals.filter(n=>commissionRow(n.id,"vendedor")?.status==="pago").length;const dealsSegundo=filterDealsByPeriod(sellerSecondResponsavelDeals(u.id),commissionsPeriod);const totalComissaoSegundo=dealsSegundo.reduce((a,n)=>a+commissionValue(commissionRow(n.id,"segundo_responsavel"),n),0);return{u,deals,totalVendido,totalComissao,pago,dealsSegundo,totalComissaoSegundo}}).sort((a,b)=>b.totalVendido-a.totalVendido);
  return`<div class="panel commissions-panel">
    <div class="commissions-toolbar"><select id="commissions-period">${commissionPeriodOptions(commissionsPeriod)}</select><select id="commissions-team-filter">${commissionTeamOptions(commissionsTeamFilter)}</select></div>
    <div class="table-scroll"><table><thead><tr><th>Vendedor</th><th>Gestor</th><th>Vendas</th><th>Valor vendido</th><th>Comissão</th><th>Pagas</th><th>Como 2º responsável</th><th></th></tr></thead>
    <tbody>${rows.length?rows.map(r=>`<tr><td><strong>${esc(r.u.nome)}</strong></td><td>${esc(gestorNome(r.u.gestorId))}</td><td>${r.deals.length}</td><td>${money(r.totalVendido)}</td><td>${money(r.totalComissao)}</td><td>${r.pago}/${r.deals.length}</td><td>${r.dealsSegundo.length?`${r.dealsSegundo.length} venda${r.dealsSegundo.length===1?"":"s"} · ${money(r.totalComissaoSegundo)}`:"—"}</td><td><button type="button" class="text-btn" data-commission-seller="${esc(r.u.id)}">Ver vendas →</button>${r.dealsSegundo.length?` <button type="button" class="text-btn" data-commission-seller-segundo="${esc(r.u.id)}">Ver 2º resp. →</button>`:""}</td></tr>`).join(""):`<tr><td colspan="8"><div class="empty">Nenhum vendedor encontrado para este filtro.</div></td></tr>`}</tbody></table></div>
  </div>`;
}
function commissionsManagersMarkup(){
  const managers=allManagers();
  const rows=managers.map(g=>{const deals=filterDealsByPeriod(managerClosedDeals(g.id),commissionsPeriod);const totalVendido=deals.reduce((a,n)=>a+Number(n.valor||0),0);const totalComissao=deals.reduce((a,n)=>a+commissionValue(commissionRow(n.id,"gestor"),n),0);return{g,deals,totalVendido,totalComissao,team:teamMembers(g.id)}}).sort((a,b)=>b.totalVendido-a.totalVendido);
  return`<div class="panel commissions-panel">
    <div class="commissions-toolbar"><select id="commissions-period">${commissionPeriodOptions(commissionsPeriod)}</select></div>
    <div class="table-scroll"><table><thead><tr><th>Gestor</th><th>Vendedores</th><th>Vendas da equipe</th><th>Valor vendido</th><th>Comissão do gestor</th><th></th></tr></thead>
    <tbody>${rows.length?rows.map(r=>`<tr><td><strong>${esc(r.g.nome)}</strong></td><td>${r.team.length}</td><td>${r.deals.length}</td><td>${money(r.totalVendido)}</td><td>${money(r.totalComissao)}</td><td><button type="button" class="text-btn" data-commission-manager="${esc(r.g.id)}">Ver vendas →</button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty">Nenhum gestor encontrado.</div></td></tr>`}</tbody></table></div>
  </div>`;
}
function loadCommissionGoals(){
  const row=(STATE.configuracoes||[]).find(c=>c.chave==="metasComerciais");
  try{const parsed=row?.valor?JSON.parse(row.valor):null;return{vendedores:parsed?.vendedores||{},equipes:parsed?.equipes||{}}}catch(e){return{vendedores:{},equipes:{}}}
}
async function saveCommissionGoals(goals){
  const current=(STATE.configuracoes||[]).find(c=>c.chave==="metasComerciais");
  const data={id:current?.id||"metasComerciais",chave:"metasComerciais",valor:JSON.stringify(goals)};
  if(current){const updated=await API.update(CONFIG.SHEETS.CONFIGURACOES,current.id,data);const i=STATE.configuracoes.findIndex(c=>String(c.id)===String(current.id));if(i>=0)STATE.configuracoes[i]=updated;}
  else{const created=await API.create(CONFIG.SHEETS.CONFIGURACOES,data);STATE.configuracoes.push(created);}
}
async function updateCommissionGoal(kind,id,value){
  const goals=loadCommissionGoals();goals[kind]=goals[kind]||{};
  const v=Math.max(0,Number(value||0));
  if(v>0)goals[kind][id]=v;else delete goals[kind][id];
  try{await saveCommissionGoals(goals);if(currentView==="comissoes")renderCommissions();toast("Meta atualizada.")}
  catch(e){toast(e.message||"Não foi possível salvar a meta.","error")}
}
function goalProgressBar(total,meta){
  if(!meta)return"";
  const pct=Math.min(100,total/meta*100);
  return `<div class="commission-goal-bar"><div class="commission-goal-bar-fill" style="width:${pct.toFixed(0)}%"></div></div><small>${pct.toFixed(0)}% da meta de ${money(meta)}</small>`;
}
function leadToCloseDays(n){
  const c=clientById(n.clienteId);
  if(!c?.criadoEm)return null;
  const start=new Date(c.criadoEm);
  const end=new Date(n.atualizadoEm||n.previsaoFechamento||n.previsao||n.criadoEm);
  if(isNaN(start)||isNaN(end))return null;
  const days=(end-start)/86400000;
  return days>=0?days:null;
}
function dealOriginMatches(n){if(!commissionsOriginFilter)return true;return (clientById(n.clienteId)?.origem||"")===commissionsOriginFilter}
function dealProductMatches(n){if(!commissionsProductFilter)return true;return (n.produtoServico||"")===commissionsProductFilter}
function commissionOriginOptions(selected){
  const set=new Set(STATE.clientes.map(c=>c.origem).filter(Boolean));
  return `<option value="">Todas as origens</option>`+[...set].sort().map(o=>`<option value="${esc(o)}" ${o===selected?"selected":""}>${esc(o)}</option>`).join("");
}
function commissionProductOptions(selected){
  const set=new Set(STATE.negociacoes.filter(n=>n.etapa==="fechado").map(n=>n.produtoServico).filter(Boolean));
  return `<option value="">Todos os produtos/serviços</option>`+[...set].sort().map(p=>`<option value="${esc(p)}" ${p===selected?"selected":""}>${esc(p)}</option>`).join("");
}
function computeSellerMetrics(u,period){
  let deals=sellerClosedDeals(u.id);
  deals=filterDealsByPeriod(deals,period).filter(dealOriginMatches).filter(dealProductMatches);
  const total=deals.reduce((a,n)=>a+Number(n.valor||0),0);
  const ticket=deals.length?total/deals.length:0;
  const tempos=deals.map(leadToCloseDays).filter(d=>d!=null);
  const tempoMedio=tempos.length?tempos.reduce((a,b)=>a+b,0)/tempos.length:null;
  return{u,deals,total,ticket,tempoMedio,conv:conversionForSeller(u.id,period)};
}
function csvEscape(v){v=String(v??"");return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function exportCommissionsCsv(rows,period){
  const goals=loadCommissionGoals();
  const header=["Vendedor","Equipe","Vendas","Valor vendido","Ticket médio","Conversão (%)","Tempo médio de fechamento (dias)","Meta"];
  const lines=[header.join(";")];
  rows.forEach(r=>{const meta=goals.vendedores?.[r.u.id]||"";lines.push([r.u.nome,gestorNome(r.u.gestorId),r.deals.length,r.total.toFixed(2).replace(".",","),r.ticket.toFixed(2).replace(".",","),r.conv.rate.toFixed(0),r.tempoMedio!=null?r.tempoMedio.toFixed(1).replace(".",","):"",meta].map(csvEscape).join(";"))});
  const blob=new Blob(["\uFEFF"+lines.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`comissoes_ranking_${period||"todos-periodos"}.csv`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportCommissionsPdf(rows,period){
  const w=window.open("","_blank");
  if(!w){toast("O navegador bloqueou a janela de impressão.","error");return}
  const label=esc(reportMonthLabel(period)||"Todos os períodos");
  const html=`<html><head><title>Ranking de comissões — ${label}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#222}h2{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:12px}th{background:#F1EEFF}</style></head><body>
    <h2>Ranking de vendedores</h2><p>${label}</p>
    <table><thead><tr><th>Vendedor</th><th>Equipe</th><th>Vendas</th><th>Valor vendido</th><th>Ticket médio</th><th>Conversão</th><th>Tempo médio de fechamento</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.u.nome)}</td><td>${esc(gestorNome(r.u.gestorId))}</td><td>${r.deals.length}</td><td>${money(r.total)}</td><td>${money(r.ticket)}</td><td>${r.conv.rate.toFixed(0)}%</td><td>${r.tempoMedio!=null?r.tempoMedio.toFixed(1)+" dias":"—"}</td></tr>`).join("")}</tbody></table>
  </body></html>`;
  w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),300);
}
function commissionsComparisonMarkup(period,sellers){
  if(!period)return `<div class="panel report-panel commission-conversion-panel"><div class="panel-head"><div><h2>Comparativo com o período anterior</h2><p>Selecione um mês específico no filtro de período para comparar.</p></div></div></div>`;
  const prev=previousMonthKey(period);
  const rows=sellers.map(u=>{const cur=sellerSoldInPeriod(u.id,period),ant=sellerSoldInPeriod(u.id,prev);const growth=ant>0?((cur-ant)/ant*100):(cur>0?100:0);return{u,cur,ant,growth}}).filter(r=>r.cur>0||r.ant>0).sort((a,b)=>b.cur-a.cur);
  return `<div class="panel report-panel commission-conversion-panel">
    <div class="panel-head"><div><h2>Comparativo com o período anterior</h2><p>${esc(reportMonthLabel(period))} vs. ${esc(reportMonthLabel(prev))}</p></div></div>
    <div class="table-scroll"><table><thead><tr><th>Vendedor</th><th>${esc(reportMonthLabel(period))}</th><th>${esc(reportMonthLabel(prev))}</th><th>Crescimento</th></tr></thead>
    <tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.u.nome)}</td><td>${money(r.cur)}</td><td>${money(r.ant)}</td><td class="${r.growth>=0?"commission-growth-up":"commission-growth-down"}">${r.growth>=0?"+":""}${r.growth.toFixed(0)}%</td></tr>`).join(""):`<tr><td colspan="4"><div class="empty">Sem vendas para comparar.</div></td></tr>`}</tbody></table></div>
  </div>`;
}
function commissionsPerformanceMarkup(){
  const period=commissionsPeriod,team=commissionsTeamFilter;
  const goals=loadCommissionGoals();
  const sellers=allSellers().filter(u=>!team||String(u.gestorId||"")===team);
  const ranking=sellers.map(u=>computeSellerMetrics(u,period)).sort((a,b)=>b.total-a.total);
  lastCommissionsRanking=ranking;
  const teamsRanking=allManagers().map(g=>{const deals=filterDealsByPeriod(managerClosedDeals(g.id),period).filter(dealOriginMatches).filter(dealProductMatches);const total=deals.reduce((a,n)=>a+Number(n.valor||0),0);return{g,total,deals,count:teamMembers(g.id).length,ticket:deals.length?total/deals.length:0}}).sort((a,b)=>b.total-a.total);
  const top=ranking[0];
  const prevPeriod=period?previousMonthKey(period):"";
  const trending=[...sellers].map(u=>{const cur=sellerSoldInPeriod(u.id,period),prev=prevPeriod?sellerSoldInPeriod(u.id,prevPeriod):0;const growth=prev>0?((cur-prev)/prev*100):(cur>0?100:0);return{u,cur,prev,growth}}).filter(x=>x.cur>0).sort((a,b)=>b.growth-a.growth)[0];
  const totalVendidoGeral=ranking.reduce((a,r)=>a+r.total,0),totalVendasGeral=ranking.reduce((a,r)=>a+r.deals.length,0);
  return`<div class="commissions-toolbar">
    <select id="commissions-period">${commissionPeriodOptions(period)}</select>
    <select id="commissions-team-filter">${commissionTeamOptions(team)}</select>
    <select id="commissions-origin-filter">${commissionOriginOptions(commissionsOriginFilter)}</select>
    <select id="commissions-product-filter">${commissionProductOptions(commissionsProductFilter)}</select>
    <button type="button" class="text-btn" id="commissions-export-csv">Exportar CSV</button>
    <button type="button" class="text-btn" id="commissions-export-pdf">Exportar PDF</button>
  </div>
  <div class="report-summary">
    ${reportCard("Vendedor do mês",top?top.u.nome:"—",top?`${money(top.total)} em vendas`:"Sem vendas no período")}
    ${reportCard("Em destaque",trending?trending.u.nome:"—",trending?`${trending.growth>=0?"+":""}${trending.growth.toFixed(0)}% vs. período anterior`:"Sem dados suficientes")}
    ${reportCard("Equipe líder",teamsRanking[0]&&teamsRanking[0].total>0?teamsRanking[0].g.nome:"—",teamsRanking[0]&&teamsRanking[0].total>0?money(teamsRanking[0].total):"Sem vendas no período")}
    ${reportCard("Total vendido",money(totalVendidoGeral),`${totalVendasGeral} venda${totalVendasGeral===1?"":"s"} no período`)}
  </div>
  <div class="panel report-panel">
    <div class="panel-head"><div><h2>Desempenho por vendedor</h2><p>Vendas, ticket médio, tempo de fechamento, conversão e meta no período filtrado.</p></div></div>
    <div class="table-scroll"><table><thead><tr><th>#</th><th>Vendedor</th><th>Equipe</th><th>Vendas</th><th>Valor vendido</th><th>Ticket médio</th><th>Tempo médio fechamento</th><th>Conversão</th><th>Meta do período</th></tr></thead>
    <tbody>${ranking.length?ranking.map((r,i)=>`<tr><td>${i+1}º</td><td><strong>${esc(r.u.nome)}</strong></td><td>${esc(gestorNome(r.u.gestorId))}</td><td>${r.deals.length}</td><td>${money(r.total)}</td><td>${money(r.ticket)}</td><td>${r.tempoMedio!=null?r.tempoMedio.toFixed(1)+" dias":"—"}</td><td>${r.conv.rate.toFixed(0)}%</td><td class="commission-goal-cell"><input type="number" min="0" step="100" class="commission-goal-input" placeholder="Definir meta" value="${goals.vendedores?.[r.u.id]||""}" data-goal-kind="vendedores" data-goal-id="${esc(r.u.id)}">${goalProgressBar(r.total,goals.vendedores?.[r.u.id])}</td></tr>`).join(""):`<tr><td colspan="9"><div class="empty">Sem vendas no período.</div></td></tr>`}</tbody></table></div>
  </div>
  <div class="panel report-panel">
    <div class="panel-head"><div><h2>Desempenho por equipe</h2><p>Soma das vendas fechadas por equipe (gestor), com meta própria.</p></div></div>
    <div class="table-scroll"><table><thead><tr><th>#</th><th>Gestor</th><th>Vendedores</th><th>Vendas</th><th>Valor vendido</th><th>Ticket médio</th><th>Meta do período</th></tr></thead>
    <tbody>${teamsRanking.length?teamsRanking.map((r,i)=>`<tr><td>${i+1}º</td><td><strong>${esc(r.g.nome)}</strong></td><td>${r.count}</td><td>${r.deals.length}</td><td>${money(r.total)}</td><td>${money(r.ticket)}</td><td class="commission-goal-cell"><input type="number" min="0" step="100" class="commission-goal-input" placeholder="Definir meta" value="${goals.equipes?.[r.g.id]||""}" data-goal-kind="equipes" data-goal-id="${esc(r.g.id)}">${goalProgressBar(r.total,goals.equipes?.[r.g.id])}</td></tr>`).join(""):`<tr><td colspan="7"><div class="empty">Nenhuma equipe com vendas no período.</div></td></tr>`}</tbody></table></div>
  </div>
  ${commissionsComparisonMarkup(period,sellers)}
  <div class="panel report-panel commission-conversion-panel">
    <div class="panel-head"><div><h2>Taxa de conversão (reunião → fechamento)</h2><p>Leads que o vendedor levou a uma reunião e quantos desses viraram venda.</p></div></div>
    <div class="table-scroll"><table><thead><tr><th>Vendedor</th><th>Levados a reunião</th><th>Fechados</th><th>Conversão</th></tr></thead>
    <tbody>${ranking.length?ranking.map(r=>`<tr><td>${esc(r.u.nome)}</td><td>${r.conv.meetings}</td><td>${r.conv.closed}</td><td>${r.conv.rate.toFixed(0)}%</td></tr>`).join(""):`<tr><td colspan="4"><div class="empty">Sem dados de reuniões no período.</div></td></tr>`}</tbody></table></div>
  </div>`;
}
function bindCommissionsEvents(){
  const periodSel=document.getElementById("commissions-period");if(periodSel){periodSel.value=commissionsPeriod;periodSel.onchange=()=>{commissionsPeriod=periodSel.value;renderCommissions()}}
  const teamSel=document.getElementById("commissions-team-filter");if(teamSel){teamSel.value=commissionsTeamFilter;teamSel.onchange=()=>{commissionsTeamFilter=teamSel.value;renderCommissions()}}
  const originSel=document.getElementById("commissions-origin-filter");if(originSel){originSel.value=commissionsOriginFilter;originSel.onchange=()=>{commissionsOriginFilter=originSel.value;renderCommissions()}}
  const productSel=document.getElementById("commissions-product-filter");if(productSel){productSel.value=commissionsProductFilter;productSel.onchange=()=>{commissionsProductFilter=productSel.value;renderCommissions()}}
  const csvBtn=document.getElementById("commissions-export-csv");if(csvBtn)csvBtn.onclick=()=>exportCommissionsCsv(lastCommissionsRanking,commissionsPeriod);
  const pdfBtn=document.getElementById("commissions-export-pdf");if(pdfBtn)pdfBtn.onclick=()=>exportCommissionsPdf(lastCommissionsRanking,commissionsPeriod);
  document.querySelectorAll(".commission-goal-input").forEach(inp=>inp.onchange=()=>updateCommissionGoal(inp.dataset.goalKind,inp.dataset.goalId,inp.value));
  document.querySelectorAll("[data-commission-seller]").forEach(b=>b.onclick=()=>openCommissionDetail(b.dataset.commissionSeller,"vendedor"));
  document.querySelectorAll("[data-commission-manager]").forEach(b=>b.onclick=()=>openCommissionDetail(b.dataset.commissionManager,"gestor"));
  document.querySelectorAll("[data-commission-seller-segundo]").forEach(b=>b.onclick=()=>openCommissionDetail(b.dataset.commissionSellerSegundo,"segundo_responsavel"));
}
function openCommissionDetail(userId,papel){commissionsDetailContext={userId,papel};commissionsDetailPeriod=currentMonthKey();renderCommissionDetail();document.getElementById("commission-detail-modal").showModal()}
function renderCommissionDetail(){
  if(!commissionsDetailContext)return;
  const{userId,papel}=commissionsDetailContext,user=userById(userId);
  const allDeals=papel==="vendedor"?sellerClosedDeals(userId):papel==="gestor"?managerClosedDeals(userId):sellerSecondResponsavelDeals(userId);
  const deals=filterDealsByPeriod(allDeals,commissionsDetailPeriod).sort((a,b)=>String(reportDealDate(b)||"").localeCompare(String(reportDealDate(a)||"")));
  const totalVendido=deals.reduce((a,n)=>a+Number(n.valor||0),0),totalComissao=deals.reduce((a,n)=>a+commissionValue(commissionRow(n.id,papel),n),0);
  const isGestor=papel==="gestor",isSegundo=papel==="segundo_responsavel",showOwnerCol=isGestor||isSegundo;
  document.getElementById("commission-detail-title").innerHTML=`<p class="eyebrow">${isGestor?"Vendas da equipe":isSegundo?"Vendas como segundo responsável":"Vendas do vendedor"}</p><h3>${esc(user?.nome||"—")}</h3>`;
  document.getElementById("commission-detail-body").innerHTML=`
    <div class="commissions-toolbar"><select id="commission-detail-period">${commissionPeriodOptions(commissionsDetailPeriod)}</select></div>
    <div class="table-scroll"><table class="commission-table"><thead><tr><th>Cliente</th>${showOwnerCol?"<th>Primeiro responsável</th>":""}<th>Produto/serviço</th><th>Fechamento</th><th>Valor da venda</th><th>%</th><th>Comissão</th><th>Status</th><th>Data pagamento</th><th></th></tr></thead>
    <tbody>${deals.length?deals.map(n=>{const row=commissionRow(n.id,papel),c=clientById(n.clienteId),v=commissionValue(row,n);const vendedorNome=showOwnerCol?esc(userById(resolveUserId(n.responsavel))?.nome||"—"):"";return`<tr><td>${esc(c?.nome||"—")}</td>${showOwnerCol?`<td>${vendedorNome}</td>`:""}<td>${esc(n.produtoServico||"—")}</td><td>${dateBR(reportDealDate(n))}</td><td>${money(n.valor)}</td><td><input type="number" min="0" max="100" step="0.01" class="commission-pct-input" value="${row?.percentual??""}" data-deal-id="${esc(n.id)}"></td><td class="commission-value">${money(v)}</td><td><select class="commission-status-input">${CONFIG.COMMISSION_STATUS.map(s=>`<option value="${s}" ${row?.status===s?"selected":""}>${esc(commissionStatusLabel(s))}</option>`).join("")}</select></td><td><input type="date" class="commission-date-input" value="${row?.dataPagamento||""}"></td><td><button type="button" class="text-btn commission-save-btn" data-commission-id="${esc(row?.id||"")}">Salvar</button></td></tr>`}).join(""):`<tr><td colspan="${showOwnerCol?10:9}"><div class="empty">Nenhuma venda fechada neste período.</div></td></tr>`}</tbody>
    ${deals.length?`<tfoot><tr class="commission-total-row"><td colspan="${showOwnerCol?4:3}">Total geral</td><td>${money(totalVendido)}</td><td></td><td>${money(totalComissao)}</td><td colspan="3"></td></tr></tfoot>`:""}
    </table></div>`;
  bindCommissionDetailEvents();
}
async function saveCommissionField(commissionId,patch){
  if(!commissionId)return;
  try{const updated=await API.update(CONFIG.SHEETS.COMISSOES,commissionId,{...patch,atualizadoEm:new Date().toISOString()});const i=STATE.comissoes.findIndex(c=>String(c.id)===String(commissionId));if(i>=0)STATE.comissoes[i]={...STATE.comissoes[i],...updated};renderCommissionDetail();if(currentView==="comissoes")renderCommissions();toast("Comissão salva.")}
  catch(e){toast(e.message||"Não foi possível salvar a comissão.","error")}
}
function bindCommissionDetailEvents(){
  const periodSel=document.getElementById("commission-detail-period");if(periodSel){periodSel.value=commissionsDetailPeriod;periodSel.onchange=()=>{commissionsDetailPeriod=periodSel.value;renderCommissionDetail()}}
  document.querySelectorAll(".commission-pct-input").forEach(inp=>{
    inp.oninput=()=>{const tr=inp.closest("tr");const n=STATE.negociacoes.find(x=>String(x.id)===String(inp.dataset.dealId));const pct=Math.max(0,Math.min(100,Number(inp.value||0)));const cell=tr?.querySelector(".commission-value");if(cell)cell.textContent=money(Number(n?.valor||0)*pct/100)};
  });
  document.querySelectorAll(".commission-save-btn").forEach(btn=>{
    btn.onclick=()=>withButtonLoading(btn,async()=>{
      const tr=btn.closest("tr");
      const pctInput=tr.querySelector(".commission-pct-input"),statusInput=tr.querySelector(".commission-status-input"),dateInput=tr.querySelector(".commission-date-input");
      const n=STATE.negociacoes.find(x=>String(x.id)===String(pctInput.dataset.dealId));
      const pct=Math.max(0,Math.min(100,Number(pctInput.value||0)));
      await saveCommissionField(btn.dataset.commissionId,{percentual:pct,valorComissao:Number(n?.valor||0)*pct/100,status:statusInput.value,dataPagamento:dateInput.value});
    });
  });
}


/* =========================================================
   CATÁLOGO DE PRODUTOS/SERVIÇOS
   ========================================================= */
function renderProducts(){
  const items=[...(STATE.produtos||[])].sort((a,b)=>String(a.nome||"").localeCompare(String(b.nome||"")));
  const isAdmin=SESSION?.perfil==="Administrador";
  document.getElementById("products-body").innerHTML=`
    <div class="commissions-toolbar">${isAdmin?`<button type="button" class="btn btn-primary" id="product-new-btn">+ Novo produto/serviço</button>`:""}</div>
    <div class="panel">
      <div class="table-scroll"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Preço padrão</th><th>Status</th>${isAdmin?"<th></th>":""}</tr></thead>
      <tbody>${items.length?items.map(p=>`<tr><td><strong>${esc(p.nome)}</strong></td><td>${esc(p.categoria||"—")}</td><td>${p.precoPadrao?money(p.precoPadrao):"—"}</td><td>${p.ativo!==false?"Ativo":"Inativo"}</td>${isAdmin?`<td><button type="button" class="text-btn" data-product-edit="${esc(p.id)}">Editar</button></td>`:""}</tr>`).join(""):`<tr><td colspan="${isAdmin?5:4}"><div class="empty">Nenhum produto/serviço cadastrado ainda. ${isAdmin?"Clique em \"+ Novo produto/serviço\" para começar.":""}</div></td></tr>`}</tbody></table></div>
    </div>`;
  const nb=document.getElementById("product-new-btn");if(nb)nb.onclick=()=>openProductModal();
  document.querySelectorAll("[data-product-edit]").forEach(b=>b.onclick=()=>openProductModal(b.dataset.productEdit));
}
function openProductModal(id=""){
  const p=id?(STATE.produtos||[]).find(x=>String(x.id)===String(id)):null;
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value=p?.id||"";
  document.getElementById("product-modal-title").textContent=p?"Editar produto/serviço":"Novo produto/serviço";
  document.getElementById("product-name").value=p?.nome||"";
  document.getElementById("product-category").value=p?.categoria||"";
  document.getElementById("product-price").value=p?.precoPadrao??"";
  document.getElementById("product-active").checked=p?.ativo!==false;
  document.getElementById("product-delete").classList.toggle("hidden",!p);
  document.getElementById("product-modal").showModal();
}
async function saveProduct(e){
  e.preventDefault();
  const id=val("product-id");
  const data={nome:val("product-name").trim(),categoria:val("product-category").trim(),precoPadrao:val("product-price")?Number(val("product-price")):null,ativo:document.getElementById("product-active").checked};
  if(!data.nome){toast("Informe o nome do produto/serviço.","error");return}
  const btn=submitButtonOf(e);
  await withButtonLoading(btn,async()=>{
    try{
      if(id){const updated=await API.update(CONFIG.SHEETS.PRODUTOS,id,data);const i=STATE.produtos.findIndex(x=>String(x.id)===String(id));if(i>=0)STATE.produtos[i]=updated}
      else{const created=await API.create(CONFIG.SHEETS.PRODUTOS,data);STATE.produtos.push(created)}
      document.getElementById("product-modal").close();renderProducts();toast(id?"Produto/serviço atualizado.":"Produto/serviço cadastrado.");
    }catch(e){toast(e.message||"Não foi possível salvar.","error")}
  });
}
async function deleteProduct(){
  const id=val("product-id");const p=(STATE.produtos||[]).find(x=>String(x.id)===String(id));
  if(!p||!confirm(`Excluir "${p.nome}" do catálogo?`))return;
  const btn=document.getElementById("product-delete");
  await withButtonLoading(btn,async()=>{
    try{await API.remove(CONFIG.SHEETS.PRODUTOS,id);STATE.produtos=STATE.produtos.filter(x=>String(x.id)!==String(id));document.getElementById("product-modal").close();renderProducts();toast("Produto/serviço excluído.")}catch(e){toast(e.message||"Não foi possível excluir.","error")}
  });
}

/* =========================================================
   FINANCEIRO / FATURAMENTO
   ========================================================= */
let financePeriod=currentMonthKey();
let financeStatusFilter="";
function invoiceStatusLabel(v){return CONFIG.INVOICE_STATUS_LABELS?.[v]||v||"—"}
function financePeriodOptions(selected){
  const set=new Set((STATE.faturas||[]).map(f=>reportMonthKey(f.dataEmissao||f.criadoEm)).filter(Boolean));
  set.add(currentMonthKey());
  const keys=[...set].sort().reverse();
  return `<option value="">Todos os períodos</option>`+keys.map(k=>`<option value="${k}" ${k===selected?"selected":""}>${esc(reportMonthLabel(k))}</option>`).join("");
}
function financeFilteredInvoices(){
  let rows=[...(STATE.faturas||[])];
  if(financePeriod)rows=rows.filter(f=>reportMonthKey(f.dataEmissao||f.criadoEm)===financePeriod);
  if(financeStatusFilter)rows=rows.filter(f=>f.status===financeStatusFilter);
  return rows.sort((a,b)=>String(b.dataEmissao||b.criadoEm||"").localeCompare(String(a.dataEmissao||a.criadoEm||"")));
}
function financeCashflowMarkup(){
  const map={};
  (STATE.faturas||[]).forEach(f=>{const k=reportMonthKey(f.dataEmissao||f.criadoEm);if(!k)return;map[k]=map[k]||{faturado:0,recebido:0};map[k].faturado+=Number(f.valor||0);map[k].recebido+=Number(f.valorPago||0)});
  const rows=Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);
  return `<table><thead><tr><th>Mês</th><th>Faturado</th><th>Recebido</th></tr></thead><tbody>${rows.length?rows.map(([k,v])=>`<tr><td>${esc(reportMonthLabel(k))}</td><td>${money(v.faturado)}</td><td>${money(v.recebido)}</td></tr>`).join(""):`<tr><td colspan="3"><div class="empty">Sem faturas registradas.</div></td></tr>`}</tbody></table>`;
}
function renderFinance(){
  const rows=financeFilteredInvoices();
  const faturado=rows.reduce((a,f)=>a+Number(f.valor||0),0);
  const recebido=rows.reduce((a,f)=>a+Number(f.valorPago||0),0);
  const emAberto=rows.filter(f=>!["pago","cancelado"].includes(f.status)).reduce((a,f)=>a+Math.max(0,Number(f.valor||0)-Number(f.valorPago||0)),0);
  document.getElementById("finance-body").innerHTML=`
    <div class="commissions-toolbar">
      <select id="finance-period">${financePeriodOptions(financePeriod)}</select>
      <select id="finance-status"><option value="">Todos os status</option>${CONFIG.INVOICE_STATUS.map(s=>`<option value="${s}" ${s===financeStatusFilter?"selected":""}>${esc(invoiceStatusLabel(s))}</option>`).join("")}</select>
      <button type="button" class="btn btn-primary" id="finance-new-btn">+ Nova fatura</button>
    </div>
    <div class="report-summary">
      ${reportCard("Faturado no período",money(faturado),`${rows.length} fatura${rows.length===1?"":"s"}`)}
      ${reportCard("Recebido no período",money(recebido),faturado?`${(recebido/faturado*100).toFixed(0)}% do faturado`:"—")}
      ${reportCard("Em aberto",money(emAberto),"Ainda não recebido")}
    </div>
    <div class="panel">
      <div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Número</th><th>Valor</th><th>Pago</th><th>Status</th><th>Vencimento</th><th></th></tr></thead>
      <tbody>${rows.length?rows.map(f=>`<tr><td>${esc(clientById(f.clienteId)?.nome||"—")}</td><td>${esc(f.numero||"—")}</td><td>${money(f.valor)}</td><td>${money(f.valorPago)}</td><td>${esc(invoiceStatusLabel(f.status))}</td><td>${dateBR(f.dataVencimento)}</td><td><button type="button" class="text-btn" data-invoice-edit="${esc(f.id)}">Editar</button></td></tr>`).join(""):`<tr><td colspan="7"><div class="empty">Nenhuma fatura no período.</div></td></tr>`}</tbody></table></div>
    </div>
    <div class="panel report-panel">
      <div class="panel-head"><div><h2>Fluxo de caixa (últimos meses)</h2><p>Faturado vs. recebido por mês, com base na data de emissão.</p></div></div>
      <div class="table-scroll">${financeCashflowMarkup()}</div>
    </div>`;
  bindFinanceEvents();
}
function bindFinanceEvents(){
  const p=document.getElementById("finance-period");if(p){p.value=financePeriod;p.onchange=()=>{financePeriod=p.value;renderFinance()}}
  const s=document.getElementById("finance-status");if(s){s.value=financeStatusFilter;s.onchange=()=>{financeStatusFilter=s.value;renderFinance()}}
  const nb=document.getElementById("finance-new-btn");if(nb)nb.onclick=()=>openInvoiceModal();
  document.querySelectorAll("[data-invoice-edit]").forEach(b=>b.onclick=()=>openInvoiceModal(b.dataset.invoiceEdit));
}
function fillInvoiceDealOptions(clienteId,selected=""){
  const deals=STATE.negociacoes.filter(n=>String(n.clienteId)===String(clienteId));
  document.getElementById("invoice-deal").innerHTML=`<option value="">Sem negociação vinculada</option>`+deals.map(n=>`<option value="${esc(n.id)}">${esc(n.produtoServico||"Negociação")} · ${money(n.valor)}</option>`).join("");
  if(selected)document.getElementById("invoice-deal").value=selected;
}
function openInvoiceModal(id=""){
  const f=id?(STATE.faturas||[]).find(x=>String(x.id)===String(id)):null;
  document.getElementById("invoice-form").reset();
  document.getElementById("invoice-id").value=f?.id||"";
  document.getElementById("invoice-modal-title").textContent=f?"Editar fatura":"Nova fatura";
  document.getElementById("invoice-client").innerHTML=STATE.clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  document.getElementById("invoice-client").value=f?.clienteId||STATE.clientes[0]?.id||"";
  fillInvoiceDealOptions(document.getElementById("invoice-client").value,f?.negociacaoId||"");
  document.getElementById("invoice-client").onchange=()=>fillInvoiceDealOptions(document.getElementById("invoice-client").value);
  document.getElementById("invoice-number").value=f?.numero||"";
  document.getElementById("invoice-value").value=f?.valor??"";
  document.getElementById("invoice-paid").value=f?.valorPago??0;
  document.getElementById("invoice-status").innerHTML=CONFIG.INVOICE_STATUS.map(s=>`<option value="${s}" ${f?.status===s?"selected":""}>${esc(invoiceStatusLabel(s))}</option>`).join("");
  document.getElementById("invoice-payment-method").value=f?.formaPagamento||"";
  document.getElementById("invoice-due").value=f?.dataVencimento||"";
  document.getElementById("invoice-paid-date").value=f?.dataPagamento||"";
  document.getElementById("invoice-notes").value=f?.observacoes||"";
  document.getElementById("invoice-delete").classList.toggle("hidden",!f||SESSION?.perfil!=="Administrador");
  document.getElementById("invoice-modal").showModal();
}
async function saveInvoice(e){
  e.preventDefault();
  const id=val("invoice-id");
  const data={clienteId:val("invoice-client"),negociacaoId:val("invoice-deal")||null,numero:val("invoice-number").trim(),valor:Number(val("invoice-value")||0),valorPago:Number(val("invoice-paid")||0),status:val("invoice-status")||"em_aberto",formaPagamento:val("invoice-payment-method").trim(),dataVencimento:val("invoice-due"),dataPagamento:val("invoice-paid-date"),observacoes:val("invoice-notes").trim(),atualizadoEm:new Date().toISOString()};
  if(!data.clienteId||!data.valor){toast("Informe o cliente e o valor da fatura.","error");return}
  if(!id){data.dataEmissao=new Date().toISOString().slice(0,10);data.criadoEm=new Date().toISOString();data.numero=data.numero||`FAT-${Date.now().toString().slice(-6)}`}
  const btn=submitButtonOf(e);
  await withButtonLoading(btn,async()=>{
    try{
      if(id){const updated=await API.update(CONFIG.SHEETS.FATURAS,id,data);const i=STATE.faturas.findIndex(x=>String(x.id)===String(id));if(i>=0)STATE.faturas[i]=updated}
      else{const created=await API.create(CONFIG.SHEETS.FATURAS,data);STATE.faturas.push(created)}
      document.getElementById("invoice-modal").close();renderFinance();toast(id?"Fatura atualizada.":"Fatura criada.");
    }catch(e){toast(e.message||"Não foi possível salvar a fatura.","error")}
  });
}
async function deleteInvoice(){
  const id=val("invoice-id");if(!id||!confirm("Excluir esta fatura?"))return;
  const btn=document.getElementById("invoice-delete");
  await withButtonLoading(btn,async()=>{
    try{await API.remove(CONFIG.SHEETS.FATURAS,id);STATE.faturas=STATE.faturas.filter(x=>String(x.id)!==String(id));document.getElementById("invoice-modal").close();renderFinance();toast("Fatura excluída.")}catch(e){toast(e.message||"Não foi possível excluir.","error")}
  });
}

/* =========================================================
   SATISFAÇÃO / NPS
   ========================================================= */
function renderSatisfaction(){
  const rows=[...(STATE.pesquisas||[])].sort((a,b)=>String(b.criadoEm||"").localeCompare(String(a.criadoEm||"")));
  const respondidas=rows.filter(r=>r.status==="respondida"&&r.nota!=null&&r.nota!=="");
  const media=respondidas.length?respondidas.reduce((a,r)=>a+Number(r.nota||0),0)/respondidas.length:null;
  document.getElementById("satisfaction-body").innerHTML=`
    <div class="commissions-toolbar"><button type="button" class="btn btn-primary" id="satisfaction-new-btn">+ Registrar resposta</button></div>
    <div class="report-summary">
      ${reportCard("Nota média",media!=null?media.toFixed(1):"—","de 0 a 10")}
      ${reportCard("Respondidas",respondidas.length,`${rows.length} no total`)}
      ${reportCard("Pendentes",rows.filter(r=>r.status==="pendente").length,"aguardando resposta")}
    </div>
    <div class="panel">
      <div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Nota</th><th>Comentário</th><th>Status</th><th>Data</th></tr></thead>
      <tbody>${rows.length?rows.map(r=>`<tr><td>${esc(clientById(r.clienteId)?.nome||"—")}</td><td>${r.nota!=null&&r.nota!==""?r.nota:"—"}</td><td>${esc(r.comentario||"—")}</td><td>${r.status==="respondida"?"Respondida":"Pendente"}</td><td>${dateBR(String(r.criadoEm||"").slice(0,10))}</td></tr>`).join(""):`<tr><td colspan="5"><div class="empty">Nenhuma pesquisa registrada ainda. Registre manualmente após falar com o cliente.</div></td></tr>`}</tbody></table></div>
    </div>`;
  const nb=document.getElementById("satisfaction-new-btn");if(nb)nb.onclick=()=>openSatisfactionModal();
}
function openSatisfactionModal(){
  document.getElementById("satisfaction-form").reset();
  document.getElementById("satisfaction-client").innerHTML=STATE.clientes.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  document.getElementById("satisfaction-modal").showModal();
}
async function saveSatisfaction(e){
  e.preventDefault();
  const data={clienteId:val("satisfaction-client"),nota:val("satisfaction-score")!==""?Number(val("satisfaction-score")):null,comentario:val("satisfaction-comment").trim(),canalEnvio:"Manual",status:"respondida",criadoEm:new Date().toISOString(),respondidoEm:new Date().toISOString()};
  if(!data.clienteId||data.nota===null){toast("Selecione o cliente e a nota.","error");return}
  const btn=submitButtonOf(e);
  await withButtonLoading(btn,async()=>{
    try{const created=await API.create(CONFIG.SHEETS.PESQUISAS,data);STATE.pesquisas.push(created);document.getElementById("satisfaction-modal").close();renderSatisfaction();toast("Resposta registrada.")}catch(e){toast(e.message||"Não foi possível registrar.","error")}
  });
}
