import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nome = process.argv[2];
if (!nome) {
  console.error('Uso: node scripts/criar-estabelecimento.mjs "Nome do Estabelecimento" [slug]');
  process.exit(1);
}
const slug = process.argv[3] || nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = path.join(root,'index.html');
const srcAssets = path.join(root,'assets');
const dest = path.join(root,'estabelecimentos',slug);
await fs.mkdir(path.join(dest,'assets'),{recursive:true});
let html = await fs.readFile(template,'utf8');
html = html.replace("const slug = new URLSearchParams(location.search).get('padaria') || 'padaria-da-villa';", `const slug = new URLSearchParams(location.search).get('padaria') || '${slug}';`);
await fs.writeFile(path.join(dest,'index.html'),html,'utf8');
for (const file of await fs.readdir(srcAssets)) await fs.copyFile(path.join(srcAssets,file),path.join(dest,'assets',file));
console.log(JSON.stringify({nome,slug,index:`estabelecimentos/${slug}/index.html`},null,2));
