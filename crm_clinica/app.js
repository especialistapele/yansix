(function(){
 'use strict';
 const SUPABASE_URL='https://zxeupenncextzrqgthqx.supabase.co';
 const SUPABASE_KEY='sb_publishable_WceObQ8ZcYPKPvNPBBvSEg_MMKx5VJ-';
 const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 let clinicId=null, clinicName='', contacts=[], opportunities=[], appointments=[], tasks=[];
 const $=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function setStatus(id,message,type=''){const el=$(id);if(!el)return;el.textContent=message;el.className='status'+(type?' '+type:'')}
 function showAuth(message=''){ $('auth-screen').classList.remove('hidden');$('app-screen').classList.add('hidden');if(message)setStatus('auth-status',message,'error'); }
 function showApp(user){$('auth-screen').classList.add('hidden');$('app-screen').classList.remove('hidden');$('user-email').textContent=user?.email||'Conta autenticada';$('user-avatar').textContent=(user?.email||'Y').slice(0,1).toUpperCase();}
 function fmtDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)}
 function typeLabel(v){return ({lead:'Lead',patient:'Paciente',referrer:'Indicação'})[v]||v||'—'}
 function statusLabel(v){return ({new:'Novo',contacted:'Contatado',qualified:'Qualificado',scheduled:'Agendado',active:'Ativo',inactive:'Inativo',lost:'Perdido',pending:'Pendente',confirmed:'Confirmado',checked_in:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'Falta',rescheduled:'Reagendado',contact:'Contato',evaluation:'Avaliação',proposal:'Proposta',won:'Convertida',lost:'Perdida',in_progress:'Em andamento'})[v]||v||'—'}
 async function loadClinics(user){
  const {data,error}=await sb.from('clinic_crm_members').select('clinic_id,role,clinic_crm_clinics(id,name,segment,active)').eq('user_id',user.id).eq('active',true);
  if(error)throw error;
  const memberships=(data||[]).filter(m=>m.clinic_crm_clinics?.active);
  if(!memberships.length){$('clinic-modal-backdrop').classList.remove('hidden');return false}
  if(memberships.length>1){
   const chosen=prompt('Você possui acesso a mais de uma clínica:\n'+memberships.map((m,i)=>(i+1)+'. '+m.clinic_crm_clinics.name).join('\n')+'\nDigite o número da clínica:');
   const idx=Number(chosen)-1;if(!Number.isInteger(idx)||idx<0||idx>=memberships.length)throw new Error('Seleção de clínica cancelada ou inválida.'); 
   setClinic(memberships[idx].clinic_crm_clinics);return true;
  }
  setClinic(memberships[0].clinic_crm_clinics);return true;
 }
 function setClinic(c){clinicId=c.id;clinicName=c.name;$('clinic-banner').textContent='Clínica ativa: '+c.name+' · '+({medical:'Médica',dental:'Odontológica',mixed:'Médica e odontológica'}[c.segment]||'');}
 async function loadData(){
  if(!clinicId)return;
  const results=await Promise.all([
   sb.from('clinic_crm_contacts').select('id,full_name,contact_type,phone,email,source,status,next_follow_up_at,created_at').eq('clinic_id',clinicId).order('created_at',{ascending:false}).limit(300),
   sb.from('clinic_crm_opportunities').select('id,title,service_label,stage,estimated_value,created_at,contact_id').eq('clinic_id',clinicId).order('created_at',{ascending:false}).limit(300),
   sb.from('clinic_crm_appointments').select('id,contact_id,service_label,starts_at,ends_at,status,professional_id').eq('clinic_id',clinicId).gte('starts_at',new Date().toISOString()).order('starts_at').limit(100),
   sb.from('clinic_crm_tasks').select('id,title,due_at,status,priority,contact_id,appointment_id').eq('clinic_id',clinicId).neq('status','completed').order('due_at',{ascending:true}).limit(200)
  ]);
  const err=results.find(r=>r.error);if(err)throw err.error;
  [contacts,opportunities,appointments,tasks]=results.map(r=>r.data||[]);
  renderDashboard();renderContacts();renderOpportunities();renderAppointments();renderTasks();
 }
 function renderDashboard(){
  $('stat-contacts').textContent=contacts.length;$('stat-new').textContent=contacts.filter(c=>c.status==='new').length;$('stat-opportunities').textContent=opportunities.filter(o=>!['won','lost'].includes(o.stage)).length;$('stat-appointments').textContent=appointments.filter(a=>!['cancelled','no_show'].includes(a.status)).length;
  const rows=contacts.slice(0,6);$('recent-contacts').innerHTML=rows.length?'<table><thead><tr><th>Contato</th><th>Tipo</th><th>Status</th><th>Cadastro</th></tr></thead><tbody>'+rows.map(c=>'<tr><td><div class="person">'+esc(c.full_name)+'</div><div class="subline">'+esc(c.phone||c.email||'Sem telefone/e-mail')+'</div></td><td>'+esc(typeLabel(c.contact_type))+'</td><td><span class="pill">'+esc(statusLabel(c.status))+'</span></td><td>'+esc(fmtDate(c.created_at))+'</td></tr>').join('')+'</tbody></table>':'<div class="empty"><strong>Nenhum contato cadastrado</strong>Adicione o primeiro contato para começar a organizar o relacionamento.</div>';
 }
 function renderContacts(){
  const q=($('contact-search')?.value||'').toLocaleLowerCase('pt-BR'),t=$('contact-filter')?.value||'';
  const list=contacts.filter(c=>(!t||c.contact_type===t)&&[c.full_name,c.phone,c.email,c.source].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)));
  $('contacts-table').innerHTML=list.length?'<table><thead><tr><th>Nome / contato</th><th>Tipo</th><th>Origem</th><th>Status</th><th>Próximo acompanhamento</th></tr></thead><tbody>'+list.map(c=>'<tr><td><div class="person">'+esc(c.full_name)+'</div><div class="subline">'+esc(c.phone||'')+(c.email?' · '+esc(c.email):'')+'</div></td><td>'+esc(typeLabel(c.contact_type))+'</td><td>'+esc(c.source||'—')+'</td><td><span class="pill '+(c.status==='active'?'green':'')+'">'+esc(statusLabel(c.status))+'</span></td><td>'+esc(fmtDate(c.next_follow_up_at))+'</td></tr>').join('')+'</tbody></table>':'<div class="empty"><strong>Nenhum contato encontrado</strong>Altere a busca ou cadastre um novo contato.</div>';
 }
 function contactName(id){return contacts.find(c=>c.id===id)?.full_name||'Contato'}
 const PIPELINE_STAGES=[{key:'new',label:'Novo contato'},{key:'contacted',label:'Em contato'},{key:'evaluation',label:'Avaliação'},{key:'scheduled',label:'Agendado'},{key:'proposal',label:'Proposta'},{key:'won',label:'Convertida'},{key:'lost',label:'Perdida'}];
 let pipelineView='kanban', draggedOpportunityId=null;
 function money(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
 function renderPipelineSummary(){
  const open=opportunities.filter(o=>!['won','lost'].includes(o.stage));
  const total=open.reduce((sum,o)=>sum+Number(o.estimated_value||0),0);
  $('pipeline-summary').innerHTML=[['Oportunidades abertas',open.length],['Valor em aberto',money(total)],['Convertidas',opportunities.filter(o=>o.stage==='won').length],['Perdidas',opportunities.filter(o=>o.stage==='lost').length]].map(([label,value])=>'<div class="pipeline-metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
 }
 function setPipelineView(view){
  pipelineView=view==='table'?'table':'kanban';
  $('opportunities-board').classList.toggle('hidden',pipelineView!=='kanban');
  $('opportunities-table').classList.toggle('hidden',pipelineView!=='table');
  $('kanban-view-button').classList.toggle('secondary',pipelineView!=='kanban');
  $('table-view-button').classList.toggle('secondary',pipelineView!=='table');
  $('kanban-view-button').setAttribute('aria-pressed',String(pipelineView==='kanban'));
  $('table-view-button').setAttribute('aria-pressed',String(pipelineView==='table'));
 }
 function renderOpportunities(){
  renderPipelineSummary();
  $('opportunities-table').innerHTML=opportunities.length?'<table><thead><tr><th>Oportunidade</th><th>Contato</th><th>Etapa</th><th>Valor estimado</th></tr></thead><tbody>'+opportunities.map(o=>'<tr><td><div class="person">'+esc(o.title)+'</div><div class="subline">'+esc(o.service_label||'Serviço não informado')+'</div></td><td>'+esc(contactName(o.contact_id))+'</td><td><span class="pill">'+esc(statusLabel(o.stage))+'</span></td><td>'+money(o.estimated_value)+'</td></tr>').join('')+'</tbody></table>':'<div class="empty"><strong>Nenhuma oportunidade registrada</strong>As oportunidades aparecerão aqui quando forem adicionadas.</div>';
  $('opportunities-board').innerHTML=PIPELINE_STAGES.map(stage=>{
   const items=opportunities.filter(o=>o.stage===stage.key);
   return '<section class="kanban-column" data-stage="'+stage.key+'"><header class="kanban-column-head"><span class="kanban-column-title">'+esc(stage.label)+'</span><span class="kanban-count">'+items.length+'</span></header><div class="kanban-column-body" data-drop-stage="'+stage.key+'">'+(items.length?items.map(o=>'<article class="kanban-card" draggable="true" data-opportunity-id="'+esc(o.id)+'"><div class="kanban-card-title">'+esc(o.title)+'</div><div class="kanban-card-service">'+esc(o.service_label||'Serviço não informado')+'</div><div class="kanban-card-contact">'+esc(contactName(o.contact_id))+'</div><div class="kanban-card-bottom"><span class="kanban-value">'+esc(money(o.estimated_value))+'</span><span class="kanban-date">'+esc(fmtDate(o.created_at))+'</span></div><label class="subline" for="move-'+esc(o.id)+'">Mover para etapa</label><select class="kanban-move" id="move-'+esc(o.id)+'" data-move-opportunity="'+esc(o.id)+'" aria-label="Mover '+esc(o.title)+' para outra etapa">'+PIPELINE_STAGES.map(s=>'<option value="'+s.key+'" '+(s.key===o.stage?'selected':'')+'>'+esc(s.label)+'</option>').join('')+'</select></article>').join(''):'<div class="kanban-empty">Solte uma oportunidade aqui</div>')+'</div></section>';
  }).join('');
  $('opportunities-board').querySelectorAll('[data-opportunity-id]').forEach(card=>{
   card.addEventListener('dragstart',e=>{draggedOpportunityId=card.dataset.opportunityId;card.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedOpportunityId)}});
   card.addEventListener('dragend',()=>{draggedOpportunityId=null;card.classList.remove('dragging');$('opportunities-board').querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'))});
  });
  $('opportunities-board').querySelectorAll('[data-drop-stage]').forEach(target=>{
   target.addEventListener('dragover',e=>{e.preventDefault();target.closest('.kanban-column').classList.add('drop-target');if(e.dataTransfer)e.dataTransfer.dropEffect='move'});
   target.addEventListener('dragleave',e=>{if(!target.contains(e.relatedTarget))target.closest('.kanban-column').classList.remove('drop-target')});
   target.addEventListener('drop',e=>{e.preventDefault();target.closest('.kanban-column').classList.remove('drop-target');const id=e.dataTransfer?.getData('text/plain')||draggedOpportunityId;if(id)moveOpportunity(id,target.dataset.dropStage)});
  });
  $('opportunities-board').querySelectorAll('[data-move-opportunity]').forEach(select=>select.addEventListener('change',()=>moveOpportunity(select.dataset.moveOpportunity,select.value)));
  setPipelineView(pipelineView);
 }
 async function moveOpportunity(id,nextStage){
  const opportunity=opportunities.find(o=>o.id===id);if(!opportunity||opportunity.stage===nextStage)return;
  const previousStage=opportunity.stage;opportunity.stage=nextStage;renderOpportunities();setStatus('pipeline-status','Salvando alteração da etapa…');
  try{
   const {error}=await sb.from('clinic_crm_opportunities').update({stage:nextStage}).eq('id',id).eq('clinic_id',clinicId);
   if(error)throw error;
   setStatus('pipeline-status','Oportunidade movida para '+(PIPELINE_STAGES.find(s=>s.key===nextStage)?.label||nextStage)+'.','success');
  }catch(err){
   opportunity.stage=previousStage;renderOpportunities();setStatus('pipeline-status','Não foi possível mover a oportunidade. Confira as permissões e tente novamente. '+(err.message||''),'error');
  }
 }
 function renderAppointments(){$('appointments-table').innerHTML=appointments.length?'<table><thead><tr><th>Data e hora</th><th>Contato</th><th>Serviço</th><th>Status</th></tr></thead><tbody>'+appointments.map(a=>'<tr><td>'+esc(fmtDate(a.starts_at))+'</td><td>'+esc(contactName(a.contact_id))+'</td><td>'+esc(a.service_label||'—')+'</td><td><span class="pill">'+esc(statusLabel(a.status))+'</span></td></tr>').join('')+'</tbody></table>':'<div class="empty"><strong>Nenhum agendamento futuro</strong>Agendamentos registrados pela clínica serão exibidos aqui.</div>'}
 function renderTasks(){$('tasks-table').innerHTML=tasks.length?'<table><thead><tr><th>Tarefa</th><th>Contato</th><th>Prazo</th><th>Prioridade</th><th>Status</th></tr></thead><tbody>'+tasks.map(t=>'<tr><td><div class="person">'+esc(t.title)+'</div></td><td>'+esc(contactName(t.contact_id))+'</td><td>'+esc(fmtDate(t.due_at))+'</td><td>'+esc(t.priority||'normal')+'</td><td><span class="pill">'+esc(statusLabel(t.status))+'</span></td></tr>').join('')+'</tbody></table>':'<div class="empty"><strong>Nenhuma tarefa pendente</strong>As tarefas e retornos da equipe aparecerão aqui.</div>'}
 async function openSession(session){if(!session?.user){showAuth();return}showApp(session.user);try{const ok=await loadClinics(session.user);if(ok){$('clinic-modal-backdrop').classList.add('hidden');await loadData()}}catch(e){setStatus('app-status','Não foi possível carregar a clínica. Verifique o acesso e as permissões. '+(e.message||''),'error')}}
 $('login-form').addEventListener('submit',async e=>{e.preventDefault();if(!sb){setStatus('auth-status','Não foi possível iniciar a conexão segura. Atualize a página.','error');return}const btn=$('login-button');btn.disabled=true;btn.textContent='Entrando…';setStatus('auth-status','');try{const {data,error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await openSession(data.session)}catch(err){setStatus('auth-status',err.message==='Invalid login credentials'?'E-mail ou senha inválidos.':'Não foi possível entrar: '+(err.message||'verifique suas credenciais.'),'error')}finally{btn.disabled=false;btn.textContent='Entrar no CRM'}});
 $('logout-button').addEventListener('click',async()=>{await sb.auth.signOut();clinicId=null;showAuth();});
 $('clinic-form').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;setStatus('clinic-status','Criando ambiente…');try{const {data,error}=await sb.rpc('clinic_crm_create_clinic',{p_name:$('clinic-name').value.trim(),p_segment:$('clinic-segment').value});if(error)throw error;const {data:userData}=await sb.auth.getUser();const ok=await loadClinics(userData.user);if(ok){$('clinic-modal-backdrop').classList.add('hidden');await loadData();setStatus('app-status','Clínica criada com sucesso.','success')}}catch(err){setStatus('clinic-status','Não foi possível criar a clínica: '+(err.message||'verifique suas permissões.'),'error')}finally{btn.disabled=false}});
 function openContactModal(){$('contact-form').reset();setStatus('contact-status','');$('modal-backdrop').classList.remove('hidden');$('contact-name').focus()}
 function closeContactModal(){$('modal-backdrop').classList.add('hidden')}
 document.querySelectorAll('[data-action="new-contact"]').forEach(b=>b.addEventListener('click',openContactModal));$('cancel-contact').addEventListener('click',closeContactModal);$('modal-backdrop').addEventListener('click',e=>{if(e.target===$('modal-backdrop'))closeContactModal()});
 $('contact-form').addEventListener('submit',async e=>{e.preventDefault();if(!clinicId)return;const btn=$('save-contact');btn.disabled=true;setStatus('contact-status','Salvando contato…');try{const {data:userData}=await sb.auth.getUser();const row={clinic_id:clinicId,full_name:$('contact-name').value.trim(),contact_type:$('contact-type').value,phone:$('contact-phone').value.trim()||null,email:$('contact-email').value.trim()||null,source:$('contact-source').value||null,next_follow_up_at:$('contact-followup').value?new Date($('contact-followup').value).toISOString():null,marketing_consent:$('contact-consent').checked,consent_recorded_at:$('contact-consent').checked?new Date().toISOString():null,created_by:userData.user.id};const {error}=await sb.from('clinic_crm_contacts').insert(row);if(error)throw error;closeContactModal();await loadData();setStatus('app-status','Contato salvo com sucesso.','success')}catch(err){setStatus('contact-status','Não foi possível salvar. Confira se seu acesso à clínica está ativo. '+(err.message||''),'error')}finally{btn.disabled=false}});
 $('contact-search').addEventListener('input',renderContacts);$('contact-filter').addEventListener('change',renderContacts);
 $('kanban-view-button').addEventListener('click',()=>setPipelineView('kanban'));$('table-view-button').addEventListener('click',()=>setPipelineView('table'));
 function navigate(section){const valid=['dashboard','contacts','pipeline','appointments','tasks'].includes(section)?section:'dashboard';document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$('section-'+valid).classList.add('active');document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===valid));$('page-title').textContent=({dashboard:'Visão geral',contacts:'Contatos e pacientes',pipeline:'Oportunidades',appointments:'Agenda',tasks:'Tarefas e retornos'})[valid];}
 document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.section)));
 if(!sb){setStatus('auth-status','A biblioteca de autenticação não carregou. Verifique sua conexão e recarregue.','error')}
 else sb.auth.getSession().then(({data})=>{if(data.session)openSession(data.session)}).catch(()=>{});
})();
