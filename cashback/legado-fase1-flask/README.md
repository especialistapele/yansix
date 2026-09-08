# Yansix Cashback — Fase 1 (Fundação / MVP)

Sistema de fidelidade e cashback para estabelecimentos de serviço (inspirado no
modelo "Pontos Beleza Pura"), com identidade visual da Yansix.

Esta é a **Fase 1** do roadmap: a fundação operacional do sistema. Inclui:

- Cadastro de clientes (nome, telefone, e-mail, data de nascimento, gênero)
- Cadastro de serviços com pontuação automática (R$1 = 1 ponto, arredondado para baixo)
- Registro de pontuação por atendimento
- Cadastro e resgate de prêmios (com estoque opcional)
- Histórico de consumo e de resgates por cliente
- Painel administrativo com indicadores: clientes cadastrados, novos clientes
  (dia/mês), pontos distribuídos, pontos em circulação, últimas pontuações e
  aniversariantes do dia

## Como rodar

Pré-requisito: Python 3.10 ou superior instalado.

```bash
# 1. Entre na pasta do projeto
cd yansix_cashback

# 2. (Recomendado) crie um ambiente virtual
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Rode o servidor
python app.py
```

Depois é só acessar **http://localhost:5000** no navegador.

Na primeira execução o sistema cria automaticamente o banco de dados
(`instance/yansix_cashback.db`, SQLite) — não precisa configurar nada.

## Fluxo de uso básico

1. Cadastre os **serviços** do estabelecimento em *Serviços* (nome + valor).
2. Cadastre os **prêmios** disponíveis em *Prêmios* (nome + pontos necessários).
3. Cadastre os **clientes** em *Clientes → Novo cliente*.
4. A cada atendimento, use *Pontuar Atendimento* para registrar os pontos do
   cliente.
5. Quando o cliente tiver pontos suficientes, o resgate do prêmio pode ser
   feito diretamente na página do cliente (aba *Prêmios*).

## Estrutura do projeto

```
yansix_cashback/
├── app.py              # Rotas e regras de negócio
├── models.py            # Modelos de dados (SQLAlchemy)
├── requirements.txt
├── static/
│   ├── css/style.css    # Identidade visual (roxo/prata Yansix)
│   └── img/logo.jpeg
└── templates/            # Telas (Jinja2)
    ├── base.html
    ├── dashboard.html
    ├── clientes_lista.html
    ├── cliente_form.html
    ├── cliente_detalhe.html
    ├── servicos.html
    ├── premios.html
    └── pontuar.html
```

## Próximas fases (fora do escopo deste entregável)

- **Fase 2** — Página do cliente final (link via WhatsApp), indicação com
  cupom, avaliações/NPS, desconto de aniversário
- **Fase 3** — Validade de pontos, pontuação máxima por serviço, aparência
  configurável
- **Fase 4** — Cashback em dinheiro real
- **Fase 5** — Marketing automático (mensagens via WhatsApp)
- **Fase 6** — Gamificação com níveis (Bronze/Prata/Ouro)

## Observação importante

O servidor incluso (`python app.py`) é o servidor de desenvolvimento do Flask,
indicado para testes locais. Para colocar o sistema no ar para uso real, será
necessário publicá-lo com um servidor de produção (ex: Gunicorn) e um banco de
dados adequado ao volume esperado (o SQLite atual é suficiente para validar a
Fase 1, mas o ideal é migrar para PostgreSQL ao avançar de fase).
