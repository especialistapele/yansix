/**
 * YANSIX CRM — Google Apps Script Web App
 * Fase 14.1 — Segurança real da API + usuários + auditoria + backup.
 *
 * 1) Cole este arquivo no Apps Script vinculado à planilha.
 * 2) Execute setupSheets() uma vez como proprietário.
 * 3) Publique como Web App.
 */
const SPREADSHEET_ID="";
const SESSION_TTL_SECONDS=1800;
const SHEETS={
  LOGS:["id","dataHora","tipo","usuario","acao","entidade","registroId","detalhes"],
  USUARIOS:["id","nome","email","senha","perfil","ativo","criadoEm"],
  CLIENTES:["id","nome","cpfCnpj","contato","whatsapp","email","dataNascimento","empresa","cargo","segmento","porte","origem","responsavel","status","potencial","cep","rua","numero","complemento","bairro","cidade","estado","instagram","facebook","linkedin","site","tags","preferencias","observacoes","criadoEm"],
  NEGOCIACOES:["id","clienteId","produtoServico","valor","etapa","probabilidade","previsaoFechamento","responsavel","origem","prioridade","previsao"],
  CONFIGURACOES:["id","chave","valor"],
  INTEGRACOES:["id","chave","valor"],
  INTERACOES:["id","clienteId","canal","tipo","data","hora","descricao","resultado","proximoContato"],
  TAREFAS:["id","clienteId","titulo","data","hora","canal","tipo","status","criadoEm","automationKey","origemAutomacao"],
  PROPOSTAS:["id","numero","clienteId","negociacaoId","servico","quantidade","valorUnitario","desconto","total","validade","status","observacoes","criadoEm","atualizadoEm"],
  HISTORICO:["id","clienteId","entidade","registroId","dataHora","usuario","acao","alteracao"]
};
function getBook_(){return SPREADSHEET_ID?SpreadsheetApp.openById(SPREADSHEET_ID):SpreadsheetApp.getActiveSpreadsheet()}
function json_(data){return ContentService.createTextOutput(JSON.stringify({ok:true,data:data})).setMimeType(ContentService.MimeType.JSON)}
function error_(message){return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(message)})).setMimeType(ContentService.MimeType.JSON)}
function sheet_(name){const sh=getBook_().getSheetByName(name);if(!sh)throw new Error("Aba não encontrada: "+name);return sh}
function setupSheets(){
  const ss=getBook_();
  Object.keys(SHEETS).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);let last=Math.max(sh.getLastColumn(),1);let headers=sh.getRange(1,1,1,last).getValues()[0].map(v=>String(v||"").trim()).filter(Boolean);SHEETS[name].forEach(h=>{if(!headers.includes(h))headers.push(h)});sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1)});
  ensureAdmin_(); return "OK";
}
function ensureAdmin_(){
  const sh=sheet_("USUARIOS"),headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),email="yansix.tech@gmail.com";
  const rows=sh.getDataRange().getValues(); const emailIdx=headers.indexOf("email"), senhaIdx=headers.indexOf("senha"), idIdx=headers.indexOf("id");
  let found=-1; for(let i=1;i<rows.length;i++) if(String(rows[i][emailIdx]||"").toLowerCase()===email){found=i;break;}
  const hash=hashPassword_("Yansix@2026");
  if(found<0){const obj={id:Utilities.getUuid(),nome:"Administrador",email,senha:hash,perfil:"Administrador",ativo:true,criadoEm:new Date().toISOString()};sh.appendRow(headers.map(h=>obj[h]!==undefined?obj[h]:""));}
  else {const existing=String(rows[found][senhaIdx]||"");if(!existing||existing.length!==64)sh.getRange(found+1,senhaIdx+1).setValue(hash);if(idIdx>=0&&!rows[found][idIdx])sh.getRange(found+1,idIdx+1).setValue(Utilities.getUuid());}
}
function hashPassword_(password){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(password),Utilities.Charset.UTF_8);return bytes.map(b=>{const v=b<0?b+256:b;return (v<16?"0":"")+v.toString(16)}).join("")}
function rows_(name){const sh=sheet_(name),values=sh.getDataRange().getValues();if(values.length<2)return[];const headers=values[0].map(h=>String(h));return values.slice(1).filter(r=>r.some(v=>v!=="")).map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]);return o})}
function findRow_(name,id){const sh=sheet_(name),values=sh.getDataRange().getValues();if(!values.length)throw new Error("Aba sem cabeçalho.");const headers=values[0],idx=headers.indexOf("id");if(idx<0)throw new Error("Coluna id ausente.");for(let i=1;i<values.length;i++)if(String(values[i][idx])===String(id))return{sh,headers,row:i+1,values:values[i]};return null}
function sanitizeUser_(u){const out={...u};delete out.senha;return out}
function sessionKey_(token){return "yansix_session_"+token}
function createSession_(user){const token=Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");CacheService.getScriptCache().put(sessionKey_(token),JSON.stringify({id:user.id,email:user.email,nome:user.nome,perfil:user.perfil,createdAt:Date.now()}),SESSION_TTL_SECONDS);return token}
function requireAuth_(token){if(!token)throw new Error("Não autenticado.");const raw=CacheService.getScriptCache().get(sessionKey_(token));if(!raw)throw new Error("Sessão inválida ou expirada.");const session=JSON.parse(raw),users=rows_("USUARIOS"),user=users.find(u=>String(u.id)===String(session.id)&&u.ativo!==false);if(!user)throw new Error("Usuário inválido ou inativo.");CacheService.getScriptCache().put(sessionKey_(token),JSON.stringify(session),SESSION_TTL_SECONDS);return user}
function roleAllowed_(user,action,sheet){if(user.perfil==="Administrador")return true;if(action==="list")return ["CLIENTES","NEGOCIACOES","INTERACOES","TAREFAS","PROPOSTAS","HISTORICO","CONFIGURACOES","INTEGRACOES"].includes(sheet);if(action==="create")return ["CLIENTES","NEGOCIACOES","INTERACOES","TAREFAS","PROPOSTAS","HISTORICO","CONFIGURACOES","INTEGRACOES"].includes(sheet);if(action==="update"||action==="delete")return ["CLIENTES","NEGOCIACOES","INTERACOES","TAREFAS","PROPOSTAS","CONFIGURACOES","INTEGRACOES"].includes(sheet);return false}
function logEvent_(tipo,usuario,acao,entidade,registroId,detalhes){try{const sh=sheet_("LOGS"),headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),obj={id:Utilities.getUuid(),dataHora:new Date().toISOString(),tipo:tipo||"INFO",usuario:usuario||"Sistema",acao:acao||"",entidade:entidade||"",registroId:registroId||"",detalhes:String(detalhes||"")};sh.appendRow(headers.map(h=>obj[h]!==undefined?obj[h]:""));}catch(err){console.error(err)}}
function backupAllSheets(){const ss=getBook_(),stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||"GMT-3","yyyyMMdd-HHmmss"),backup=ss.copy(ss.getName()+" — Backup "+stamp);logEvent_("BACKUP","Sistema","Backup criado","SISTEMA","",backup.getId());return backup.getUrl()}
function cleanupOldBackups(days){const keep=Math.max(1,Number(days||30)),prefix=getBook_().getName()+" — Backup ",cutoff=Date.now()-keep*86400000,files=DriveApp.getFiles();let removed=0;while(files.hasNext()){const f=files.next();if(f.getName().indexOf(prefix)!==0)continue;if(f.getDateCreated().getTime()<cutoff){f.setTrashed(true);removed++}}return removed}
function doGet(e){try{const action=String(e.parameter.action||"health").toLowerCase(),token=String(e.parameter.token||"");if(action==="health")return json_({status:"ok",time:new Date().toISOString()});if(action==="webhook-info")return json_({status:"ok",endpoint:"POST Web App",message:"Envie action=lead e, se configurado, o segredo do webhook."});if(action==="login")throw new Error("Login deve usar POST.");const user=requireAuth_(token),name=e.parameter.sheet;if(!name||!SHEETS[name])throw new Error("sheet inválida.");if(action==="list"){if(!roleAllowed_(user,action,name))throw new Error("Sem permissão.");const data=rows_(name).map(x=>name==="USUARIOS"?sanitizeUser_(x):x);return json_(data)}throw new Error("Ação GET inválida.")}catch(err){logEvent_("ERRO","API","GET",e?.parameter?.sheet||"","",err.message);return error_(err.message)}}
function doPost(e){try{const body=JSON.parse(e.postData.contents||"{}"),action=String(body.action||"").toLowerCase();
  if(action==="login"){const email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");if(!email||!password)throw new Error("Informe e-mail e senha.");const lockKey="yansix_login_"+Utilities.base64EncodeWebSafe(email).slice(0,120),cache=CacheService.getScriptCache(),locked=cache.get(lockKey);if(locked&&Number(locked)>=5)throw new Error("Muitas tentativas. Acesso bloqueado temporariamente.");const user=rows_("USUARIOS").find(u=>String(u.email||"").toLowerCase()===email&&u.ativo!==false);if(!user||hashPassword_(password)!==String(user.senha)){const attempts=Number(locked||0)+1;if(attempts>=5)cache.put(lockKey,"5",900);else cache.put(lockKey,String(attempts),900);throw new Error("E-mail ou senha inválidos.");}cache.remove(lockKey);const token=createSession_(user);logEvent_("AUTH",user.nome,"Login","AUTH",user.id,"Acesso autenticado");return json_({token,user:sanitizeUser_(user),expiresIn:SESSION_TTL_SECONDS})}
  if(action==="logout"){const token=String(body.token||"");if(token)CacheService.getScriptCache().remove(sessionKey_(token));return json_(true)}
  if(action==="lead"){const data=body.data||body.lead||{},name=String(data.nome||data.name||"").trim();if(!name)throw new Error("Nome do lead é obrigatório.");const lead={id:Utilities.getUuid(),nome:name,email:String(data.email||"").trim().toLowerCase(),contato:String(data.contato||data.telefone||data.phone||"").trim(),whatsapp:String(data.whatsapp||data.phone||"").trim(),empresa:String(data.empresa||data.company||"").trim(),origem:String(data.origem||data.source||"Site").trim()||"Site",status:"lead",potencial:String(data.potencial||"médio"),observacoes:String(data.observacoes||data.message||data.mensagem||"").trim(),criadoEm:new Date().toISOString().slice(0,10)};const sh=sheet_("CLIENTES"),headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);sh.appendRow(headers.map(h=>lead[h]!==undefined?lead[h]:""));logEvent_("WEBHOOK","Site","Lead recebido","CLIENTES",lead.id,lead.nome);return json_({id:lead.id,received:true})}
  const token=String(body.token||""),user=requireAuth_(token),name=body.sheet;if(!SHEETS[name])throw new Error("sheet inválida.");if(!roleAllowed_(user,action,name))throw new Error("Sem permissão para esta operação.");const sh=sheet_(name);
  if(action==="create"){const data=body.data||{},headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),id=String(data.id||Utilities.getUuid()),row=headers.map(h=>data[h]!==undefined?data[h]:"");const idIdx=headers.indexOf("id");if(idIdx>=0)row[idIdx]=id;if(name==="USUARIOS"&&Object.prototype.hasOwnProperty.call(data,"senha")){const senhaIdx=headers.indexOf("senha");if(senhaIdx>=0)row[senhaIdx]=hashPassword_(String(data.senha))}sh.appendRow(row);logEvent_("CRUD",user.nome,"Criação",name,id,"Registro criado");const created=rows_(name).find(x=>String(x.id)===id)||{...data,id};return json_(name==="USUARIOS"?sanitizeUser_(created):created)}
  if(action==="update"){const found=findRow_(name,body.id);if(!found)throw new Error("Registro não encontrado.");const data=body.data||{};if(name==="USUARIOS"&&Object.prototype.hasOwnProperty.call(data,"senha"))data.senha=hashPassword_(data.senha);found.headers.forEach((h,i)=>{if(Object.prototype.hasOwnProperty.call(data,h))found.sh.getRange(found.row,i+1).setValue(data[h])});logEvent_("CRUD",user.nome,"Atualização",name,body.id,"Registro atualizado");const updated=rows_(name).find(x=>String(x.id)===String(body.id));return json_(name==="USUARIOS"?sanitizeUser_(updated):updated)}
  if(action==="delete"){const found=findRow_(name,body.id);if(!found)throw new Error("Registro não encontrado.");found.sh.deleteRow(found.row);logEvent_("CRUD",user.nome,"Exclusão",name,body.id,"Registro excluído");return json_(true)}
  throw new Error("Ação POST inválida.");
}catch(err){logEvent_("ERRO","API","POST","","",err.message);return error_(err.message)}}
