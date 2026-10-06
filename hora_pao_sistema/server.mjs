import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://scnzyxvtaizfsbwiofvf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_nApY5cRNCcrSeUuhz3eJpQ_-Pqki3n-';
const ROOT = __dirname;
const PUBLIC_ROOT = ROOT;
const TEMPLATE_INDEX = path.join(ROOT, 'index.html');
const TEMPLATE_ASSETS = path.join(ROOT, 'assets');

function json(res, status, body){
  const data = JSON.stringify(body);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
  res.end(data);
}
function safeSlug(value){
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}
async function readBody(req){
  let s=''; for await(const chunk of req) s+=chunk; return s?JSON.parse(s):{};
}
async function supabase(pathname, token, init={}){
  return fetch(SUPABASE_URL + pathname, {
    ...init,
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})}
  });
}
async function masterUser(token){
  if(!token) throw new Error('Sessão Master não informada.');
  const u=await supabase('/auth/v1/user', token);
  if(!u.ok) throw new Error('Sessão inválida ou expirada.');
  const user=await u.json();
  const p=await supabase(`/rest/v1/profiles?select=id,papel,ativo&id=eq.${encodeURIComponent(user.id)}&limit=1`, token);
  if(!p.ok) throw new Error('Não foi possível validar o perfil Master.');
  const rows=await p.json();
  if(!rows[0] || rows[0].papel!=='master' || !rows[0].ativo) throw new Error('Acesso restrito ao usuário Master.');
  return user;
}
async function publicarIndex(req, res){
  try{
    const auth=req.headers.authorization||'';
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    await masterUser(token);
    const body=await readBody(req);
    if(!body.padaria_id) return json(res,400,{error:'padaria_id é obrigatório.'});
    const r=await supabase(`/rest/v1/padarias?select=id,nome,nome_comercial,slug&id=eq.${encodeURIComponent(body.padaria_id)}&limit=1`,token);
    if(!r.ok) return json(res,502,{error:'Não foi possível consultar a padaria no Supabase.'});
    const rows=await r.json();
    const padaria=rows[0];
    if(!padaria) return json(res,404,{error:'Padaria não encontrada.'});
    const slug=safeSlug(padaria.slug);
    if(!slug) return json(res,400,{error:'Slug inválido para publicação.'});

    const dir=path.join(ROOT,'estabelecimentos',slug);
    const assets=path.join(dir,'assets');
    await fs.mkdir(assets,{recursive:true});
    await fs.copyFile(TEMPLATE_INDEX,path.join(dir,'index.html'));
    const files=await fs.readdir(TEMPLATE_ASSETS,{withFileTypes:true});
    for(const f of files){ if(f.isFile()) await fs.copyFile(path.join(TEMPLATE_ASSETS,f.name),path.join(assets,f.name)); }
    return json(res,200,{ok:true,padaria_id:padaria.id,slug,path:`estabelecimentos/${slug}/index.html`});
  }catch(e){ return json(res,401,{error:e.message||'Falha na publicação.'}); }
}
function serveStatic(req,res){
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/' || pathname==='/painel-master.html') pathname=pathname==='/'?'/painel-master.html':pathname;
  const full=path.resolve(PUBLIC_ROOT,'.'+pathname);
  if(!full.startsWith(path.resolve(PUBLIC_ROOT)+path.sep)) return json(res,403,{error:'Acesso negado.'});
  fs.stat(full).then(st=>{if(st.isDirectory()) throw new Error('dir');return fs.readFile(full)}).then(buf=>{
    const ext=path.extname(full).toLowerCase(); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(buf);
  }).catch(()=>json(res,404,{error:'Arquivo não encontrado.'}));
}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
  if(req.method==='POST' && req.url==='/api/estabelecimentos/publicar') return publicarIndex(req,res);
  if(req.method==='GET') return serveStatic(req,res);
  return json(res,405,{error:'Método não permitido.'});
});
server.listen(PORT,()=>console.log(`Hora do Pão: http://localhost:${PORT}`));
