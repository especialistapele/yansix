# -*- coding: utf-8 -*-
"""
Modelos de dados - Yansix Cashback (Fase 1: Fundação / MVP)

Entidades:
- Cliente: quem acumula pontos
- Servico: catálogo de serviços do estabelecimento, cada um com pontuação
- Pontuacao: registro de pontos ganhos por um cliente ao consumir um serviço
- Premio: catálogo de prêmios resgatáveis por pontos
- Resgate: registro de troca de pontos por um prêmio
"""
from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Cliente(db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    telefone = db.Column(db.String(30), nullable=False)
    email = db.Column(db.String(150))
    data_nascimento = db.Column(db.Date)
    genero = db.Column(db.String(20))  # "feminino" | "masculino" | "outro"
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    pontuacoes = db.relationship(
        "Pontuacao", backref="cliente", cascade="all, delete-orphan", lazy="dynamic"
    )
    resgates = db.relationship(
        "Resgate", backref="cliente", cascade="all, delete-orphan", lazy="dynamic"
    )

    @property
    def pontos_ganhos(self):
        return sum(p.pontos for p in self.pontuacoes) or 0

    @property
    def pontos_resgatados(self):
        return sum(r.pontos_utilizados for r in self.resgates) or 0

    @property
    def saldo(self):
        return self.pontos_ganhos - self.pontos_resgatados

    @property
    def total_visitas(self):
        return self.pontuacoes.count()

    @property
    def ticket_medio(self):
        total = sum(p.valor for p in self.pontuacoes)
        qtd = self.pontuacoes.count()
        return (total / qtd) if qtd else 0

    @property
    def iniciais(self):
        partes = self.nome.strip().split()
        if not partes:
            return "?"
        if len(partes) == 1:
            return partes[0][0].upper()
        return (partes[0][0] + partes[-1][0]).upper()

    def faz_aniversario_em(self, ref: date):
        if not self.data_nascimento:
            return False
        return (self.data_nascimento.day == ref.day
                and self.data_nascimento.month == ref.month)


class Servico(db.Model):
    __tablename__ = "servicos"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    valor = db.Column(db.Float, nullable=False)
    ativo = db.Column(db.Boolean, default=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def pontos(self):
        """1 real = 1 ponto, arredondado sempre para baixo."""
        return int(self.valor)


class Premio(db.Model):
    __tablename__ = "premios"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    pontos_necessarios = db.Column(db.Integer, nullable=False)
    estoque = db.Column(db.Integer)  # None = ilimitado
    ativo = db.Column(db.Boolean, default=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)


class Pontuacao(db.Model):
    __tablename__ = "pontuacoes"

    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    servico_id = db.Column(db.Integer, db.ForeignKey("servicos.id"))
    servico_nome = db.Column(db.String(120), nullable=False)  # snapshot do nome
    valor = db.Column(db.Float, nullable=False)
    pontos = db.Column(db.Integer, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    servico = db.relationship("Servico")


class Resgate(db.Model):
    __tablename__ = "resgates"

    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    premio_id = db.Column(db.Integer, db.ForeignKey("premios.id"))
    premio_nome = db.Column(db.String(120), nullable=False)  # snapshot do nome
    pontos_utilizados = db.Column(db.Integer, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    premio = db.relationship("Premio")
