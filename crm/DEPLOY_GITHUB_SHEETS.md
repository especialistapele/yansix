# Implantação YANSIX CRM — GitHub + Google Sheets

## 1. Google Sheets
1. Crie uma planilha privada chamada `YANSIX CRM — Banco de Dados`.
2. Abra **Extensões → Apps Script**.
3. Substitua o conteúdo por `apps-script/Code.gs`.
4. Execute `setupSheets()` uma vez e autorize o script.
5. Confirme as abas: `USUARIOS`, `CLIENTES`, `NEGOCIACOES`, `INTERACOES`, `TAREFAS`, `PROPOSTAS`, `HISTORICO`, `CONFIGURACOES`, `INTEGRACOES`, `LOGS`.
6. O administrador inicial é `yansix.tech@gmail.com` com a senha `Yansix@2026`. A senha é gravada como SHA-256.

## 2. Publicar o Apps Script
- **Implantar → Nova implantação → App da Web**.
- Executar como: **você**.
- Quem tem acesso: **qualquer pessoa** (o próprio CRM controla a sessão/token; a planilha permanece privada).
- Copie a URL `/exec`.

## 3. Configurar o CRM
Abra `crm/js/config.js` e troque:

`SHEETS_API_URL:"COLE_AQUI_A_URL_DO_WEB_APP"`

pela URL `/exec` do Apps Script.

## 4. GitHub Pages
Envie o conteúdo da pasta `crm` para uma pasta `crm` na raiz do repositório do site YANSIX:

```
/crm/index.html
/crm/js/app.js
/crm/js/api.js
/crm/js/config.js
/crm/css/style.css
/crm/assets/yansix-logo.png
/crm/apps-script/Code.gs
```

A URL será:

`https://www.yansix.tech/crm/`

O `Code.gs` **não é executado pelo GitHub**; ele fica documentado dentro da pasta apenas para manutenção. O backend real é o Google Apps Script.

## 5. Segurança
- Nunca publique a planilha.
- Não coloque senhas, tokens ou IDs privados no frontend.
- O login é validado no Apps Script.
- O token de sessão expira após 30 minutos e é renovado durante a atividade.
- CRUD e leitura exigem token válido.
- O frontend não baixa dados antes do login.
- `USUARIOS.senha` nunca é devolvida pela API de listagem.
- O webhook de lead é separado da sessão do CRM; proteja o formulário do site contra spam/requisições abusivas quando colocá-lo em produção.
