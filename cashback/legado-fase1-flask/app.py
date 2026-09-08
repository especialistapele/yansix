# -*- coding: utf-8 -*-
"""
Yansix Cashback — Fase 1 (Fundação / MVP)

Como rodar:
    pip install -r requirements.txt
    python app.py

Depois acesse http://localhost:5000
"""
from datetime import datetime, date, timedelta
from flask import Flask, render_template, request, redirect, url_for, flash
from models import db, Cliente, Servico, Premio, Pontuacao, Resgate

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///yansix_cashback.db"
app.config["SECRET_KEY"] = "troque-esta-chave-em-producao"
db.init_app(app)


def parse_data(valor_str):
    if not valor_str:
        return None
    try:
        return datetime.strptime(valor_str, "%Y-%m-%d").date()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@app.route("/")
def dashboard():
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)

    total_clientes = Cliente.query.count()
    novos_hoje = Cliente.query.filter(
        db.func.date(Cliente.criado_em) == hoje
    ).count()
    novos_mes = Cliente.query.filter(Cliente.criado_em >= inicio_mes).count()

    ultimas_pontuacoes = (
        Pontuacao.query.order_by(Pontuacao.criado_em.desc()).limit(6).all()
    )

    aniversariantes_hoje = [
        c for c in Cliente.query.all() if c.faz_aniversario_em(hoje)
    ]

    total_pontos_distribuidos = db.session.query(
        db.func.coalesce(db.func.sum(Pontuacao.pontos), 0)
    ).scalar()
    total_pontos_resgatados = db.session.query(
        db.func.coalesce(db.func.sum(Resgate.pontos_utilizados), 0)
    ).scalar()

    return render_template(
        "dashboard.html",
        total_clientes=total_clientes,
        novos_hoje=novos_hoje,
        novos_mes=novos_mes,
        ultimas_pontuacoes=ultimas_pontuacoes,
        aniversariantes_hoje=aniversariantes_hoje,
        total_pontos_distribuidos=total_pontos_distribuidos,
        total_pontos_resgatados=total_pontos_resgatados,
        saldo_circulacao=total_pontos_distribuidos - total_pontos_resgatados,
    )


# ---------------------------------------------------------------------------
# Clientes
# ---------------------------------------------------------------------------
@app.route("/clientes")
def clientes_lista():
    busca = request.args.get("q", "").strip()
    query = Cliente.query
    if busca:
        like = f"%{busca}%"
        query = query.filter(
            db.or_(Cliente.nome.ilike(like), Cliente.telefone.ilike(like))
        )
    clientes = query.order_by(Cliente.nome.asc()).all()
    return render_template("clientes_lista.html", clientes=clientes, busca=busca)


@app.route("/clientes/novo", methods=["GET", "POST"])
def cliente_novo():
    if request.method == "POST":
        cliente = Cliente(
            nome=request.form["nome"].strip(),
            telefone=request.form["telefone"].strip(),
            email=request.form.get("email", "").strip() or None,
            data_nascimento=parse_data(request.form.get("data_nascimento")),
            genero=request.form.get("genero"),
        )
        db.session.add(cliente)
        db.session.commit()
        flash(f'Cliente "{cliente.nome}" cadastrado com sucesso.', "success")
        return redirect(url_for("cliente_detalhe", cliente_id=cliente.id))
    return render_template("cliente_form.html", cliente=None)


@app.route("/clientes/<int:cliente_id>/editar", methods=["GET", "POST"])
def cliente_editar(cliente_id):
    cliente = Cliente.query.get_or_404(cliente_id)
    if request.method == "POST":
        cliente.nome = request.form["nome"].strip()
        cliente.telefone = request.form["telefone"].strip()
        cliente.email = request.form.get("email", "").strip() or None
        cliente.data_nascimento = parse_data(request.form.get("data_nascimento"))
        cliente.genero = request.form.get("genero")
        db.session.commit()
        flash("Dados do cliente atualizados.", "success")
        return redirect(url_for("cliente_detalhe", cliente_id=cliente.id))
    return render_template("cliente_form.html", cliente=cliente)


@app.route("/clientes/<int:cliente_id>/excluir", methods=["POST"])
def cliente_excluir(cliente_id):
    cliente = Cliente.query.get_or_404(cliente_id)
    nome = cliente.nome
    db.session.delete(cliente)
    db.session.commit()
    flash(f'Cliente "{nome}" excluído.', "info")
    return redirect(url_for("clientes_lista"))


@app.route("/clientes/<int:cliente_id>")
def cliente_detalhe(cliente_id):
    cliente = Cliente.query.get_or_404(cliente_id)
    historico = (
        cliente.pontuacoes.order_by(Pontuacao.criado_em.desc()).all()
    )
    resgates = cliente.resgates.order_by(Resgate.criado_em.desc()).all()
    premios = Premio.query.filter_by(ativo=True).order_by(
        Premio.pontos_necessarios.asc()
    ).all()
    return render_template(
        "cliente_detalhe.html",
        cliente=cliente,
        historico=historico,
        resgates=resgates,
        premios=premios,
    )


# ---------------------------------------------------------------------------
# Serviços
# ---------------------------------------------------------------------------
@app.route("/servicos", methods=["GET", "POST"])
def servicos():
    if request.method == "POST":
        servico = Servico(
            nome=request.form["nome"].strip(),
            valor=float(request.form["valor"].replace(",", ".")),
        )
        db.session.add(servico)
        db.session.commit()
        flash(f'Serviço "{servico.nome}" cadastrado.', "success")
        return redirect(url_for("servicos"))
    lista = Servico.query.order_by(Servico.nome.asc()).all()
    return render_template("servicos.html", servicos=lista)


@app.route("/servicos/<int:servico_id>/excluir", methods=["POST"])
def servico_excluir(servico_id):
    servico = Servico.query.get_or_404(servico_id)
    db.session.delete(servico)
    db.session.commit()
    flash("Serviço removido.", "info")
    return redirect(url_for("servicos"))


# ---------------------------------------------------------------------------
# Prêmios
# ---------------------------------------------------------------------------
@app.route("/premios", methods=["GET", "POST"])
def premios():
    if request.method == "POST":
        estoque_raw = request.form.get("estoque", "").strip()
        premio = Premio(
            nome=request.form["nome"].strip(),
            pontos_necessarios=int(request.form["pontos_necessarios"]),
            estoque=int(estoque_raw) if estoque_raw else None,
        )
        db.session.add(premio)
        db.session.commit()
        flash(f'Prêmio "{premio.nome}" cadastrado.', "success")
        return redirect(url_for("premios"))
    lista = Premio.query.order_by(Premio.pontos_necessarios.asc()).all()
    return render_template("premios.html", premios=lista)


@app.route("/premios/<int:premio_id>/excluir", methods=["POST"])
def premio_excluir(premio_id):
    premio = Premio.query.get_or_404(premio_id)
    db.session.delete(premio)
    db.session.commit()
    flash("Prêmio removido.", "info")
    return redirect(url_for("premios"))


# ---------------------------------------------------------------------------
# Registrar pontuação (atendimento)
# ---------------------------------------------------------------------------
@app.route("/pontuar", methods=["GET", "POST"])
def pontuar():
    cliente_id = request.args.get("cliente_id", type=int)
    clientes = Cliente.query.order_by(Cliente.nome.asc()).all()
    servicos_lista = Servico.query.filter_by(ativo=True).order_by(
        Servico.nome.asc()
    ).all()

    if request.method == "POST":
        cliente = Cliente.query.get_or_404(int(request.form["cliente_id"]))
        servico = Servico.query.get_or_404(int(request.form["servico_id"]))
        valor_form = request.form.get("valor")
        valor = float(valor_form.replace(",", ".")) if valor_form else servico.valor
        pontos = int(valor)

        pontuacao = Pontuacao(
            cliente_id=cliente.id,
            servico_id=servico.id,
            servico_nome=servico.nome,
            valor=valor,
            pontos=pontos,
        )
        db.session.add(pontuacao)
        db.session.commit()
        flash(
            f"Pontuação registrada: {cliente.nome} ganhou {pontos} pontos.",
            "success",
        )
        return redirect(url_for("cliente_detalhe", cliente_id=cliente.id))

    return render_template(
        "pontuar.html",
        clientes=clientes,
        servicos=servicos_lista,
        cliente_id_preselecionado=cliente_id,
    )


# ---------------------------------------------------------------------------
# Resgatar prêmio
# ---------------------------------------------------------------------------
@app.route("/clientes/<int:cliente_id>/resgatar/<int:premio_id>", methods=["POST"])
def resgatar_premio(cliente_id, premio_id):
    cliente = Cliente.query.get_or_404(cliente_id)
    premio = Premio.query.get_or_404(premio_id)

    if cliente.saldo < premio.pontos_necessarios:
        flash("O cliente não possui pontos suficientes para esse prêmio.", "danger")
        return redirect(url_for("cliente_detalhe", cliente_id=cliente.id))

    if premio.estoque is not None:
        if premio.estoque <= 0:
            flash("Esse prêmio está sem estoque disponível.", "danger")
            return redirect(url_for("cliente_detalhe", cliente_id=cliente.id))
        premio.estoque -= 1

    resgate = Resgate(
        cliente_id=cliente.id,
        premio_id=premio.id,
        premio_nome=premio.nome,
        pontos_utilizados=premio.pontos_necessarios,
    )
    db.session.add(resgate)
    db.session.commit()
    flash(f'Prêmio "{premio.nome}" resgatado para {cliente.nome}.', "success")
    return redirect(url_for("cliente_detalhe", cliente_id=cliente.id))


# ---------------------------------------------------------------------------
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
