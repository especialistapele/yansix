# Hora do Pão — Sistema Master + Index

Esta versão continua **em cima da última versão enviada** e adiciona as funções administrativas sem alterar a lógica visual principal da index.

## Index pública
- `index.html` usa o layout original da index-modelo.
- A logo superior continua sendo a logo original em SVG + texto e **não usa `logo.jpg`**.
- As imagens enviadas permanecem como arquivos físicos, sem Base64:
  - `01.jpg` → AGUARDANDO
  - `02.jpg` → PÃO PRONTO
  - `03.jpg` → PRÓXIMO PÃO
  - `04.jpg` → FIM DO DIA
- No celular:
  - `01 mobile.jpg` → AGUARDANDO
  - `02 mobile.jpg` → PÃO PRONTO
  - `03 mobile.jpg` → PRÓXIMO PÃO
  - `04 mobile.jpg` → FIM DO DIA
- A index **não permite que caminhos antigos gravados no Supabase substituam essas quatro artes**.
- Regra: até 20 minutos, inclusive, = AGUARDANDO; somente acima de 20 minutos = PRÓXIMO PÃO.
- A index carrega a padaria pelo `?padaria=slug` e consulta `pagina_publica` no Supabase.

## Painel Master
`painel-master.html` agora possui:
- Dashboard geral;
- cadastro e edição de padarias;
- ativação/desativação de padarias;
- cadastro, ativação/desativação e troca de senha de administradores;
- programação de horários por dia da semana;
- modo programado ou manual;
- antecedência configurável para o estado AGUARDANDO;
- configuração visual da index por padaria;
- salvamento de rascunho e publicação do tema;
- restauração do tema padrão;
- assinatura por padaria;
- geração de cobranças mensais;
- registro de pagamentos;
- gestão básica dos planos.

## Regras da programação
A index trabalha com quatro estados:
1. AGUARDANDO — falta até 20 minutos;
2. PÃO PRONTO — horário atual dentro da duração configurada;
3. PRÓXIMO PÃO — faltam mais de 20 minutos para o próximo horário;
4. FIM DO DIA — não há mais pão programado naquele dia e é mostrado o próximo horário futuro.

## Supabase
Projeto: `scnzyxvtaizfsbwiofvf`
- Financeiro: `planos`, `assinaturas_padaria`, `cobrancas_mensais`.
- Plano inicial: Hora do Pão — Básico, R$ 30,00/mês.
- Função de cobrança: `gerar_cobranca_mensal(p_padaria, p_competencia)`.
- Edge Function administrativa: `master-management`.

### Edge Function `master-management`
Arquivo local:
`supabase/functions/master-management/index.ts`

Operações protegidas para Master:
- `create_padaria`
- `create_admin`
- `set_admin_active`
- `reset_admin_password`

A função usa autenticação do usuário e operações administrativas somente no backend; nenhuma secret key é colocada no HTML.

## Imagens
Todas as imagens são arquivos físicos em `assets/`. Não são convertidas para Base64.

## Estrutura individual por estabelecimento
Cada estabelecimento possui uma pasta própria para sua index pública:

`estabelecimentos/<slug-do-estabelecimento>/index.html`

As quatro artes físicas (`01`, `02`, `03`, `04` e suas versões mobile) são copiadas para a pasta `assets` dessa unidade. Assim, cada index é independente das demais e mantém a sequência dos quatro estados.

O script `scripts/criar-estabelecimento.mjs` provisiona essa estrutura em um diretório de implantação.

**Publicação:** para o painel Master criar fisicamente essa pasta no servidor/hosting de forma automática, ele precisa estar ligado ao mecanismo de publicação do hosting/repositório (GitHub, FTP ou API do servidor). O painel já trabalha com o caminho padronizado por estabelecimento.

## Regra de horários — produção

Os horários da Index **não são fixos**. Os horários presentes na Index Modelo servem somente para demonstração visual.

Em produção, cada estabelecimento cadastra seus próprios horários no painel. A Index consulta `pagina_publica(slug)` no Supabase e usa os horários retornados para calcular o estado em tempo real.

- Durante a janela `hora` até `hora + duracao_pronto_min`: **PÃO PRONTO**.
- Quando faltam **20 minutos ou menos** para o próximo horário: **AGUARDANDO**.
- Quando faltam **mais de 20 minutos**: **PRÓXIMO PÃO**.
- Sem outro horário no dia: **FIM DO DIA**.
- Exatamente `20:00` restantes continua sendo **AGUARDANDO**.

As artes físicas continuam fixas por estado: `01` aguardando, `02` pronto, `03` próximo, `04` fim, com suas versões mobile.

## Publicação física das Index

O arquivo `server.mjs` é o primeiro passo da publicação automática: o Painel Master chama `POST /api/estabelecimentos/publicar` e o servidor cria `estabelecimentos/<slug>/`, copia o `index.html` e as oito artes para `assets/`. A chamada é protegida pela sessão do Supabase e exige perfil Master.

Para executar localmente:

```bash
node server.mjs
```

Depois abra o Painel Master pelo servidor, por exemplo `http://localhost:8787/painel-master.html`.

> O servidor de publicação precisa existir no ambiente de hospedagem. Um HTML estático sozinho não consegue criar pastas físicas no servidor.

## Painel da padaria (V5)
`painel-admin.html` — login do administrador, dashboard (relógio Brasília, próximo pão, estado), CRUD de horários com dias da semana e duração do “Pão pronto”, modo manual/programado, mensagens da Index, dados públicos e perfil/senha.
- Admin: acessa somente a própria padaria (RLS via `minha_padaria()` + triggers de proteção).
- Master: botão **Acessar painel** na lista de padarias abre `painel-admin.html?padaria=<id>` com a faixa “MODO MASTER”, sem usar a senha do admin.

## V6
- Dashboard do painel da padaria com fontes menores (mobile).
- Index: atualização ao vivo (Supabase Realtime em `publicacoes` + verificação a cada 30 s como reserva). Alterações de horários, mensagens e tema aparecem sem recarregar.
- Painel da padaria: aplica cores e logo do painel definidos pelo Master.
- Master → Gerenciar padaria → **Painel e imagens**: cores do painel, upload de logo (JPG/PNG/WebP → redimensiona a 512 px → WebP), preview, rascunho/publicar, uso de armazenamento. Mantém só a versão otimizada.
- Banco: função `uso_armazenamento(p_padaria)` (Master vê todas; admin só a própria).

## V7 — Envio de cobranças
**Antes de usar, rode `supabase/migrations/20261005_envio_cobrancas.sql` no SQL Editor do Supabase.**
- Master → Financeiro → **+ Enviar cobrança**: escolhe a unidade e a competência, escreve uma mensagem opcional e envia. Também há **Enviar pendentes** (todas de uma vez), **Reenviar**, atalhos por **WhatsApp** e **E-mail** (abrem o app com o texto pronto) e **Dados de pagamento** (PIX/favorecido/instruções).
- Painel da padaria → **Mensalidade**: mostra o valor, o vencimento, a mensagem e o PIX com botão Copiar; aviso no Dashboard; o Master vê “Enviada/Visualizada”.
- RLS: a padaria só vê cobranças da própria unidade e só depois de enviadas. Cobranças pagas/enviadas não são alteradas ao “gerar” de novo. Pendentes vencidas viram “atrasado”.
- Não há gateway de pagamento nem envio de e-mail pelo servidor: o pagamento é confirmado manualmente pelo Master (“Registrar pagamento”).

## V8
- Armazenamento e Logs são exclusivos do Painel Master (abas **Armazenamento** — todas as unidades — e **Logs** com filtro por padaria). Removidos do painel da padaria.

## V9
- Master → Index: **Preview responsivo** (Desktop, Notebook, Tablet, Smartphone) nos estados Próximo pão, Aguardando, Pão pronto e Fim do dia, refletindo em tempo real as cores/textos em edição. Usa `index.html?padaria=<slug>&preview=1&estado=<estado>`.
- Master → Dashboard: alertas (sem admin ativo, sem horários, armazenamento ≥70%, mensalidade atrasada/não enviada, limite de 30) e últimas alterações.

## V10 — Monitoramento do Supabase
Master → **Armazenamento** mostra o banco (limite 500 MB) e o storage (limite 1 GB) do projeto, com percentual, alerta a partir de 70%/90%, maiores tabelas, usuários e o espaço reservado às padarias; os limites podem ser ajustados se o plano mudar. O Dashboard do Master também alerta. SQL: `supabase/migrations/20261005_uso_plataforma.sql` (já aplicado no projeto).
